import { useEffect, useMemo, useRef, useState } from 'react';
import { localDateStr, todayStr } from '../../lib/utils.js';

// ── Column definitions ─────────────────────────────────────────────────────
// Each "static" column maps to a string value computed per row.
// "day" columns expand to one column per day of the visible week.
const STATIC_COLUMNS = [
  { key: 'projectNumber', label: 'Project number', get: (r) => r.projectNumber || '' },
  { key: 'project',       label: 'Project name',   get: (r) => r.project || '' },
  { key: 'taskNumber',    label: 'Task number',    get: (r) => r.taskNumber || '' },
  { key: 'task',          label: 'Task name',      get: (r) => r.taskTitle || '' },
  { key: 'category',      label: 'Category',       get: (r) => r.category || '' },
  { key: 'expenditure',   label: 'Expenditure type', get: (r) => r.expenditureType || '' },
  { key: 'priority',      label: 'Priority',       get: (r) => r.priority || '' },
  { key: 'status',        label: 'Status',         get: (r) => r.status || '' },
];

// Default visible columns + order
const DEFAULT_LAYOUT = {
  visible: [
    'projectNumber',
    'project',
    'taskNumber',
    'task',
    'expenditure',
    'days',
    'total',
  ],
  // Hidden ones are still toggleable
  hidden: ['category', 'priority', 'status'],
};

const STORAGE_KEY = 'daymark-export-layout-v1';

