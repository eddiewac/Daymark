// Freelancer invoices in Supabase. Reads and writes stay on the signed-in
// user's rows. Nothing in this file is sent to an LLM or other third party.
//
// Invoice numbers come from next_invoice_number() — one sequence per user,
// shared across workspaces. Time pulled onto an invoice is marked with
// time_entries.billed_invoice_id so it cannot be pulled twice. Deleting a
// draft clears that pointer (foreign key on delete set null).

import { supabase, getCurrentUser } from './supabase.js';
import { uid } from './utils.js';
import {
  billingDelta,
  cleanLines,
  clientSnapshot,
  migrationHint,
  normalizeCurrency,
  sellerSnapshot,
  validateClient,
  validateInvoice,
  validateSeller,
} from './invoiceModel.js';

const INVOICE_COLUMNS = `
  id, workspace_id, project_id, client_id, invoice_number, invoice_date, due_date,
  currency, gst_enabled, status, sent_at, paid_at, notes, seller_snapshot, client_snapshot, updated_at,
  invoice_lines (
    id, description, quantity, unit_amount, source_type, source_id, source_ids, sort_order
  )
`;

function mapSeller(row) {
  if (!row) return null;
  return {
    businessName: row.business_name || '',
    abn: row.abn || '',
    address: row.address || '',
    email: row.email || '',
    logoData: row.logo_data || '',
    logoWidth: row.logo_width || null,
    logoHeight: row.logo_height || null,
    paymentInstructions: row.payment_instructions || '',
  };
}

function mapClient(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id || null,
    name: row.name || '',
    company: row.company || '',
    email: row.email || '',
    address: row.address || '',
  };
}

function mapLine(row) {
  return {
    id: row.id,
    description: row.description || '',
    quantity: Number(row.quantity) || 0,
    unitAmount: Number(row.unit_amount) || 0,
    sourceType: row.source_type || 'manual',
    sourceId: row.source_id || '',
    sourceIds: idList(row.source_ids),
    sortOrder: row.sort_order || 0,
  };
}

function idList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string' || !value.startsWith('{')) return [];
  return value
    .slice(1, -1)
    .split(',')
    .map((item) => item.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function mapInvoice(row) {
  const lines = (row.invoice_lines || [])
    .map(mapLine)
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id || '').localeCompare(b.id || ''));
  return {
    id: row.id,
    workspaceId: row.workspace_id || null,
    projectId: row.project_id || '',
    clientId: row.client_id || '',
    invoiceNumber: row.invoice_number || '',
    invoiceDate: row.invoice_date || '',
    dueDate: row.due_date || '',
    currency: row.currency || 'AUD',
    gstEnabled: !!row.gst_enabled,
    status: row.status || 'draft',
    sentAt: row.sent_at || null,
    paidAt: row.paid_at || null,
    notes: row.notes || '',
    sellerSnapshot: row.seller_snapshot || {},
    clientSnapshot: row.client_snapshot || {},
    lines,
    updatedAt: row.updated_at || null,
  };
}

function fail(error) {
  return { ok: false, error: migrationHint(error) };
}

export async function loadSeller() {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in', seller: null, userEmail: '' };
  const { data, error } = await supabase
    .from('invoice_sellers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ...fail(error), seller: null, userEmail: user.email || '' };
  return { ok: true, seller: mapSeller(data), userEmail: user.email || '' };
}

export async function saveSeller(seller) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  const errors = validateSeller(seller);
  if (errors.length) return { ok: false, error: errors[0] };
  const snap = sellerSnapshot(seller);
  const logo = seller?.logoData || null;
  const row = {
    user_id: user.id,
    business_name: snap.businessName,
    abn: snap.abn,
    address: snap.address,
    email: snap.email,
    logo_data: logo || null,
    logo_width: logo ? seller.logoWidth || null : null,
    logo_height: logo ? seller.logoHeight || null : null,
    payment_instructions: snap.paymentInstructions,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('invoice_sellers').upsert(row).select('*').single();
  if (error) return fail(error);
  return { ok: true, seller: mapSeller(data) };
}

export async function loadClients(workspaceId) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in', clients: [] };
  let query = supabase.from('invoice_clients').select('*').eq('user_id', user.id).order('name');
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  else query = query.is('workspace_id', null);
  const { data, error } = await query;
  if (error) return { ...fail(error), clients: [] };
  return { ok: true, clients: (data || []).map(mapClient) };
}

