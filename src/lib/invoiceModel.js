// Freelancer invoice rules. Pure functions: no network, no Supabase.
// Invoice text stays on the device and in the user's own database.
// Do not send it to an LLM or any other third party.
//
// Numbering lives in Postgres (next_invoice_number): one sequence per user,
// shared by every workspace, formatted INV-0001. This module only checks the
// shape. Overdue is not stored — a sent invoice whose due date is before
// today is shown as overdue.

export const GST_RATE = 0.1;
export const INVOICE_TERM_DAYS = 14;
export const DEFAULT_CURRENCY = 'AUD';

export const EMPTY_SELLER = {
  businessName: '',
  abn: '',
  address: '',
  email: '',
  logoData: '',
  logoWidth: null,
  logoHeight: null,
  paymentInstructions: '',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS_RANK = { overdue: 0, sent: 1, draft: 2, paid: 3 };
const STATUS_LABEL = { overdue: 'Overdue', sent: 'Sent', draft: 'Draft', paid: 'Paid' };
const MAILTO_MAX = 1800;

export function addCalendarDays(iso, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + (Number(days) || 0));
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function formatIsoDay(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateSpan(dates) {
  const sorted = [...(dates || [])].filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso)).sort();
  if (sorted.length === 0) return '';
  const first = formatIsoDay(sorted[0]);
  const last = formatIsoDay(sorted[sorted.length - 1]);
  if (!first) return '';
  if (sorted[0] === sorted[sorted.length - 1]) return first;
  return `${first} - ${last}`;
}

export function normalizeCurrency(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : DEFAULT_CURRENCY;
}

export function roundQuantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

