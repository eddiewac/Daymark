// Freelancer invoice rules, PDF text, and list order. Run with:
//   npx --yes esbuild src/lib/invoiceModel.check.js --bundle --platform=node --format=cjs --jsx=automatic --outfile=/tmp/invoice-check.cjs && node /tmp/invoice-check.cjs
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import InvoiceList from '../components/invoices/InvoiceList.jsx';
import InvoiceEditor from '../components/invoices/InvoiceEditor.jsx';
import { InvoiceTotals } from '../components/invoices/invoiceUi.jsx';
import {
  availableFixedFees,
  billingDelta,
  buildMailto,
  buildTimeLines,
  clientDeleteBlock,
  clientForDocument,
  invoiceActionPayload,
  invoiceDisplayStatus,
  invoiceTotals,
  migrationHint,
  safeLogoSrc,
  sellerForDocument,
  sortInvoices,
  splitInvoiceList,
  taskBelongsToProject,
  validateInvoice,
} from './invoiceModel.js';
import { invoicePdfBytes, invoicePdfModel } from './invoicePdf.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const today = '2026-11-06';
const seller = {
  businessName: 'Kenilworth Writing',
  abn: '76 959 252 036',
  address: 'Brisbane QLD',
  email: 'hello@example.com',
  paymentInstructions: 'PayID: ada@bank\nBSB 062-000 Account 12345678',
  logoData: '',
};

const project = {
  id: 'p1',
  name: 'Brand launch',
  deliverables: [
    {
      id: 'd1',
      name: 'Slide deck',
      stations: [
        { id: 's1', name: 'Draft' },
        { id: 's2', name: 'Client review' },
      ],
    },
    { id: 'd2', name: 'Leave piece', stations: [] },
  ],
};

const tasks = [
  { id: 't1', title: 'Slide review', projectId: 'p1' },
  { id: 't2', title: 'Other client', projectId: 'p2', project: 'Brand launch' },
  { id: 't3', title: 'Named only', project: 'Brand launch' },
  { id: 't4', title: 'Station task', stationId: 's2' },
];

assert(taskBelongsToProject(tasks[0], project), 'project id match');
assert(!taskBelongsToProject(tasks[1], project), 'a different project id does not match on name');
assert(taskBelongsToProject(tasks[2], project), 'name match when no project id');
assert(taskBelongsToProject(tasks[3], project), 'station on the project');

const blocks = [
  { id: 'b1', taskId: 't1', date: '2026-11-02', hours: 1.5 },
  { id: 'b2', taskId: 't1', date: '2026-11-03', hours: 1 },
  { id: 'b3', taskId: 't1', date: '2026-11-03', hours: 2, billedInvoiceId: 'inv-old' },
  { id: 'b4', taskId: 't1', date: '2026-11-04', hours: 4, voided: true },
  { id: 'b5', taskId: 't2', date: '2026-11-02', hours: 8 },
  { id: 'b1', taskId: 't1', date: '2026-11-02', hours: 9 },
];

const timeLines = buildTimeLines({ blocks, tasks, project, hourlyRate: 100 });
assert(timeLines.length === 1, 'one task group');
assert(timeLines[0].quantity === 2.5, `hours exclude billed, voided, and duplicates, got ${timeLines[0].quantity}`);
assert(timeLines[0].sourceIds.join(',') === 'b1,b2', 'only unbilled block ids');
assert(timeLines[0].unitAmount === 100, 'hourly rate');
assert(timeLines[0].description.includes('Slide review'), 'task title on the line');
assert(!timeLines[0].description.includes('Other client'), 'other project stays off');

const totals = invoiceTotals(
  [{ quantity: 2, unitAmount: 100 }, { quantity: 1, unitAmount: 50 }],
  true
);
assert(totals.subtotalCents === 25000, 'subtotal');
assert(totals.gstCents === 2500, '10% GST');
assert(totals.totalCents === 27500, 'total with GST');
const noGst = invoiceTotals([{ quantity: 2, unitAmount: 100 }], false);
assert(noGst.gstCents === 0 && noGst.totalCents === 20000, 'GST off');

