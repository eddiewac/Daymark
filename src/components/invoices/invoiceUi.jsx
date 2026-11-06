import { formatMoney, invoiceTotals, normalizeCurrency, statusLabel } from '../../lib/invoiceModel.js';

export function StatusPill({ status }) {
  return (
    <span style={{ ...styles.pill, ...(PILL[status] || PILL.draft) }} data-status={status}>
      {statusLabel(status)}
    </span>
  );
}

export function InvoiceTotals({ lines, gstEnabled, currency }) {
  const totals = invoiceTotals(lines, gstEnabled);
  const code = normalizeCurrency(currency);
  return (
    <div style={styles.totals}>
      <TotalRow label="Subtotal" value={formatMoney(totals.subtotalCents)} />
      {gstEnabled ? (
        <TotalRow label="GST (10%)" value={formatMoney(totals.gstCents)} />
      ) : (
        <TotalRow label="GST" value="Not charged" />
      )}
      <TotalRow label={`Total ${code}`} value={formatMoney(totals.totalCents)} strong />
    </div>
  );
}

function TotalRow({ label, value, strong }) {
  return (
    <div style={styles.totalRow}>
      <span style={strong ? styles.totalStrong : styles.totalLabel}>{label}</span>
      <span style={strong ? styles.totalStrong : undefined}>{value}</span>
    </div>
  );
}

const PILL = {
  draft: { color: 'var(--color-text-secondary)', background: 'var(--bg-surface-alt)' },
  sent: { color: 'var(--accent)', background: 'var(--accent-soft)' },
  overdue: { color: 'var(--color-danger)', background: 'var(--danger-soft)' },
  paid: { color: 'var(--color-success)', background: 'var(--success-soft)' },
};

export const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    background: 'var(--bg-surface)',
    overflow: 'hidden',
  },
  scroll: { flex: 1, overflow: 'auto', padding: '16px 20px 48px' },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  titleBlock: { minWidth: 0 },
  title: { margin: 0, fontSize: 18, fontWeight: 650 },
  sub: { margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)', maxWidth: 560, lineHeight: 1.45 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  primary: {
    padding: '6px 12px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
  },
  ghost: {
    padding: '6px 12px',
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    fontSize: 12,
  },
  danger: {
    padding: '6px 12px',
    background: 'transparent',
    color: 'var(--color-danger)',
    border: '0.5px solid var(--danger-soft-border)',
    borderRadius: 6,
    fontSize: 12,
  },
  off: { opacity: 0.45, cursor: 'not-allowed' },
  back: {
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-link)',
    fontSize: 12,
    marginBottom: 8,
  },
  sectionTitle: { margin: '18px 0 8px', fontSize: 13, fontWeight: 650 },
  empty: { padding: '28px 8px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 },
  error: {
    margin: '0 0 12px',
    padding: '8px 10px',
    borderRadius: 8,
    background: 'var(--danger-soft)',
    color: 'var(--color-danger)',
    fontSize: 12,
  },
  tableWrap: { overflowX: 'auto', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 640 },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: 'var(--bg-surface)',
  },
  td: {
    padding: '8px 10px',
    fontSize: 12,
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    verticalAlign: 'middle',
  },
  rowBtn: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  label: { display: 'block', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 },
  field: {
    width: '100%',
    padding: '7px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    background: 'var(--bg-input, var(--bg-surface))',
    color: 'var(--color-text-primary)',
  },
  area: { minHeight: 72, resize: 'vertical' },
  check: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, marginTop: 8 },
  hint: { fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.45 },
  pill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
  },
  totals: { marginLeft: 'auto', width: 'min(280px, 100%)', display: 'flex', flexDirection: 'column', gap: 4 },
  totalRow: { display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13 },
  totalLabel: { color: 'var(--color-text-secondary)' },
  totalStrong: { fontWeight: 650 },
  card: {
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    background: 'var(--bg-surface-muted)',
  },
  lineTable: { width: '100%', borderCollapse: 'collapse', minWidth: 560 },
  num: { width: 90, textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  logo: { width: 72, height: 40, objectFit: 'contain', borderRadius: 4, background: '#fff' },
};

export function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}