export function formatMoney(cents) {
  const n = Number(cents);
  const safe = Number.isFinite(n) ? Math.round(n) : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const dollars = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, '0');
  const withCommas = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${withCommas}.${rem}`;
}

export function lineCents(line) {
  const qty = Number(line?.quantity);
  const unit = Number(line?.unitAmount);
  if (!Number.isFinite(qty) || !Number.isFinite(unit)) return 0;
  if (qty < 0 || unit < 0) return 0;
  return Math.round(qty * unit * 100);
}

export function invoiceTotals(lines, gstEnabled) {
  const subtotalCents = (lines || []).reduce((sum, line) => sum + lineCents(line), 0);
  const gstCents = gstEnabled ? Math.round(subtotalCents * GST_RATE) : 0;
  return {
    subtotalCents,
    gstCents,
    totalCents: subtotalCents + gstCents,
  };
}

export function invoiceDisplayStatus(invoice, today) {
  const status = invoice?.status || 'draft';
  if (status === 'paid') return 'paid';
  if (status === 'draft') return 'draft';
  const due = invoice?.dueDate || '';
  if (status === 'sent' && due && today && due < today) return 'overdue';
  return status === 'sent' ? 'sent' : 'draft';
}

export function statusLabel(status) {
  return STATUS_LABEL[status] || 'Draft';
}

export function sortInvoices(invoices, today) {
  return [...(invoices || [])].sort((a, b) => {
    const ra = STATUS_RANK[invoiceDisplayStatus(a, today)] ?? 9;
    const rb = STATUS_RANK[invoiceDisplayStatus(b, today)] ?? 9;
    if (ra !== rb) return ra - rb;
    if (ra === STATUS_RANK.paid) {
      const pa = a.paidAt || '';
      const pb = b.paidAt || '';
      if (pa !== pb) return pb.localeCompare(pa);
    }
    const da = a.dueDate || '9999-99-99';
    const db = b.dueDate || '9999-99-99';
    if (da !== db) return da.localeCompare(db);
    return (b.invoiceNumber || '').localeCompare(a.invoiceNumber || '');
  });
}

export function splitInvoiceList(invoices, today) {
  const sorted = sortInvoices(invoices, today);
  return {
    unpaid: sorted.filter((invoice) => invoiceDisplayStatus(invoice, today) !== 'paid'),
    paid: sorted.filter((invoice) => invoiceDisplayStatus(invoice, today) === 'paid'),
  };
}

function projectHasStation(project, stationId) {
  if (!stationId) return false;
  for (const deliverable of project?.deliverables || []) {
    if ((deliverable.stations || []).some((station) => station.id === stationId)) return true;
  }
  return false;
}

export function taskBelongsToProject(task, project) {
  if (!task || !project) return false;
  if (task.projectId) return task.projectId === project.id;
  if (task.stationId && projectHasStation(project, task.stationId)) return true;
  if (task.deliverableId && (project.deliverables || []).some((d) => d.id === task.deliverableId)) {
    return true;
  }
  if (task.project && project.name && task.project === project.name) return true;
  return false;
}

function clip(text, max) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

export function buildTimeLines({ blocks, tasks, project, hourlyRate, excludeIds }) {
  const skip = new Set(excludeIds || []);
  const seenBlocks = new Set();
  const taskById = new Map((tasks || []).map((task) => [task.id, task]));
  const groups = new Map();

  for (const block of blocks || []) {
    if (!block || block.voided || block.billedInvoiceId) continue;
    if (!block.id || skip.has(block.id) || seenBlocks.has(block.id)) continue;
    seenBlocks.add(block.id);
    const hours = Number(block.hours);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    const task = taskById.get(block.taskId);
    if (!taskBelongsToProject(task, project)) continue;

    const group = groups.get(task.id) || { task, hours: 0, ids: [], dates: [] };
    group.hours += hours;
    group.ids.push(block.id);
    if (block.date) group.dates.push(block.date);
    groups.set(task.id, group);
  }

  const rate = roundMoney(hourlyRate);
  return [...groups.values()]
    .sort((a, b) => {
      const da = [...a.dates].sort()[0] || '';
      const db = [...b.dates].sort()[0] || '';
      if (da !== db) return da.localeCompare(db);
      return (a.task.title || '').localeCompare(b.task.title || '');
    })
    .map((group) => {
      const title = (group.task.title || 'Time').trim() || 'Time';
      const span = formatDateSpan(group.dates);
      return {
        id: '',
        description: clip(span ? `${title} (${span})` : title, 500),
        quantity: roundQuantity(group.hours),
        unitAmount: rate,
        sourceType: 'time',
        sourceId: group.task.id,
        sourceIds: group.ids,
      };
    })
    .filter((line) => line.quantity > 0 && line.sourceIds.length > 0);
}

export function billedFixedFeeIds(lines) {
  const ids = new Set();
  for (const line of lines || []) {
    if (line?.sourceType !== 'deliverable' && line?.sourceType !== 'station') continue;
    if (line.sourceId) ids.add(line.sourceId);
    for (const id of line.sourceIds || []) {
      if (id) ids.add(id);
    }
  }
  return ids;
}

export function availableFixedFees(project, lines) {
  const billed = billedFixedFeeIds(lines);
  const deliverables = [];
  const stations = [];
  for (const deliverable of project?.deliverables || []) {
    const kids = deliverable.stations || [];
    const childBilled = kids.some((station) => billed.has(station.id));
    if (!billed.has(deliverable.id) && !childBilled) {
      deliverables.push({
        id: deliverable.id,
        name: deliverable.name || 'Deliverable',
        stationIds: kids.map((station) => station.id).filter(Boolean),
      });
    }
    if (!billed.has(deliverable.id)) {
      for (const station of kids) {
        if (!station?.id || billed.has(station.id)) continue;
        stations.push({
          id: station.id,
          deliverableId: deliverable.id,
          name: station.name || 'Station',
          deliverableName: deliverable.name || 'Deliverable',
        });
      }
    }
  }
  return { deliverables, stations };
}

export function newManualLine() {
  return {
    id: '',
    description: '',
    quantity: 1,
    unitAmount: 0,
    sourceType: 'manual',
    sourceId: '',
    sourceIds: [],
  };
}

export function newFixedFeeLine(item, amount) {
  const kind = item?.kind === 'station' ? 'station' : 'deliverable';
  const name = (item?.name || (kind === 'station' ? 'Station' : 'Deliverable')).trim();
  const description =
    kind === 'station' && item?.deliverableName
      ? `${item.deliverableName} — ${name}`
      : name;
  const sourceIds =
    kind === 'deliverable'
      ? [item.id, ...(item.stationIds || [])].filter(Boolean)
      : [item?.id].filter(Boolean);
  return {
    id: '',
    description: clip(description, 500),
    quantity: 1,
    unitAmount: roundMoney(amount),
    sourceType: kind,
    sourceId: item?.id || '',
    sourceIds,
  };
}

export function timeIdsOnLines(lines) {
  const ids = [];
  for (const line of lines || []) {
    if (line?.sourceType !== 'time') continue;
    for (const id of line.sourceIds || []) {
      if (id) ids.push(id);
    }
  }
  return ids;
}

export function billingDelta(previousLines, nextLines) {
  const prev = new Set(timeIdsOnLines(previousLines));
  const next = new Set(timeIdsOnLines(nextLines));
  return {
    claim: [...next].filter((id) => !prev.has(id)),
    release: [...prev].filter((id) => !next.has(id)),
  };
}

export function duplicateTimeIds(lines) {
  const seen = new Set();
  const duplicates = [];
  for (const id of timeIdsOnLines(lines)) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  return duplicates;
}

export function cleanLines(lines) {
  const kept = [];
  for (const line of lines || []) {
    const description = clip(line?.description || '', 500);
    const quantity = roundQuantity(line?.quantity);
    const unitAmount = roundMoney(line?.unitAmount);
    const sourceType = ['manual', 'time', 'deliverable', 'station'].includes(line?.sourceType)
      ? line.sourceType
      : 'manual';
    const blank = !description && unitAmount === 0 && sourceType === 'manual';
    if (blank) continue;
    kept.push({
      id: line?.id || '',
      description,
      quantity: quantity || (sourceType === 'time' ? 0 : 1),
      unitAmount,
      sourceType,
      sourceId: line?.sourceId || '',
      sourceIds: [...new Set((line?.sourceIds || []).filter(Boolean))],
    });
  }
  return kept;
}

export function sellerSnapshot(seller) {
  return {
    businessName: String(seller?.businessName || '').trim().slice(0, 200),
    abn: String(seller?.abn || '').trim().slice(0, 20),
    address: String(seller?.address || '').trim().slice(0, 500),
    email: String(seller?.email || '').trim().slice(0, 200),
    paymentInstructions: String(seller?.paymentInstructions || '').trim().slice(0, 2000),
  };
}

export function clientSnapshot(client) {
  return {
    name: String(client?.name || '').trim().slice(0, 200),
    company: String(client?.company || '').trim().slice(0, 200),
    email: String(client?.email || '').trim().slice(0, 200),
    address: String(client?.address || '').trim().slice(0, 500),
  };
}

export function sellerForDocument(invoice, seller) {
  const live = { ...EMPTY_SELLER, ...(seller || {}) };
  const frozen = sellerSnapshot(invoice?.sellerSnapshot || {});
  if (invoice?.status && invoice.status !== 'draft' && frozen.businessName) {
    return {
      ...live,
      ...frozen,
      logoData: live.logoData || '',
      logoWidth: live.logoWidth || null,
      logoHeight: live.logoHeight || null,
    };
  }
  return live;
}

export function clientForDocument(invoice, client) {
  const frozen = clientSnapshot(invoice?.clientSnapshot || {});
  if (invoice?.status && invoice.status !== 'draft' && frozen.name) return frozen;
  return clientSnapshot(client || invoice?.clientSnapshot || {});
}

export function isDraftInvoice(invoice) {
  return !invoice?.status || invoice.status === 'draft';
}

// Shape the invoice for download, email, or a status change.
// A draft with a deleted client loses the dangling id so another client can
// be chosen. A sent or paid invoice keeps its id and its snapshot; it must
// still open when the client row is gone.
export function invoiceActionPayload(invoice, clients, seller) {
  const live = (clients || []).find((item) => item.id === invoice?.clientId) || null;
  return {
    ...invoice,
    clientId: live ? live.id : (isDraftInvoice(invoice) ? '' : (invoice?.clientId || '')),
    client: live,
    seller: seller || null,
  };
}

export function clientDeleteBlock(client, invoices) {
  const id = client?.id;
  if (!id) return null;
  const linked = (invoices || []).filter((invoice) => (invoice.clientId || invoice.client_id) === id);
  if (linked.length === 0) return null;
  const labels = linked.map((invoice) => {
    const number = invoice.invoiceNumber || invoice.invoice_number || 'an invoice';
    const status = invoice.status === 'paid' ? 'paid' : invoice.status === 'sent' ? 'sent' : 'draft';
    return `${number} (${status})`;
  });
  const shown = labels.slice(0, 6).join(', ');
  const extra = labels.length > 6 ? `, and ${labels.length - 6} more` : '';
  const name = String(client.name || 'This client').trim() || 'This client';
  return {
    error: `Can't delete ${name}. Still on ${shown}${extra}. Choose another client on each draft first. Sent and paid invoices stay linked to this client so they can still be downloaded.`,
  };
}

