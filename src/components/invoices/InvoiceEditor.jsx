import { useMemo, useState } from 'react';
import { uid } from '../../lib/utils.js';
import {
  availableFixedFees,
  buildTimeLines,
  formatMoney,
  invoiceDisplayStatus,
  lineCents,
  newFixedFeeLine,
  newManualLine,
  timeIdsOnLines,
} from '../../lib/invoiceModel.js';
import { Field, InvoiceTotals, StatusPill, styles } from './invoiceUi.jsx';

export default function InvoiceEditor({
  draft,
  projects,
  tasks,
  clients,
  seller,
  allLines,
  today,
  busy,
  error,
  onChange,
  onSave,
  onDelete,
  onStatus,
  onDownload,
  onEmail,
  onBack,
  onCreateClient,
  onLoadUnbilled,
  onEditSeller,
}) {
  const locked = draft.status && draft.status !== 'draft';
  const displayStatus = invoiceDisplayStatus(draft, today);
  const project = projects.find((item) => item.id === draft.projectId) || null;
  const [pull, setPull] = useState(null);
  const [addingClient, setAddingClient] = useState(false);

  const fixedFees = useMemo(
    () => availableFixedFees(project, [...(allLines || []), ...(draft.lines || [])]),
    [project, allLines, draft.lines]
  );

  const setLines = (lines) => onChange({ lines });

  const updateLine = (index, patch) => {
    setLines(draft.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.scroll}>
        <button type="button" style={styles.back} onClick={onBack}>← Invoices</button>
        <div style={styles.head}>
          <div style={styles.titleBlock}>
            <h2 style={styles.title}>{draft.invoiceNumber || 'New invoice'}</h2>
            <p style={styles.sub}>
              {locked
                ? 'Lines are locked. Download the PDF again, or return this to a draft to edit it.'
                : 'A draft until you mark it sent. Due date defaults to 14 days.'}
            </p>
          </div>
          <div style={styles.actions}>
            <StatusPill status={displayStatus} />
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.grid}>
          <Field label="Project">
            <select
              value={draft.projectId || ''}
              disabled={locked || !!draft.id || busy}
              onChange={(e) => onChange({
                projectId: e.target.value,
                lines: (draft.lines || []).filter((line) => !line.sourceType || line.sourceType === 'manual'),
              })}
              style={styles.field}
            >
              <option value="">Choose a project</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>{item.name || 'Untitled project'}</option>
              ))}
            </select>
          </Field>
          <Field label="Client">
            <select
              value={draft.clientId || ''}
              disabled={locked || busy}
              onChange={(e) => {
                if (e.target.value === '__new') {
                  setAddingClient(true);
                  return;
                }
                onChange({ clientId: e.target.value });
              }}
              style={styles.field}
            >
              <option value="">Choose a client</option>
              {clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.company ? `${item.name} · ${item.company}` : item.name}
                </option>
              ))}
              {!locked && <option value="__new">New client…</option>}
            </select>
          </Field>
          <Field label="Invoice date">
            <input
              type="date"
              value={draft.invoiceDate || ''}
              disabled={locked || busy}
              onChange={(e) => onChange({ invoiceDate: e.target.value })}
              style={styles.field}
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={draft.dueDate || ''}
              disabled={locked || busy}
              onChange={(e) => onChange({ dueDate: e.target.value })}
              style={styles.field}
            />
          </Field>
          <Field label="Currency">
            <input
              value={draft.currency || 'AUD'}
              disabled={locked || busy}
              maxLength={3}
              onChange={(e) => onChange({ currency: e.target.value.toUpperCase() })}
              style={styles.field}
            />
          </Field>
        </div>

        <label style={styles.check}>
          <input
            type="checkbox"
            checked={!!draft.gstEnabled}
            disabled={locked || busy}
            onChange={(e) => onChange({ gstEnabled: e.target.checked })}
          />
          <span>
            Add 10% GST
            <span style={{ ...styles.hint, display: 'block' }}>
              Leave this off if you are not registered. The rate stays 10% even if the currency is not AUD.
            </span>
          </span>
        </label>

        {(addingClient || clients.length === 0) && !locked && (
          <ClientQuickAdd
            busy={busy}
            onCancel={clients.length ? () => setAddingClient(false) : null}
            onCreate={async (fields) => {
              const result = await onCreateClient(fields);
              if (result?.ok) {
                onChange({ clientId: result.client.id });
                setAddingClient(false);
              }
              return result;
            }}
          />
        )}

        <h3 style={styles.sectionTitle}>Lines</h3>
        <div style={styles.tableWrap}>
          <table style={styles.lineTable}>
            <thead>
              <tr>
                <th style={styles.th}>Description</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Qty</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Rate</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                <th style={styles.th} />
              </tr>
            </thead>
            <tbody>
              {(draft.lines || []).length === 0 && (
                <tr>
                  <td style={styles.td} colSpan={5}>No lines yet.</td>
                </tr>
              )}
              {(draft.lines || []).map((line, index) => (
                <tr key={line.id || index}>
                  <td style={styles.td}>
                    <input
                      value={line.description}
                      disabled={locked || busy}
                      maxLength={500}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      style={styles.field}
                      aria-label="Line description"
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.quantity}
                      disabled={locked || busy}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
                      style={{ ...styles.field, ...styles.num }}
                      aria-label="Quantity"
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitAmount}
                      disabled={locked || busy}
                      onChange={(e) => updateLine(index, { unitAmount: e.target.value })}
                      style={{ ...styles.field, ...styles.num }}
                      aria-label="Rate"
                    />
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{formatMoney(lineCents(line))}</td>
                  <td style={styles.td}>
                    {!locked && (
                      <button
                        type="button"
                        style={styles.ghost}
                        disabled={busy}
                        onClick={() => setLines(draft.lines.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!locked && (
          <div style={{ ...styles.actions, marginTop: 10 }}>
            <button
              type="button"
              style={styles.ghost}
              disabled={busy}
              onClick={() => setLines([...(draft.lines || []), { ...newManualLine(), id: uid() }])}
            >
              Add line
            </button>
            <button
              type="button"
              style={styles.ghost}
              disabled={busy || !project}
              onClick={() => setPull(pull === 'time' ? null : 'time')}
            >
              Add unbilled time
            </button>
            <button
              type="button"
              style={styles.ghost}
              disabled={busy || !project}
              onClick={() => setPull(pull === 'fee' ? null : 'fee')}
            >
              Add deliverable
            </button>
          </div>
        )}

        {pull === 'time' && !locked && (
          <TimePull
            project={project}
            tasks={tasks}
            lines={draft.lines}
            busy={busy}
            onLoadUnbilled={onLoadUnbilled}
            onAdd={(next) => {
              setLines([...(draft.lines || []), ...next.map((line) => ({ ...line, id: uid() }))]);
              setPull(null);
            }}
          />
        )}
        {pull === 'fee' && !locked && (
          <FeePull
            fees={fixedFees}
            busy={busy}
            onAdd={(next) => {
              setLines([...(draft.lines || []), ...next.map((line) => ({ ...line, id: uid() }))]);
              setPull(null);
            }}
          />
        )}

        <div style={{ marginTop: 16 }}>
          <InvoiceTotals lines={draft.lines} gstEnabled={draft.gstEnabled} currency={draft.currency} />
        </div>

        <div style={{ marginTop: 16 }}>
          <Field label="Note to the client (optional)">
            <textarea
              value={draft.notes || ''}
              disabled={locked || busy}
              maxLength={2000}
              onChange={(e) => onChange({ notes: e.target.value })}
              style={{ ...styles.field, ...styles.area }}
            />
          </Field>
        </div>

        {!seller?.paymentInstructions && (
          <p style={{ ...styles.hint, marginTop: 12 }}>
            Add payment instructions in{' '}
            <button type="button" style={{ ...styles.back, marginBottom: 0, display: 'inline' }} onClick={onEditSeller}>Your details</button>
            {' '}so the client knows how to pay you.
          </p>
        )}

        <div style={{ ...styles.actions, marginTop: 18 }}>
          {!locked && (
            <button type="button" style={styles.primary} disabled={busy} onClick={onSave}>Save draft</button>
          )}
          <button type="button" style={styles.ghost} disabled={busy} onClick={onDownload}>Download PDF</button>
          <button type="button" style={styles.ghost} disabled={busy} onClick={onEmail}>Email client</button>
          {draft.status === 'draft' && (
            <button type="button" style={{ ...styles.ghost, ...((busy || !draft.id) ? styles.off : {}) }} disabled={busy || !draft.id} onClick={() => onStatus('sent')}>
              Mark sent
            </button>
          )}
          {draft.status !== 'paid' && (
            <button type="button" style={{ ...styles.ghost, ...((busy || !draft.id) ? styles.off : {}) }} disabled={busy || !draft.id} onClick={() => onStatus('paid')}>
              Mark paid
            </button>
          )}
          {draft.status === 'paid' && (
            <button type="button" style={styles.ghost} disabled={busy} onClick={() => onStatus('sent')}>
              Mark unpaid
            </button>
          )}
          {draft.status === 'sent' && (
            <button type="button" style={styles.ghost} disabled={busy} onClick={() => onStatus('draft')}>
              Return to draft
            </button>
          )}
          {draft.status === 'draft' && draft.id && (
            <button type="button" style={styles.danger} disabled={busy} onClick={onDelete}>
              Delete draft
            </button>
          )}
        </div>
        <p style={{ ...styles.hint, marginTop: 10 }}>
          Email opens in your mail app with the PDF already downloaded. Attach that file before you send.
          Daymark does not send the email.
        </p>
      </div>
    </div>
  );
}

function ClientQuickAdd({ busy, onCancel, onCreate }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  return (
    <form
      style={styles.card}
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        const result = await onCreate({ name, company, email, address });
        if (result && !result.ok) setError(result.error || 'Could not save client');
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 8 }}>New client</div>
      {error && <div style={styles.error}>{error}</div>}
      <div style={styles.grid}>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={styles.field} maxLength={200} required />
        </Field>
        <Field label="Company">
          <input value={company} onChange={(e) => setCompany(e.target.value)} style={styles.field} maxLength={200} />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.field} maxLength={200} />
        </Field>
        <Field label="Address">
          <input value={address} onChange={(e) => setAddress(e.target.value)} style={styles.field} maxLength={500} />
        </Field>
      </div>
      <div style={{ ...styles.actions, marginTop: 10 }}>
        <button type="submit" style={styles.primary} disabled={busy}>Save client</button>
        {onCancel && (
          <button type="button" style={styles.ghost} onClick={onCancel}>Cancel</button>
        )}
      </div>
    </form>
  );
}