const invoices = [
  { id: '1', invoiceNumber: 'INV-0001', status: 'paid', dueDate: '2026-10-01', paidAt: '2026-11-01T00:00:00Z', lines: [] },
  { id: '2', invoiceNumber: 'INV-0002', status: 'draft', dueDate: '2026-10-01', lines: [] },
  { id: '3', invoiceNumber: 'INV-0003', status: 'sent', dueDate: '2026-11-01', lines: [], clientSnapshot: { name: 'Ada' } },
  { id: '4', invoiceNumber: 'INV-0004', status: 'sent', dueDate: '2026-11-20', lines: [], clientSnapshot: { name: 'Bea' } },
];
assert(invoiceDisplayStatus(invoices[1], today) === 'draft', 'a late draft stays a draft');
assert(invoiceDisplayStatus(invoices[2], today) === 'overdue', 'sent and past due is overdue');
assert(invoiceDisplayStatus(invoices[3], today) === 'sent', 'sent and not due yet');
const ordered = sortInvoices(invoices, today).map((invoice) => invoice.invoiceNumber);
assert(ordered.join(',') === 'INV-0003,INV-0004,INV-0002,INV-0001', `unpaid first, got ${ordered.join(',')}`);
const split = splitInvoiceList(invoices, today);
assert(split.unpaid.map((invoice) => invoice.invoiceNumber).join(',') === 'INV-0003,INV-0004,INV-0002', 'paid is not in unpaid');
assert(split.paid.length === 1, 'paid section');

const fees = availableFixedFees(project, []);
assert(fees.deliverables.length === 2 && fees.stations.length === 2, 'all fixed fees offered');
const afterDeck = availableFixedFees(project, [
  { sourceType: 'deliverable', sourceId: 'd1', sourceIds: ['d1', 's1', 's2'] },
]);
assert(!afterDeck.deliverables.some((item) => item.id === 'd1'), 'billed deliverable is hidden');
assert(afterDeck.stations.length === 0, 'its stations are hidden');
assert(afterDeck.deliverables.some((item) => item.id === 'd2'), 'other deliverable remains');
const afterStation = availableFixedFees(project, [
  { sourceType: 'station', sourceId: 's1', sourceIds: ['s1'] },
]);
assert(!afterStation.deliverables.some((item) => item.id === 'd1'), 'lump fee hidden once a station is billed');
assert(afterStation.stations.map((item) => item.id).join(',') === 's2', 'the other station remains');

const delta = billingDelta(
  [{ sourceType: 'time', sourceIds: ['b1', 'b2'] }],
  [{ sourceType: 'time', sourceIds: ['b2', 'b9'] }]
);
assert(delta.claim.join(',') === 'b9', 'claim new time');
assert(delta.release.join(',') === 'b1', 'release removed time');

const sendErrors = validateInvoice({
  projectId: 'p1',
  clientId: 'c1',
  client: { name: 'Ada' },
  invoiceDate: today,
  dueDate: '2026-11-20',
  currency: 'AUD',
  gstEnabled: true,
  seller: { ...seller, abn: '' },
  lines: [{ description: 'Deck', quantity: 1, unitAmount: 100, sourceType: 'manual' }],
}, { forSend: true });
assert(sendErrors.some((error) => /ABN/.test(error)), 'tax invoice needs an ABN');

const sentAfterDelete = {
  id: 'inv-sent',
  invoiceNumber: 'INV-0008',
  status: 'sent',
  projectId: 'p1',
  clientId: '',
  client: null,
  clientSnapshot: { name: 'Ada North', company: 'Northwind', email: 'ada@client.example', address: 'Sydney' },
  invoiceDate: today,
  dueDate: '2026-11-20',
  currency: 'AUD',
  gstEnabled: false,
  seller,
  lines: [{ description: 'Slide deck', quantity: 1, unitAmount: 400, sourceType: 'deliverable' }],
};
const sentPayload = invoiceActionPayload(sentAfterDelete, [], seller);
assert(validateInvoice(sentPayload).length === 0, 'a sent invoice still validates after its client row is deleted');
assert(
  validateInvoice({ ...sentPayload, status: 'paid' }).length === 0,
  'a paid invoice still validates after its client row is deleted'
);
const sentClient = clientForDocument(sentPayload, sentPayload.client);
assert(sentClient.name === 'Ada North' && sentClient.email === 'ada@client.example', 'PDF uses the stored client');
const sentMail = buildMailto({
  invoice: sentPayload,
  seller,
  client: sentClient,
  totals: { totalCents: 40000 },
});
assert(sentMail.href.startsWith('mailto:ada%40client.example'), 'mailto still addresses the saved client');
const sentPdf = Buffer.from(invoicePdfBytes({
  invoice: { ...sentPayload, projectName: 'Brand launch' },
  lines: sentPayload.lines,
  seller,
  client: null,
  today,
})).toString('latin1');
assert(sentPdf.includes('Ada North'), 'PDF still names the deleted client');
assert(sentPdf.includes('ada@client.example'), 'PDF still has the saved email');

