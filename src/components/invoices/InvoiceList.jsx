import { formatIsoDay, formatMoney, invoiceDisplayStatus, invoiceTotals, projectName, splitInvoiceList } from '../../lib/invoiceModel.js';
import { StatusPill, styles } from './invoiceUi.jsx';

export default function InvoiceList({
  invoices,
  projects,
  today,
  onOpen,
  onCreate,
  onSeller,
  onClients,
}) {
  const { unpaid, paid } = splitInvoiceList(invoices, today);
  return (
    <div style={styles.wrap}>
      <div style={styles.scroll}>
        <div style={styles.head}>
          <div style={styles.titleBlock}>
            <h2 style={styles.title}>Invoices</h2>
            <p style={styles.sub}>
              Bill a client for your own work on a project. You write the payment
              instructions, and you mark the invoice paid. Daymark does not take the money.
            </p>
          </div>
          <div style={styles.actions}>
            <button type="button" style={styles.ghost} onClick={onClients}>Clients</button>
            <button type="button" style={styles.ghost} onClick={onSeller}>Your details</button>
            <button type="button" style={styles.primary} onClick={onCreate}>New invoice</button>
          </div>
        </div>

        {(!invoices || invoices.length === 0) ? (
          <div style={styles.empty}>
            No invoices yet. Create a draft from a project, add lines by hand or from
            unbilled time and deliverables, then download a PDF.
          </div>
        ) : (
          <>
            <h3 style={styles.sectionTitle}>Unpaid</h3>
            {unpaid.length === 0 ? (
              <div style={styles.empty}>Nothing waiting on payment.</div>
            ) : (
              <InvoiceTable invoices={unpaid} projects={projects} today={today} onOpen={onOpen} />
            )}
            {paid.length > 0 && (
              <>
                <h3 style={styles.sectionTitle}>Paid</h3>
                <InvoiceTable invoices={paid} projects={projects} today={today} onOpen={onOpen} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InvoiceTable({ invoices, projects, today, onOpen }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Invoice</th>
            <th style={styles.th}>Client</th>
            <th style={styles.th}>Project</th>
            <th style={styles.th}>Due</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
            <th style={styles.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const status = invoiceDisplayStatus(invoice, today);
            const totals = invoiceTotals(invoice.lines, invoice.gstEnabled);
            const client = invoice.clientSnapshot?.name || 'Client';
            return (
              <tr
                key={invoice.id}
                data-invoice-number={invoice.invoiceNumber}
                data-invoice-status={status}
              >
                <td style={styles.td}>
                  <button type="button" style={styles.rowBtn} onClick={() => onOpen(invoice)}>
                    {invoice.invoiceNumber}
                  </button>
                </td>
                <td style={styles.td}>{client}</td>
                <td style={styles.td}>{projectName(projects, invoice.projectId) || 'Project'}</td>
                <td style={styles.td}>{formatIsoDay(invoice.dueDate) || '—'}</td>
                <td style={{ ...styles.td, textAlign: 'right' }}>{formatMoney(totals.totalCents)}</td>
                <td style={styles.td}><StatusPill status={status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