export async function saveClient(client, workspaceId) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  const errors = validateClient(client);
  if (errors.length) return { ok: false, error: errors[0] };
  const snap = clientSnapshot(client);
  const patch = {
    name: snap.name,
    company: snap.company,
    email: snap.email,
    address: snap.address,
    workspace_id: workspaceId || null,
    updated_at: new Date().toISOString(),
  };
  if (client?.id) {
    const { data, error } = await supabase
      .from('invoice_clients')
      .update(patch)
      .eq('id', client.id)
      .select('*');
    if (error) return fail(error);
    if (data && data.length > 0) return { ok: true, client: mapClient(data[0]) };
  }
  const id = client?.id || uid();
  const { data, error } = await supabase
    .from('invoice_clients')
    .insert({ id, user_id: user.id, ...patch })
    .select('*')
    .single();
  if (error) return fail(error);
  return { ok: true, client: mapClient(data) };
}

export async function deleteClient(clientId) {
  if (!clientId) return { ok: false, error: 'Missing client' };
  const { error } = await supabase.from('invoice_clients').delete().eq('id', clientId);
  if (error) return fail(error);
  return { ok: true };
}

export async function loadInvoices(workspaceId) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in', invoices: [] };
  let query = supabase.from('invoices').select(INVOICE_COLUMNS).order('invoice_number', { ascending: false });
  if (workspaceId) query = query.eq('workspace_id', workspaceId);
  else query = query.is('workspace_id', null);
  const { data, error } = await query;
  if (error) return { ...fail(error), invoices: [] };
  return { ok: true, invoices: (data || []).map(mapInvoice) };
}

// Unbilled blocks for these tasks, in any workspace. Time logged on a team
// task from the personal workspace is stored with workspace_id null, so this
// query is by task id (still only the signed-in user's rows).
export async function loadUnbilledTime(taskIds) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in', blocks: [] };
  const ids = [...new Set((taskIds || []).filter(Boolean))];
  if (ids.length === 0) return { ok: true, blocks: [] };

  const blocks = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabase
      .from('time_entries')
      .select('id, task_id, date, hours, data, billed_invoice_id')
      .eq('user_id', user.id)
      .in('task_id', chunk);
    if (error) return { ...fail(error), blocks: [] };
    for (const row of data || []) {
      if (row.billed_invoice_id) continue;
      if (row.data?.voided) continue;
      const hours = Number(row.hours) || 0;
      if (hours <= 0) continue;
      blocks.push({
        id: row.id,
        taskId: row.task_id,
        date: typeof row.date === 'string' ? row.date.slice(0, 10) : '',
        hours,
        voided: false,
        billedInvoiceId: null,
      });
    }
  }
  return { ok: true, blocks };
}

async function allocateInvoiceNumber() {
  const { data, error } = await supabase.rpc('next_invoice_number');
  if (error) return fail(error);
  const number = typeof data === 'string' ? data : '';
  if (!/^INV-[0-9]{4,}$/.test(number)) {
    return { ok: false, error: 'Could not allocate an invoice number.' };
  }
  return { ok: true, number };
}

function headerRow(draft, workspaceId, userId, invoiceNumber) {
  return {
    id: draft.id,
    user_id: userId,
    workspace_id: workspaceId || null,
    project_id: draft.projectId || null,
    client_id: draft.client?.id || draft.clientId || null,
    invoice_number: invoiceNumber,
    invoice_date: draft.invoiceDate,
    due_date: draft.dueDate,
    currency: normalizeCurrency(draft.currency),
    gst_enabled: !!draft.gstEnabled,
    status: 'draft',
    notes: String(draft.notes || '').slice(0, 2000),
    seller_snapshot: sellerSnapshot(draft.seller),
    client_snapshot: clientSnapshot(draft.client || draft.clientSnapshot),
    updated_at: new Date().toISOString(),
  };
}