// ── Helpers ────────────────────────────────────────────────────────────────
function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ExportPanel({ tasks, projects, blocks }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [showColumns, setShowColumns] = useState(false);
  const [msg, setMsg] = useState('');
  const fallbackRef = useRef(null);

  // Load saved layout
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.visible && saved?.hidden) setLayout(saved);
    } catch { /* ignore */ }
  }, []);

  const persistLayout = (next) => {
    setLayout(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  };

  const flash = (m, ms = 4000) => {
    setMsg(m);
    setTimeout(() => setMsg(''), ms);
  };

  // ── Build the row data for the visible week ───────────────────────────────
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const dayKeys = useMemo(() => days.map((d) => localDateStr(d)), [days]);
  const dayLabels = useMemo(
    () => days.map((d, i) => `${DAY_NAMES[i]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`),
    [days]
  );

  const rows = useMemo(() => {
    const dayKeySet = new Set(dayKeys);
    const map = {};
    for (const b of blocks) {
      if (!dayKeySet.has(b.date)) continue;
      if (!map[b.taskId]) {
        const t = tasks.find((x) => x.id === b.taskId);
        const proj = projects.find((p) => p.name === (t?.project || ''));
        map[b.taskId] = {
          taskId: b.taskId,
          taskTitle: t?.title || '(unknown task)',
          project: t?.project || '',
          projectNumber: proj?.number || '',
          taskNumber: t?.taskNumber || '',
          expenditureType: t?.expenditureType || '',
          category: t?.category || '',
          priority: t?.priority || '',
          status: t?.status || '',
          dailyHours: Object.fromEntries(dayKeys.map((d) => [d, 0])),
        };
      }
      map[b.taskId].dailyHours[b.date] += b.hours || 0;
    }
    return Object.values(map).sort((a, b) =>
      (a.project || '').localeCompare(b.project || '') ||
      (a.taskTitle || '').localeCompare(b.taskTitle || '')
    );
  }, [blocks, tasks, projects, dayKeys]);

  // ── Build TSV ─────────────────────────────────────────────────────────────
  const buildHeaderRow = () => {
    const cells = [];
    for (const colKey of layout.visible) {
      if (colKey === 'days') {
        for (const lbl of dayLabels) cells.push(lbl);
      } else if (colKey === 'total') {
        cells.push('Total');
      } else {
        const def = STATIC_COLUMNS.find((c) => c.key === colKey);
        if (def) cells.push(def.label);
      }
    }
    return cells;
  };

  const buildBodyRow = (r) => {
    const cells = [];
    for (const colKey of layout.visible) {
      if (colKey === 'days') {
        for (const dk of dayKeys) {
          const h = r.dailyHours[dk];
          cells.push(h > 0 ? h.toFixed(2) : '');
        }
      } else if (colKey === 'total') {
        const tot = Object.values(r.dailyHours).reduce((a, b) => a + b, 0);
        cells.push(tot > 0 ? tot.toFixed(2) : '');
      } else {
        const def = STATIC_COLUMNS.find((c) => c.key === colKey);
        cells.push(def ? def.get(r) : '');
      }
    }
    return cells;
  };

  const buildTotalsRow = () => {
    const cells = [];
    for (const colKey of layout.visible) {
      if (colKey === 'days') {
        for (const dk of dayKeys) {
          const s = rows.reduce((a, r) => a + r.dailyHours[dk], 0);
          cells.push(s > 0 ? s.toFixed(2) : '');
        }
      } else if (colKey === 'total') {
        const grand = rows.reduce(
          (a, r) =>
            a + Object.values(r.dailyHours).reduce((x, y) => x + y, 0),
          0
        );
        cells.push(grand > 0 ? grand.toFixed(2) : '');
      } else if (colKey === layout.visible[0]) {
        cells.push('TOTAL');
      } else {
        cells.push('');
      }
    }
    return cells;
  };

  const buildTSV = () => {
    const header = buildHeaderRow().join('\t');
    const body = rows.map((r) => buildBodyRow(r).join('\t'));
    const totals = buildTotalsRow().join('\t');
    return [header, ...body, totals].join('\n');
  };

  const tsvText = useMemo(buildTSV, [rows, dayKeys, dayLabels, layout]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const doCopy = async () => {
    if (!rows.length) {
      flash('No time entries for this week.');
      return;
    }
    try {
      await navigator.clipboard.writeText(tsvText);
      flash('Copied! Paste into Excel with Ctrl+V / Cmd+V.', 5000);
    } catch {
      fallbackRef.current?.select();
      flash('Auto-copy failed — click the box, Ctrl+A then Ctrl+C.', 7000);
    }
  };

  const goPrev = () => setWeekStart(addDays(weekStart, -7));
  const goNext = () => setWeekStart(addDays(weekStart, 7));
  const goToday = () => setWeekStart(startOfWeek(new Date()));

  // ── Layout editing actions ────────────────────────────────────────────────
  const toggleColumn = (key) => {
    if (key === 'days' || key === 'total') return; // these are required
    if (layout.visible.includes(key)) {
      persistLayout({
        visible: layout.visible.filter((k) => k !== key),
        hidden: [...layout.hidden, key],
      });
    } else {
      persistLayout({
        visible: [...layout.visible, key],
        hidden: layout.hidden.filter((k) => k !== key),
      });
    }
  };

  const moveColumn = (key, dir) => {
    const idx = layout.visible.indexOf(key);
    if (idx < 0) return;
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= layout.visible.length) return;
    const next = [...layout.visible];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    persistLayout({ ...layout, visible: next });
  };

  const resetLayout = () => persistLayout(DEFAULT_LAYOUT);

  return (
    <div style={styles.wrap}>
      <div style={styles.scroll}>
        {/* Toolbar */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Weekly export</div>
          <div style={styles.sectionSub}>
            Pick a week, customise the columns if you want, then click Copy.
            Paste into Excel or any spreadsheet.
          </div>
          <div style={styles.toolbar}>
            <button onClick={goPrev} style={styles.navBtn}>‹</button>
            <button onClick={goToday} style={styles.todayBtn}>This week</button>
            <button onClick={goNext} style={styles.navBtn}>›</button>
            <input
              type="date"
              value={localDateStr(weekStart)}
              onChange={(e) => setWeekStart(startOfWeek(new Date(e.target.value)))}
              style={styles.dateInput}
            />
            <span style={styles.weekLabel}>
              {weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              {' – '}
              {addDays(weekStart, 6).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setShowColumns((v) => !v)}
              style={styles.secondaryBtn}
            >
              {showColumns ? 'Done' : 'Customise columns'}
            </button>
            <button onClick={doCopy} style={styles.primaryBtn}>
              📋 Copy for Excel
            </button>
          </div>
          {msg && <div style={styles.flash}>{msg}</div>}
        </section>

        {/* Column customiser */}
        {showColumns && (
          <section style={styles.section}>
            <div style={styles.sectionTitle}>Columns</div>
            <div style={styles.sectionSub}>
              Toggle visibility, drag/move to reorder. Day columns and Total are always included.
            </div>
            <div style={styles.colsRow}>
              <div style={styles.colsCol}>
                <div style={styles.colsHeader}>Visible (in order)</div>
                <div style={styles.colsList}>
                  {layout.visible.map((key, i) => {
                    const def = STATIC_COLUMNS.find((c) => c.key === key);
                    const label =
                      key === 'days' ? 'Daily hours (Mon–Sun)' :
                      key === 'total' ? 'Total' :
                      def?.label || key;
                    const isLocked = key === 'days' || key === 'total';
                    return (
                      <div key={key} style={styles.colsItem}>
                        <button
                          onClick={() => moveColumn(key, 'up')}
                          disabled={i === 0}
                          style={{ ...styles.iconBtn, opacity: i === 0 ? 0.3 : 1 }}
                          title="Move up"
                        >↑</button>
                        <button
                          onClick={() => moveColumn(key, 'down')}
                          disabled={i === layout.visible.length - 1}
                          style={{ ...styles.iconBtn, opacity: i === layout.visible.length - 1 ? 0.3 : 1 }}
                          title="Move down"
                        >↓</button>
                        <span style={styles.colLabel}>{label}</span>
                        {!isLocked && (
                          <button
                            onClick={() => toggleColumn(key)}
                            style={styles.removeBtn}
                            title="Hide column"
                          >×</button>
                        )}
                        {isLocked && <span style={styles.lockedBadge}>required</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={styles.colsCol}>
                <div style={styles.colsHeader}>Available</div>
                <div style={styles.colsList}>
                  {layout.hidden.length === 0 ? (
                    <div style={styles.colsEmpty}>All columns visible.</div>
                  ) : layout.hidden.map((key) => {
                    const def = STATIC_COLUMNS.find((c) => c.key === key);
                    return (
                      <div key={key} style={styles.colsItem}>
                        <button
                          onClick={() => toggleColumn(key)}
                          style={styles.addBtn}
                          title="Add column"
                        >+</button>
                        <span style={styles.colLabel}>{def?.label || key}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <button onClick={resetLayout} style={styles.linkBtn}>
              Reset to default
            </button>
          </section>
        )}

        {/* Preview */}
        <section style={styles.section}>
          <div style={styles.sectionTitle}>
            Preview
            {rows.length > 0 && (
              <span style={styles.sectionMeta}>
                · {rows.length} task{rows.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {rows.length === 0 ? (
            <div style={styles.empty}>
              No time entries for this week. Log some hours in the Timesheet tab first.
            </div>
          ) : (
            <div style={styles.previewScroll}>
              <table style={styles.previewTable}>
                <thead>
                  <tr>
                    {buildHeaderRow().map((h, i) => (
                      <th key={i} style={styles.previewTh}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const cells = buildBodyRow(r);
                    return (
                      <tr key={i} style={i % 2 === 0 ? {} : styles.zebraRow}>
                        {cells.map((c, j) => (
                          <td key={j} style={styles.previewTd}>{c || '—'}</td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr style={styles.totalsRow}>
                    {buildTotalsRow().map((c, j) => (
                      <td key={j} style={{ ...styles.previewTd, fontWeight: 600, color: '#534AB7' }}>{c || ''}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Fallback */}
        {rows.length > 0 && (
          <section style={styles.section}>
            <div style={styles.sectionTitle}>Manual copy (fallback)</div>
            <div style={styles.sectionSub}>
              If "Copy for Excel" doesn't work, click the box, Ctrl+A then Ctrl+C.
            </div>
            <textarea
              ref={fallbackRef}
              value={tsvText}
              readOnly
              rows={6}
              style={styles.fallback}
              onClick={(e) => e.target.select()}
            />
          </section>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    flex: 1,
    background: '#fff',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  scroll: { flex: 1, overflowY: 'auto', padding: 14 },
  section: {
    background: 'var(--color-background-secondary)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginBottom: 10,
  },
  sectionMeta: {
    fontSize: 11,
    fontWeight: 400,
    color: 'var(--color-text-secondary)',
    marginLeft: 6,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  navBtn: {
    width: 28,
    height: 28,
    border: '0.5px solid var(--color-border-secondary)',
    background: '#fff',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
  },
  todayBtn: {
    padding: '4px 10px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  dateInput: {
    padding: '4px 8px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: '#fff',
    fontSize: 12,
  },
  weekLabel: { fontSize: 12, color: 'var(--color-text-secondary)' },
  primaryBtn: {
    padding: '7px 14px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '7px 14px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 8,
    fontSize: 12,
    cursor: 'pointer',
  },
  flash: {
    fontSize: 12,
    color: '#1d9e75',
    marginTop: 8,
    fontWeight: 500,
  },
  colsRow: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
  },
  colsCol: {
    flex: 1,
    minWidth: 240,
  },
  colsHeader: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  colsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  colsItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    background: '#fff',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
  },
  colsEmpty: {
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
    padding: 8,
  },
  colLabel: { flex: 1, fontSize: 12 },
  iconBtn: {
    width: 20,
    height: 20,
    background: 'transparent',
    border: 'none',
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    borderRadius: 4,
    cursor: 'pointer',
  },
  addBtn: {
    width: 22,
    height: 22,
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    fontSize: 13,
    borderRadius: 4,
    cursor: 'pointer',
  },
  removeBtn: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    fontSize: 14,
    color: '#e24b4a',
    borderRadius: 4,
    cursor: 'pointer',
  },
  lockedBadge: {
    fontSize: 9,
    padding: '1px 6px',
    background: 'var(--color-background-secondary)',
    color: 'var(--color-text-tertiary)',
    borderRadius: 8,
  },
  linkBtn: {
    marginTop: 8,
    background: 'transparent',
    border: 'none',
    color: '#534AB7',
    fontSize: 11,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
  empty: {
    padding: 16,
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  previewScroll: { overflowX: 'auto' },
  previewTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 11,
    minWidth: 600,
  },
  previewTh: {
    padding: '6px 8px',
    textAlign: 'left',
    borderBottom: '0.5px solid var(--color-border-secondary)',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    background: '#fff',
    whiteSpace: 'nowrap',
  },
  previewTd: {
    padding: '5px 8px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    color: 'var(--color-text-primary)',
    whiteSpace: 'nowrap',
  },
  zebraRow: { background: '#fafafa' },
  totalsRow: {
    background: '#534AB711',
    borderTop: '1px solid #534AB744',
  },
  fallback: {
    width: '100%',
    padding: 8,
    fontSize: 11,
    fontFamily: 'monospace',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
    resize: 'vertical',
    background: '#fff',
    outline: 'none',
  },
};
