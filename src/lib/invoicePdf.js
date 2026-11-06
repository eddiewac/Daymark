// Client-side invoice PDF. Built in the browser with no network call.
// Do not send invoice contents to an LLM or any other third party.

import { jsPDF } from 'jspdf';
import {
  clientForDocument,
  formatIsoDay,
  formatMoney,
  invoiceTotals,
  normalizeCurrency,
  safeLogoSrc,
  sellerForDocument,
  statusLabel,
  invoiceDisplayStatus,
} from './invoiceModel.js';

const MARGIN = 16;
const PAGE_W = 210;
const PAGE_H = 297;
const RIGHT = PAGE_W - MARGIN;
const CONTENT_W = RIGHT - MARGIN;
const INK = [26, 26, 26];
const MUTED = [102, 100, 94];
const ACCENT = [83, 74, 183];
const LINE = [216, 213, 208];
const BAND = [247, 246, 243];

export function invoiceFilename(invoice) {
  const number = String(invoice?.invoiceNumber || 'invoice').replace(/[^\w.-]+/g, '');
  return `${number || 'invoice'}.pdf`;
}

export function invoicePdfModel({ invoice, lines, seller, client, today }) {
  const sellerDoc = sellerForDocument(invoice, seller);
  const clientDoc = clientForDocument(invoice, client);
  const totals = invoiceTotals(lines, !!invoice?.gstEnabled);
  const currency = normalizeCurrency(invoice?.currency);
  return {
    heading: invoice?.gstEnabled ? 'Tax invoice' : 'Invoice',
    invoiceNumber: invoice?.invoiceNumber || '',
    invoiceDate: formatIsoDay(invoice?.invoiceDate),
    dueDate: formatIsoDay(invoice?.dueDate),
    currency,
    gstEnabled: !!invoice?.gstEnabled,
    status: statusLabel(invoiceDisplayStatus(invoice, today)),
    seller: sellerDoc,
    client: clientDoc,
    projectName: invoice?.projectName || '',
    notes: String(invoice?.notes || '').trim(),
    lines: (lines || []).map((line) => ({
      description: line.description || '',
      quantity: Number(line.quantity) || 0,
      unitAmount: formatMoney(Math.round((Number(line.unitAmount) || 0) * 100)),
      amount: formatMoney(invoiceLineCents(line)),
    })),
    subtotal: formatMoney(totals.subtotalCents),
    gst: formatMoney(totals.gstCents),
    total: formatMoney(totals.totalCents),
    logoSrc: safeLogoSrc(sellerDoc.logoData),
    logoWidth: Number(sellerDoc.logoWidth) || 0,
    logoHeight: Number(sellerDoc.logoHeight) || 0,
  };
}

function invoiceLineCents(line) {
  const qty = Number(line?.quantity);
  const unit = Number(line?.unitAmount);
  if (!Number.isFinite(qty) || !Number.isFinite(unit) || qty < 0 || unit < 0) return 0;
  return Math.round(qty * unit * 100);
}

export function buildInvoicePdf(input) {
  const model = invoicePdfModel(input);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
  doc.setProperties({
    title: `${model.heading} ${model.invoiceNumber}`.trim(),
    creator: 'Daymark',
    producer: 'Daymark',
  });
  drawInvoice(doc, model);
  return doc;
}

export function invoicePdfBytes(input) {
  return buildInvoicePdf(input).output('arraybuffer');
}

export function downloadInvoicePdf(input) {
  buildInvoicePdf(input).save(invoiceFilename(input.invoice));
}