const draftAfterDelete = invoiceActionPayload(
  { ...sentAfterDelete, status: 'draft', invoiceNumber: 'INV-0009' },
  [],
  seller
);
assert(draftAfterDelete.clientId === '', 'a draft drops the dangling client id');
assert(
  validateInvoice(draftAfterDelete).some((error) => error === 'Choose a client.'),
  'a draft asks for another client instead of staying blocked'
);
const repairedDraft = invoiceActionPayload(
  { ...draftAfterDelete, clientId: 'c2' },
  [{ id: 'c2', name: 'Bea South', email: 'bea@client.example' }],
  seller
);
assert(repairedDraft.clientId === 'c2', 'a draft can take a replacement client');
assert(validateInvoice(repairedDraft).length === 0, 'the repaired draft validates');

const ada = { id: 'c1', name: 'Ada North' };
assert(clientDeleteBlock(ada, []) === null, 'a client with no invoices can be deleted');
const refused = clientDeleteBlock(ada, [
  { clientId: 'c1', invoiceNumber: 'INV-0002', status: 'draft' },
  { clientId: 'c1', invoiceNumber: 'INV-0003', status: 'sent' },
  { clientId: 'c9', invoiceNumber: 'INV-0004', status: 'paid' },
]);
assert(refused && /INV-0002 \(draft\)/.test(refused.error), 'delete is refused while a draft points at the client');
assert(/INV-0003 \(sent\)/.test(refused.error), 'delete is refused while a sent invoice points at the client');
assert(!/INV-0004/.test(refused.error), 'another client\'s invoice is not part of the block');

const sentMarkup = renderToStaticMarkup(
  React.createElement(InvoiceEditor, {
    draft: sentAfterDelete,
    projects: [project],
    tasks: [],
    clients: [],
    seller,
    allLines: [],
    today,
    busy: false,
    error: '',
    onChange: () => {},
    onSave: () => {},
    onDelete: () => {},
    onStatus: () => {},
    onDownload: () => {},
    onEmail: () => {},
    onBack: () => {},
    onCreateClient: async () => ({ ok: true, client: { id: 'c2' } }),
    onLoadUnbilled: async () => ({ ok: true, blocks: [] }),
    onEditSeller: () => {},
  })
);
assert(sentMarkup.includes('Billed to Ada North'), 'sent invoice shows the saved client name');
assert(sentMarkup.includes('Download PDF') && sentMarkup.includes('Mark paid'), 'download and status stay available');
assert(sentMarkup.includes('disabled'), 'the client field stays locked on a sent invoice');

const frozen = sellerForDocument(
  { status: 'sent', sellerSnapshot: { ...seller, paymentInstructions: 'Original PayID' } },
  { ...seller, paymentInstructions: 'Changed later', logoData: 'data:image/png;base64,abc' }
);
assert(frozen.paymentInstructions === 'Original PayID', 'sent invoice keeps the payment text');
assert(frozen.logoData.startsWith('data:image/png'), 'logo still comes from the current profile');
assert(safeLogoSrc('javascript:alert(1)') === '', 'logo src must be an image');
assert(/Invoicing tables/.test(migrationHint({ message: 'Could not find the table public.invoices in the schema cache' })), 'migration hint');