export function validateSeller(seller) {
  const errors = [];
  const name = String(seller?.businessName || '').trim();
  if (!name) errors.push('Add the name or business name to put on the invoice.');
  if (name.length > 200) errors.push('Name is too long.');
  if (String(seller?.abn || '').trim().length > 20) errors.push('ABN is too long.');
  if (String(seller?.address || '').trim().length > 500) errors.push('Address is too long.');
  if (String(seller?.email || '').trim().length > 200) errors.push('Email is too long.');
  if (String(seller?.paymentInstructions || '').length > 2000) {
    errors.push('Payment instructions are too long (2000 characters).');
  }
  if (seller?.logoData && !safeLogoSrc(seller.logoData)) errors.push('Logo must be a PNG or JPEG.');
  if (seller?.logoData && String(seller.logoData).length > 200000) {
    errors.push('Logo is too large. Use a smaller image.');
  }
  return errors;
}

export function validateClient(client) {
  const errors = [];
  const name = String(client?.name || '').trim();
  if (!name) errors.push('Client name is required.');
  if (name.length > 200) errors.push('Client name is too long.');
  if (String(client?.company || '').trim().length > 200) errors.push('Company is too long.');
  const email = String(client?.email || '').trim();
  if (email.length > 200) errors.push('Client email is too long.');
  if (email && !email.includes('@')) errors.push('Client email needs an @.');
  if (String(client?.address || '').trim().length > 500) errors.push('Client address is too long.');
  return errors;
}