function drawInvoice(doc, model) {
  const cursor = { y: MARGIN, page: 1 };
  const pages = () => doc.getNumberOfPages();

  const ensure = (height) => {
    if (cursor.y + height <= PAGE_H - 16) return;
    doc.addPage();
    cursor.y = MARGIN;
    cursor.page = pages();
  };

  const text = (value, x, y, { size = 10, style = 'normal', color = INK, align = 'left', maxWidth } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const opts = { align };
    if (maxWidth) opts.maxWidth = maxWidth;
    doc.text(pdfSafe(value), x, y, opts);
  };

  let logoW = 0;
  let logoH = 0;
  if (model.logoSrc && model.logoWidth > 0 && model.logoHeight > 0) {
    const maxW = 32;
    const maxH = 16;
    const ratio = model.logoWidth / model.logoHeight;
    logoW = maxW;
    logoH = logoW / ratio;
    if (logoH > maxH) {
      logoH = maxH;
      logoW = logoH * ratio;
    }
    try {
      const format = model.logoSrc.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(model.logoSrc, format, MARGIN, cursor.y, logoW, logoH);
    } catch {
      logoW = 0;
      logoH = 0;
    }
  }

  const nameX = logoW ? MARGIN + logoW + 4 : MARGIN;
  text(model.seller.businessName || 'Invoice', nameX, cursor.y + 5, { size: 14, style: 'bold' });
  let metaY = cursor.y + 10;
  const sellerLines = sellerDetailLines(model.seller);
  for (const line of sellerLines) {
    text(line, nameX, metaY, { size: 9, color: MUTED });
    metaY += 4;
  }

  text(model.heading.toUpperCase(), RIGHT, cursor.y + 5, {
    size: 14,
    style: 'bold',
    color: ACCENT,
    align: 'right',
  });
  text(model.invoiceNumber || '', RIGHT, cursor.y + 11, { size: 11, align: 'right' });

  cursor.y = Math.max(metaY, cursor.y + (logoH || 18), cursor.y + 22) + 2;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, cursor.y, RIGHT, cursor.y);
  cursor.y += 8;

  text('Bill to', MARGIN, cursor.y, { size: 8, style: 'bold', color: MUTED });
  text('Details', MARGIN + 100, cursor.y, { size: 8, style: 'bold', color: MUTED });
  cursor.y += 5;
  const bill = [
    model.client.name,
    model.client.company,
    model.client.address,
    model.client.email,
  ].filter(Boolean);
  const details = [
    model.invoiceDate ? `Invoice date  ${model.invoiceDate}` : '',
    model.dueDate ? `Due date  ${model.dueDate}` : '',
    `Currency  ${model.currency}`,
    model.projectName ? `Project  ${model.projectName}` : '',
  ].filter(Boolean);
  const rows = Math.max(bill.length, details.length, 1);
  for (let i = 0; i < rows; i += 1) {
    if (bill[i]) text(bill[i], MARGIN, cursor.y, { size: 10, maxWidth: 90 });
    if (details[i]) text(details[i], MARGIN + 100, cursor.y, { size: 10 });
    cursor.y += 5;
  }
  cursor.y += 4;

  const cols = [
    { label: 'Description', x: MARGIN, w: 98, align: 'left' },
    { label: 'Qty', x: MARGIN + 104, w: 18, align: 'right' },
    { label: 'Rate', x: MARGIN + 128, w: 24, align: 'right' },
    { label: 'Amount', x: RIGHT, w: 28, align: 'right' },
  ];

  const drawHeader = () => {
    ensure(12);
    doc.setFillColor(...BAND);
    doc.rect(MARGIN, cursor.y - 4, CONTENT_W, 8, 'F');
    for (const col of cols) {
      text(col.label, col.align === 'right' ? col.x : col.x, cursor.y, {
        size: 8,
        style: 'bold',
        color: MUTED,
        align: col.align,
      });
    }
    cursor.y += 7;
  };

  drawHeader();

  const lineItems = model.lines.length
    ? model.lines
    : [{ description: 'No lines', quantity: '', unitAmount: '', amount: '' }];

  for (const line of lineItems) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(pdfSafe(String(line.description || '')), 96);
    const height = Math.max(wrapped.length, 1) * 4.2 + 2;
    if (cursor.y + height > PAGE_H - 16) {
      doc.addPage();
      cursor.y = MARGIN;
      drawHeader();
    }
    text(wrapped, MARGIN, cursor.y, { size: 10 });
    const qty = line.quantity === '' ? '' : formatQty(line.quantity);
    text(qty, MARGIN + 122, cursor.y, { size: 10, align: 'right' });
    text(line.unitAmount || '', MARGIN + 152, cursor.y, { size: 10, align: 'right' });
    text(line.amount || '', RIGHT, cursor.y, { size: 10, align: 'right' });
    cursor.y += height;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.1);
    doc.line(MARGIN, cursor.y - 2, RIGHT, cursor.y - 2);
  }

  cursor.y += 4;
  ensure(28);
  const totalRows = [
    ['Subtotal', model.subtotal],
    model.gstEnabled ? ['GST (10%)', model.gst] : ['GST', 'Not charged'],
    [`Total ${model.currency}`, model.total],
  ];
  for (let i = 0; i < totalRows.length; i += 1) {
    const [label, value] = totalRows[i];
    const last = i === totalRows.length - 1;
    text(label, MARGIN + 120, cursor.y, { size: last ? 11 : 10, style: last ? 'bold' : 'normal' });
    text(value, RIGHT, cursor.y, { size: last ? 11 : 10, style: last ? 'bold' : 'normal', align: 'right' });
    cursor.y += last ? 7 : 5;
  }

  const payment = String(model.seller.paymentInstructions || '').trim();
  cursor.y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const paymentLines = doc.splitTextToSize(pdfSafe(payment || 'No payment instructions on this invoice.'), CONTENT_W - 8);
  ensure(16 + paymentLines.length * 4);
  doc.setFillColor(...BAND);
  doc.roundedRect(MARGIN, cursor.y, CONTENT_W, 8 + paymentLines.length * 4, 1.5, 1.5, 'F');
  text('How to pay', MARGIN + 4, cursor.y + 5, { size: 8, style: 'bold', color: MUTED });
  text(paymentLines, MARGIN + 4, cursor.y + 10, { size: 10 });
  cursor.y += 14 + paymentLines.length * 4;

  if (model.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const noteLines = doc.splitTextToSize(pdfSafe(model.notes), CONTENT_W);
    ensure(10 + noteLines.length * 4);
    text('Note', MARGIN, cursor.y, { size: 8, style: 'bold', color: MUTED });
    cursor.y += 5;
    text(noteLines, MARGIN, cursor.y, { size: 10 });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    text(`${model.invoiceNumber || 'Invoice'}   ${i} / ${pageCount}`, RIGHT, PAGE_H - 8, {
      size: 8,
      color: MUTED,
      align: 'right',
    });
  }
}

function pdfSafe(value) {
  const clean = (text) => String(text ?? '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00a0/g, ' ');
  if (Array.isArray(value)) return value.map(clean);
  return clean(value);
}

function sellerDetailLines(seller) {
  const lines = [];
  if (seller?.abn) lines.push(`ABN ${seller.abn}`);
  if (seller?.address) lines.push(seller.address.replace(/\s*\n\s*/g, ', '));
  if (seller?.email) lines.push(seller.email);
  return lines.slice(0, 4);
}

function formatQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}