function TimePull({ project, tasks, lines, busy, onLoadUnbilled, onAdd }) {
  const [rate, setRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blocks, setBlocks] = useState(null);
  const [picked, setPicked] = useState({});

  const load = async () => {
    setLoading(true);
    setError('');
    const result = await onLoadUnbilled(project, tasks);
    setLoading(false);
    if (!result?.ok) {
      setError(result?.error || 'Could not load time');
      setBlocks([]);
      return;
    }
    setBlocks(result.blocks || []);
    const groups = buildTimeLines({
      blocks: result.blocks || [],
      tasks,
      project,
      hourlyRate: rate,
      excludeIds: timeIdsOnLines(lines),
    });
    const next = {};
    for (const group of groups) next[group.sourceId] = true;
    setPicked(next);
  };

  const groups = blocks
    ? buildTimeLines({ blocks, tasks, project, hourlyRate: rate, excludeIds: timeIdsOnLines(lines) })
    : [];

  return (
    <div style={styles.card}>
      <div style={{ fontSize: 13, fontWeight: 650 }}>Unbilled time on this project</div>
      <p style={styles.hint}>Hours already on an invoice are hidden. Set your hourly rate, then add the tasks you want.</p>
      <div style={{ ...styles.grid, marginTop: 8 }}>
        <Field label="Hourly rate">
          <input
            type="number"
            min="0"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            style={styles.field}
          />
        </Field>
      </div>
      {error && <div style={styles.error}>{error}</div>}
      {blocks == null ? (
        <button type="button" style={{ ...styles.primary, marginTop: 8 }} disabled={busy || loading} onClick={load}>
          {loading ? 'Loading…' : 'Show unbilled time'}
        </button>
      ) : groups.length === 0 ? (
        <p style={styles.hint}>No unbilled time on this project.</p>
      ) : (
        <>
          {groups.map((group) => (
            <label key={group.sourceId} style={{ ...styles.check, marginTop: 6 }}>
              <input
                type="checkbox"
                checked={!!picked[group.sourceId]}
                onChange={(e) => setPicked((prev) => ({ ...prev, [group.sourceId]: e.target.checked }))}
              />
              <span>{group.description} · {Number(group.quantity).toFixed(2)} h</span>
            </label>
          ))}
          <button
            type="button"
            style={{ ...styles.primary, marginTop: 8 }}
            disabled={busy}
            onClick={() => {
              const next = groups.filter((group) => picked[group.sourceId]).map((group) => ({
                ...group,
                unitAmount: rate,
              }));
              if (next.length === 0) return;
              onAdd(next);
            }}
          >
            Add selected time
          </button>
        </>
      )}
    </div>
  );
}