async function claimTime(invoiceId, ids) {
  if (!ids.length) return { ok: true };
  const { data: owned, error: ownedError } = await supabase
    .from('time_entries')
    .select('id')
    .in('id', ids)
    .eq('billed_invoice_id', invoiceId);
  if (ownedError) return fail(ownedError);
  const already = new Set((owned || []).map((row) => row.id));
  const need = ids.filter((id) => !already.has(id));
  if (need.length === 0) return { ok: true };

  const { data, error } = await supabase
    .from('time_entries')
    .update({ billed_invoice_id: invoiceId, updated_at: new Date().toISOString() })
    .in('id', need)
    .is('billed_invoice_id', null)
    .select('id');
  if (error) return fail(error);
  const got = new Set((data || []).map((row) => row.id));
  if (got.size !== need.length) {
    if (got.size) await releaseTime(invoiceId, [...got]);
    return { ok: false, error: 'Some of that time is already on another invoice. Refresh and try again.' };
  }
  return { ok: true };
}

async function releaseTime(invoiceId, ids) {
  if (!ids.length) return { ok: true };
  const { error } = await supabase
    .from('time_entries')
    .update({ billed_invoice_id: null, updated_at: new Date().toISOString() })
    .in('id', ids)
    .eq('billed_invoice_id', invoiceId);
  if (error) return fail(error);
  return { ok: true };
}

async function replaceLines(invoiceId, userId, lines) {
  const rows = lines.map((line, index) => ({
    id: line.id || uid(),
    invoice_id: invoiceId,
    user_id: userId,
    sort_order: index,
    description: line.description || '',
    quantity: line.quantity,
    unit_amount: line.unitAmount,
    source_type: line.sourceType || 'manual',
    source_id: line.sourceId || null,
    source_ids: line.sourceIds || [],
  }));
  if (rows.length === 0) {
    const { error } = await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId);
    if (error) return { ...fail(error), linesWritten: false };
    return { ok: true, lines: [] };
  }
  const { error: upsertError } = await supabase.from('invoice_lines').upsert(rows);
  if (upsertError) return { ...fail(upsertError), linesWritten: false };
  const keep = new Set(rows.map((row) => row.id));
  const { data: existing, error: listError } = await supabase
    .from('invoice_lines')
    .select('id')
    .eq('invoice_id', invoiceId);
  if (listError) return { ...fail(listError), linesWritten: true };
  const remove = (existing || []).map((row) => row.id).filter((id) => !keep.has(id));
  if (remove.length > 0) {
    const { error: deleteError } = await supabase.from('invoice_lines').delete().in('id', remove);
    if (deleteError) return { ...fail(deleteError), linesWritten: true };
  }
  return {
    ok: true,
    lines: rows.map((row, index) => ({
      id: row.id,
      description: row.description,
      quantity: Number(row.quantity) || 0,
      unitAmount: Number(row.unit_amount) || 0,
      sourceType: row.source_type,
      sourceId: row.source_id || '',
      sourceIds: row.source_ids || [],
      sortOrder: index,
    })),
  };
}

async function removeInvoice(invoiceId) {
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
  return error ? fail(error) : { ok: true };
}