const mail = buildMailto({
  invoice: { invoiceNumber: 'INV-0007', invoiceDate: today, dueDate: '2026-11-20', currency: 'aud', gstEnabled: false },
  seller,
  client: { name: 'Ada', email: 'ada@client.example' },
  totals: { totalCents: 25000 },
});
assert(mail.href.startsWith('mailto:ada%40client.example'), 'mailto stays on the device');
assert(mail.body.includes('Attach it to this email'), 'tells the sender to attach the PDF');
assert(!/https?:\/\//.test(mail.body), 'the email body is not a link out');
assert(!/openai|anthropic|llm/i.test(mail.body), 'invoice text is not addressed to a model');
assert(mail.body.includes('$250.00 AUD'), 'total in the email');
assert(mail.body.includes('No GST'), 'GST off is stated');

const pdfInvoice = {
  invoiceNumber: 'INV-0007',
  invoiceDate: today,
  dueDate: '2026-11-20',
  currency: 'AUD',
  gstEnabled: true,
  status: 'draft',
  projectName: 'Brand launch',
  notes: 'Reference PO 14',
};
const pdfLines = [
  { description: 'Slide review', quantity: 2.5, unitAmount: 100, sourceType: 'time' },
  { description: 'Slide deck', quantity: 1, unitAmount: 400, sourceType: 'deliverable' },
];
const model = invoicePdfModel({
  invoice: pdfInvoice,
  lines: pdfLines,
  seller,
  client: { name: 'Ada', company: 'Northwind', email: 'ada@client.example', address: 'Sydney' },
  today,
});
assert(model.heading === 'Tax invoice', 'GST on uses a tax invoice heading');
assert(model.gst === '$65.00', `GST amount, got ${model.gst}`);
assert(model.total === '$715.00', `total, got ${model.total}`);
assert(model.seller.paymentInstructions.includes('PayID'), 'payment instructions are on the document');

const bytes = Buffer.from(invoicePdfBytes({
  invoice: pdfInvoice,
  lines: pdfLines,
  seller,
  client: { name: 'Ada', company: 'Northwind', email: 'ada@client.example' },
  today,
}));
const raw = bytes.toString('latin1');
assert(raw.startsWith('%PDF'), 'PDF download');
assert(raw.includes('INV-0007'), 'invoice number is in the file');
assert(raw.includes('PayID'), 'payment instructions are in the file');
assert(raw.includes('Slide deck'), 'deliverable line is in the file');
assert(raw.includes('TAX INVOICE'), 'tax invoice heading');
assert(!/openai|anthropic/i.test(raw), 'PDF is not sent to a model');

const sentRaw = Buffer.from(invoicePdfBytes({
  invoice: {
    ...pdfInvoice,
    status: 'sent',
    sellerSnapshot: { ...seller, paymentInstructions: 'Original PayID only' },
    clientSnapshot: { name: 'Ada', company: 'Northwind', email: 'ada@client.example', address: 'Sydney' },
  },
  lines: pdfLines,
  seller: { ...seller, paymentInstructions: 'Changed later' },
  client: { name: 'Someone Else', email: 'other@example.com' },
  today,
})).toString('latin1');
assert(sentRaw.includes('Original PayID only'), 'sent pdf keeps the payment text from when it was saved');
assert(!sentRaw.includes('Changed later'), 'sent pdf does not pick up later payment text');
assert(sentRaw.includes('Ada'), 'sent pdf keeps the client from when it was saved');
assert(!sentRaw.includes('Someone Else'), 'sent pdf does not pick up a later client name');

const markup = renderToStaticMarkup(
  React.createElement(InvoiceList, {
    invoices,
    projects: [project],
    today,
    onOpen: () => {},
    onCreate: () => {},
    onSeller: () => {},
    onClients: () => {},
  })
);
const overdueAt = markup.indexOf('data-invoice-status="overdue"');
const sentAt = markup.indexOf('data-invoice-status="sent"');
const draftAt = markup.indexOf('data-invoice-status="draft"');
const paidAt = markup.indexOf('data-invoice-status="paid"');
assert(overdueAt !== -1 && overdueAt < sentAt && sentAt < draftAt && draftAt < paidAt, 'list renders unpaid before paid');
assert(markup.includes('>Unpaid<') && markup.indexOf('>Unpaid<') < markup.indexOf('>Paid<'), 'unpaid heading first');
assert(markup.includes('Daymark does not take the money'), 'list states Daymark does not collect payment');

const gstMarkup = renderToStaticMarkup(
  React.createElement(InvoiceTotals, { lines: pdfLines, gstEnabled: true, currency: 'AUD' })
);
assert(gstMarkup.includes('GST (10%)'), 'GST line when on');
assert(gstMarkup.includes('$65.00') && gstMarkup.includes('$715.00'), 'totals render');
const offMarkup = renderToStaticMarkup(
  React.createElement(InvoiceTotals, { lines: pdfLines, gstEnabled: false, currency: 'AUD' })
);
assert(offMarkup.includes('Not charged'), 'GST off is visible');
assert(!offMarkup.includes('GST (10%)'), 'no GST amount when off');

console.log('invoice checks passed');