function FeePull({ fees, busy, onAdd }) {
  const [amounts, setAmounts] = useState({});
  const [picked, setPicked] = useState({});
  const deliverables = fees?.deliverables || [];
  const stations = fees?.stations || [];

  const selected = () => {
    const lines = [];
    const deliverableIds = new Set();
    for (const item of deliverables) {
      if (!picked[`d:${item.id}`]) continue;
      deliverableIds.add(item.id);
      lines.push(newFixedFeeLine({ ...item, kind: 'deliverable' }, amounts[item.id] || 0));
    }
    for (const item of stations) {
      if (!picked[`s:${item.id}`]) continue;
      if (deliverableIds.has(item.deliverableId)) continue;
      lines.push(newFixedFeeLine({ ...item, kind: 'station' }, amounts[item.id] || 0));
    }
    return lines;
  };

  if (deliverables.length === 0 && stations.length === 0) {
    return (
      <div style={styles.card}>
        <p style={styles.hint}>No deliverables or stations left to bill on this project.</p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={{ fontSize: 13, fontWeight: 650 }}>Fixed fee</div>
      <p style={styles.hint}>
        Bill a whole deliverable, or a station on its own. Once a deliverable is on an invoice, its stations are not offered again.
      </p>
      {deliverables.map((item) => (
        <FeeRow
          key={item.id}
          label={item.name}
          amount={amounts[item.id] || ''}
          checked={!!picked[`d:${item.id}`]}
          onCheck={(checked) => setPicked((prev) => ({ ...prev, [`d:${item.id}`]: checked }))}
          onAmount={(value) => setAmounts((prev) => ({ ...prev, [item.id]: value }))}
        />
      ))}
      {stations.map((item) => (
        <FeeRow
          key={item.id}
          label={`${item.deliverableName} — ${item.name}`}
          amount={amounts[item.id] || ''}
          checked={!!picked[`s:${item.id}`]}
          onCheck={(checked) => setPicked((prev) => ({ ...prev, [`s:${item.id}`]: checked }))}
          onAmount={(value) => setAmounts((prev) => ({ ...prev, [item.id]: value }))}
        />
      ))}
      <button
        type="button"
        style={{ ...styles.primary, marginTop: 8 }}
        disabled={busy}
        onClick={() => {
          const next = selected();
          if (next.length === 0) return;
          onAdd(next);
        }}
      >
        Add selected fees
      </button>
    </div>
  );
}

function FeeRow({ label, amount, checked, onCheck, onAmount }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
      <label style={{ ...styles.check, marginTop: 0, flex: 1, minWidth: 180 }}>
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} />
        <span>{label}</span>
      </label>
      <input
        type="number"
        min="0"
        step="0.01"
        placeholder="Amount"
        aria-label={`Amount for ${label}`}
        value={amount}
        onChange={(e) => onAmount(e.target.value)}
        style={{ ...styles.field, maxWidth: 120 }}
      />
    </div>
  );
}