export async function saveInvoice(draft, workspaceId) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  if (draft?.id && draft.status && draft.status !== 'draft') {
    return { ok: false, error: 'Only a draft can be edited.' };
  }
  const errors = validateInvoice(draft);
  if (errors.length) return { ok: false, error: errors[0] };

  const lines = cleanLines(draft.lines).map((line) => ({ ...line, id: line.id || uid() }));
  if (duplicateGuard(lines)) return { ok: false, error: 'The same time is on this invoice more than once.' };

  const savedLines = draft.savedLines || [];
  const { claim, release } = billingDelta(savedLines, lines);
  let invoiceId = draft.id;
  let invoiceNumber = draft.invoiceNumber;
  let created = false;

  if (!invoiceId) {
    let inserted = null;
    for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
      const allocated = await allocateInvoiceNumber();
      if (!allocated.ok) return allocated;
      invoiceNumber = allocated.number;
      invoiceId = uid();
      const row = headerRow({ ...draft, id: invoiceId }, workspaceId, user.id, invoiceNumber);
      const { error } = await supabase.from('invoices').insert(row);
      if (!error) {
        inserted = true;
        created = true;
        break;
      }
      if (error.code !== '23505') return fail(error);
    }
    if (!inserted) return { ok: false, error: 'Could not allocate a free invoice number.' };
  } else {
    const row = headerRow({ ...draft, id: invoiceId }, workspaceId, user.id, invoiceNumber);
    delete row.user_id;
    delete row.invoice_number;
    delete row.id;
    const { data, error } = await supabase
      .from('invoices')
      .update(row)
      .eq('id', invoiceId)
      .eq('status', 'draft')
      .select('id');
    if (error) return fail(error);
    if (!data || data.length === 0) return { ok: false, error: 'This invoice is no longer a draft.' };
  }

  const claimed = await claimTime(invoiceId, claim);
  if (!claimed.ok) {
    if (created) await removeInvoice(invoiceId);
    return claimed;
  }

  const written = await replaceLines(invoiceId, user.id, lines);
  if (!written.ok) {
    if (!written.linesWritten) {
      await releaseTime(invoiceId, claim);
      if (created) await removeInvoice(invoiceId);
    }
    return written;
  }

  const released = await releaseTime(invoiceId, release);
  if (!released.ok) {
    return { ok: false, error: released.error || 'Invoice saved, but removed time could not be unmarked. Save again.' };
  }

  return {
    ok: true,
    invoice: {
      id: invoiceId,
      workspaceId: workspaceId || null,
      projectId: draft.projectId || '',
      clientId: draft.client?.id || draft.clientId || '',
      invoiceNumber,
      invoiceDate: draft.invoiceDate,
      dueDate: draft.dueDate,
      currency: normalizeCurrency(draft.currency),
      gstEnabled: !!draft.gstEnabled,
      status: 'draft',
      sentAt: null,
      paidAt: null,
      notes: String(draft.notes || '').slice(0, 2000),
      sellerSnapshot: sellerSnapshot(draft.seller),
      clientSnapshot: clientSnapshot(draft.client || draft.clientSnapshot),
      lines: written.lines,
    },
  };
}

function duplicateGuard(lines) {
  const seen = new Set();
  for (const line of lines) {
    if (line.sourceType !== 'time') continue;
    for (const id of line.sourceIds || []) {
      if (seen.has(id)) return true;
      seen.add(id);
    }
  }
  return false;
}

const STATUS_NEXT = {
  draft: ['sent', 'paid'],
  sent: ['paid', 'draft'],
  paid: ['sent'],
};

export async function setInvoiceStatus(invoiceId, status) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  if (!invoiceId) return { ok: false, error: 'Missing invoice' };
  if (!['draft', 'sent', 'paid'].includes(status)) return { ok: false, error: 'Unknown status' };

  const { data: current, error: readError } = await supabase
    .from('invoices')
    .select('id, status, sent_at')
    .eq('id', invoiceId)
    .maybeSingle();
  if (readError) return fail(readError);
  if (!current) return { ok: false, error: 'Invoice not found' };
  if (current.status === status) return { ok: true, status, sentAt: current.sent_at, paidAt: status === 'paid' ? current.paid_at : null };
  if (!(STATUS_NEXT[current.status] || []).includes(status)) {
    return { ok: false, error: 'That status change is not available.' };
  }

  const now = new Date().toISOString();
  const patch = { status, updated_at: now };
  if (status === 'paid') patch.paid_at = now;
  if (status === 'sent') {
    patch.paid_at = null;
    patch.sent_at = current.sent_at || now;
  }
  if (status === 'draft') {
    patch.paid_at = null;
    patch.sent_at = null;
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(patch)
    .eq('id', invoiceId)
    .eq('status', current.status)
    .select('status, sent_at, paid_at')
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return { ok: false, error: 'The invoice changed. Reload and try again.' };
  return { ok: true, status: data.status, sentAt: data.sent_at, paidAt: data.paid_at };
}

export async function deleteInvoice(invoiceId) {
  if (!invoiceId) return { ok: false, error: 'Missing invoice' };
  const { data, error: readError } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .maybeSingle();
  if (readError) return fail(readError);
  if (!data) return { ok: true };
  if (data.status !== 'draft') return { ok: false, error: 'Only a draft can be deleted.' };
  return removeInvoice(invoiceId);
}