export function validateInvoice(draft, { forSend = false } = {}) {
  const errors = [];
  if (!draft?.projectId) errors.push('Choose a project.');
  const clientName = String(draft?.client?.name || draft?.clientSnapshot?.name || '').trim();
  // Drafts need a live client row. Sent and paid invoices keep working from
  // client_snapshot after that row is deleted, so they do not need clientId.
  if (isDraftInvoice(draft)) {
    if (!draft?.clientId) errors.push('Choose a client.');
    else if (!clientName) errors.push('Client name is required.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft?.invoiceDate || '')) errors.push('Invoice date is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft?.dueDate || '')) errors.push('Due date is required.');
  const currency = String(draft?.currency || '').trim().toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) errors.push('Currency is a 3-letter code, such as AUD.');
  const lines = cleanLines(draft?.lines);
  if (lines.length === 0) errors.push('Add at least one line.');
  if (duplicateTimeIds(lines).length > 0) errors.push('The same time is on this invoice more than once.');
  if (lines.some((line) => line.sourceType === 'time' && !(line.quantity > 0))) {
    errors.push('Time lines need hours.');
  }
  if (forSend) {
    const sellerErrors = validateSeller(draft?.seller);
    if (sellerErrors.length) errors.push(sellerErrors[0]);
    if (!clientName) errors.push('Client name is required.');
    if (draft?.gstEnabled && !String(draft?.seller?.abn || '').trim()) {
      errors.push('Add your ABN in Your details before sending a tax invoice.');
    }
  }
  return errors;
}

export function safeLogoSrc(value) {
  if (typeof value !== 'string') return '';
  if (value.startsWith('data:image/png;base64,')) return value;
  if (value.startsWith('data:image/jpeg;base64,')) return value;
  return '';
}

export function buildMailto({ invoice, seller, client, totals }) {
  const to = String(client?.email || '').trim();
  const from = String(seller?.businessName || '').trim() || 'me';
  const number = invoice?.invoiceNumber || 'invoice';
  const subject = `Invoice ${number} from ${from}`;
  const money = formatMoney(totals?.totalCents || 0);
  const currency = normalizeCurrency(invoice?.currency);
  let payment = String(seller?.paymentInstructions || '').trim();
  if (payment.length > 600) payment = `${payment.slice(0, 600).trim()}…`;
  const lines = [
    client?.name ? `Hi ${String(client.name).split('\n')[0].trim()},` : 'Hi,',
    '',
    `Invoice ${number} is ${money} ${currency}.`,
    `Invoice date: ${formatIsoDay(invoice?.invoiceDate) || invoice?.invoiceDate || ''}`,
    `Due: ${formatIsoDay(invoice?.dueDate) || invoice?.dueDate || ''}`,
    invoice?.gstEnabled ? 'GST of 10% is included in that total.' : 'No GST has been charged.',
    '',
    'The PDF has been downloaded. Attach it to this email before you send.',
    '',
    'How to pay:',
    payment || 'See the attached invoice.',
  ];
  let body = lines.join('\n');
  let href = mailtoHref(to, subject, body);
  if (href.length > MAILTO_MAX) {
    body = lines.slice(0, 8).join('\n');
    href = mailtoHref(to, subject, body);
  }
  return { href, to, subject, body };
}

function mailtoHref(to, subject, body) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function migrationHint(error) {
  const msg = String(error?.message || error || '');
  if (/invoice_|next_invoice_number|schema cache|does not exist|PGRST205|42P01|billed_invoice_id/i.test(msg)) {
    return 'Invoicing tables are not in the database yet. In the Supabase SQL editor, paste and run supabase/migrations/20261106120000_freelancer_invoices.sql, then reload.';
  }
  return msg || 'Could not load invoices';
}

export function blankInvoiceDraft(today) {
  const invoiceDate = /^\d{4}-\d{2}-\d{2}$/.test(today || '') ? today : '';
  return {
    id: null,
    invoiceNumber: '',
    projectId: '',
    clientId: '',
    invoiceDate,
    dueDate: invoiceDate ? addCalendarDays(invoiceDate, INVOICE_TERM_DAYS) : '',
    currency: DEFAULT_CURRENCY,
    gstEnabled: false,
    status: 'draft',
    notes: '',
    lines: [],
    savedLines: [],
    sellerSnapshot: null,
    clientSnapshot: null,
    sentAt: null,
    paidAt: null,
  };
}

export function projectName(projects, projectId) {
  const project = (projects || []).find((item) => item.id === projectId);
  return project?.name || (projectId ? 'Project' : '');
}
