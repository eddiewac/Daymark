import { useEffect, useMemo, useRef, useState } from 'react';
import { localDateStr, todayStr } from '../../lib/utils.js';
import { describeImport, importLegacyJson } from '../../lib/legacyImport.js';

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

export default function ExportPanel({ tasks, projects, blocks, workspaceId, workspaceName }) {
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
                      <td key={j} style={{ ...styles.previewTd, fontWeight: 600, color: 'var(--accent)' }}>{c || ''}</td>
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

        <OutOfScopeExportSection tasks={tasks} projects={projects} />

        <ImportSection
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      </div>
    </div>
  );
}

// ── OutOfScopeExportSection: per-project rollup of out-of-scope tasks ──────
function OutOfScopeExportSection({ tasks, projects }) {
  const [msg, setMsg] = useState('');
  const oosFallbackRef = useRef(null);

  // Group OOS tasks by project, compute per-project totals
  const grouped = useMemo(() => {
    const byProject = {};
    let totalHours = 0;
    let totalCount = 0;
    for (const t of tasks || []) {
      if (!t.outOfScope) continue;
      const key = t.project || '(no project)';
      if (!byProject[key]) byProject[key] = { tasks: [], hours: 0 };
      byProject[key].tasks.push(t);
      const h = Number(t.outOfScopeHours);
      if (Number.isFinite(h)) byProject[key].hours += h;
      totalHours += Number.isFinite(h) ? h : 0;
      totalCount += 1;
    }
    // Sort: projects with most hours first
    const ordered = Object.entries(byProject)
      .map(([name, info]) => ({ name, ...info }))
      .sort((a, b) => b.hours - a.hours);
    return { byProject: ordered, totalHours, totalCount };
  }, [tasks]);

  const textReport = useMemo(() => {
    if (grouped.totalCount === 0) return '';
    const lines = [];
    lines.push(`Out-of-scope summary`);
    lines.push(`Generated ${new Date().toLocaleDateString()}`);
    lines.push(``);
    lines.push(
      `Total: ${grouped.totalCount} task${grouped.totalCount === 1 ? '' : 's'}` +
        (grouped.totalHours > 0 ? ` · ${grouped.totalHours} extra hours` : '')
    );
    lines.push(``);
    for (const p of grouped.byProject) {
      lines.push(`${p.name}`);
      lines.push('—'.repeat(40));
      if (p.hours > 0) {
        lines.push(
          `${p.tasks.length} task${p.tasks.length === 1 ? '' : 's'} · ${p.hours} hours`
        );
      } else {
        lines.push(`${p.tasks.length} task${p.tasks.length === 1 ? '' : 's'}`);
      }
      lines.push(``);
      for (const t of p.tasks) {
        const status = t.done ? ' (completed)' : '';
        const hours = t.outOfScopeHours ? ` [${t.outOfScopeHours}h]` : '';
        lines.push(`  • ${t.title}${hours}${status}`);
        if (t.outOfScopeNotes) lines.push(`      ${t.outOfScopeNotes}`);
      }
      lines.push(``);
    }
    return lines.join('\n');
  }, [grouped]);

  const csvReport = useMemo(() => {
    if (grouped.totalCount === 0) return '';
    const escape = (s) => {
      const v = String(s ?? '');
      if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const headers = [
      'Project',
      'Task',
      'Status',
      'Extra hours',
      'Scope notes',
      'Due date',
    ];
    const rows = [headers.map(escape).join(',')];
    for (const p of grouped.byProject) {
      for (const t of p.tasks) {
        rows.push(
          [
            p.name,
            t.title || '',
            t.done ? 'Completed' : (t.status || 'Open'),
            t.outOfScopeHours ?? '',
            t.outOfScopeNotes || '',
            t.dueDate || '',
          ]
            .map(escape)
            .join(',')
        );
      }
    }
    return rows.join('\n');
  }, [grouped]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(textReport);
      setMsg('Text report copied.');
      setTimeout(() => setMsg(''), 3000);
    } catch {
      oosFallbackRef.current?.select();
      setMsg('Auto-copy failed — select the box and copy manually.');
      setTimeout(() => setMsg(''), 5000);
    }
  };

  const downloadCsv = () => {
    const blob = new Blob([csvReport], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `daymark-out-of-scope-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMsg('CSV downloaded.');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Out-of-scope summary</div>
      <div style={styles.sectionSub}>
        Per-project rollup of tasks marked out of scope. Useful for billing
        variations or showing clients absorbed work.
      </div>

      {grouped.totalCount === 0 ? (
        <div style={oosExportStyles.empty}>
          No out-of-scope tasks in this workspace yet. Mark tasks as out of
          scope from the task form to see them here.
        </div>
      ) : (
        <>
          <div style={oosExportStyles.summary}>
            <strong>{grouped.totalCount}</strong> task
            {grouped.totalCount === 1 ? '' : 's'} across{' '}
            <strong>{grouped.byProject.length}</strong> project
            {grouped.byProject.length === 1 ? '' : 's'}
            {grouped.totalHours > 0 && (
              <>
                {' '}— <strong>{grouped.totalHours}</strong> extra hours estimated
              </>
            )}
          </div>

          <div style={oosExportStyles.btnRow}>
            <button onClick={copyText} style={oosExportStyles.btn}>
              📋 Copy text report
            </button>
            <button onClick={downloadCsv} style={oosExportStyles.btn}>
              ⬇ Download CSV
            </button>
            {msg && <span style={oosExportStyles.msg}>{msg}</span>}
          </div>

          <textarea
            ref={oosFallbackRef}
            value={textReport}
            readOnly
            rows={10}
            onClick={(e) => e.target.select()}
            style={oosExportStyles.preview}
          />
        </>
      )}
    </section>
  );
}

const oosExportStyles = {
  empty: {
    padding: 16,
    textAlign: 'center',
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
    background: 'var(--color-background-secondary)',
    borderRadius: 6,
  },
  summary: {
    fontSize: 12,
    color: 'var(--color-text-primary)',
    padding: 10,
    background: '#e24b4a11',
    border: '0.5px solid #e24b4a44',
    borderRadius: 8,
    lineHeight: 1.5,
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  btn: {
    padding: '6px 12px',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
    color: 'var(--color-text-primary)',
  },
  msg: {
    fontSize: 11,
    color: '#1d9e75',
    fontWeight: 500,
  },
  preview: {
    width: '100%',
    padding: 8,
    fontSize: 11,
    fontFamily: 'monospace',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
    resize: 'vertical',
    background: 'var(--color-background-secondary)',
    outline: 'none',
    lineHeight: 1.5,
  },
};

// ── ImportSection: restore from legacy JSON ────────────────────────────────
function ImportSection({ workspaceId, workspaceName }) {
  const [parsed, setParsed] = useState(null);
  const [filename, setFilename] = useState('');
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(null); // { imported, errors }
  const fileRef = useRef(null);

  const reset = () => {
    setParsed(null);
    setFilename('');
    setParseError('');
    setDone(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    setParseError('');
    setParsed(null);
    setDone(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        setParsed(data);
      } catch {
        setParseError('Could not parse JSON. Make sure the file is a valid Daymark export.');
      }
    };
    reader.onerror = () => setParseError('Could not read file.');
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    try {
      const result = await importLegacyJson(parsed, workspaceId);
      setDone(result);
    } catch (e) {
      setDone({
        imported: {},
        errors: [e.message || 'Import failed'],
      });
    } finally {
      setImporting(false);
    }
  };

  const reloadPage = () => {
    window.location.reload();
  };

  const summary = parsed ? describeImport(parsed) : null;

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Restore from legacy JSON</div>
      <div style={styles.sectionSub}>
        Import data from a legacy Daymark export. <strong>This replaces all
        tasks, projects, and notes in {workspaceName || 'this workspace'}</strong>{' '}
        with the contents of the file. Goals are imported as personal data.
        Time entries are not imported (the format changed).
      </div>

      {!parsed && !done && (
        <div style={importStyles.fileRow}>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFile}
            style={importStyles.fileInput}
          />
          {parseError && (
            <div style={importStyles.error}>{parseError}</div>
          )}
        </div>
      )}

      {parsed && !done && (
        <div style={importStyles.preview}>
          <div style={importStyles.previewTitle}>
            From {filename}:
          </div>
          <ul style={importStyles.list}>
            {summary.counts.tasks > 0 && (
              <li>{summary.counts.tasks} tasks</li>
            )}
            {summary.counts.projects > 0 && (
              <li>{summary.counts.projects} projects</li>
            )}
            {summary.counts.notes > 0 && (
              <li>{summary.counts.notes} notes</li>
            )}
            {summary.counts.categories > 0 && (
              <li>{summary.counts.categories} categories (settings)</li>
            )}
            {summary.counts.priorities > 0 && (
              <li>{summary.counts.priorities} priorities (settings)</li>
            )}
            {summary.counts.tagChecklists > 0 && (
              <li>{summary.counts.tagChecklists} tag checklists (settings)</li>
            )}
            {summary.counts.objectives > 0 && (
              <li>{summary.counts.objectives} goals (personal)</li>
            )}
          </ul>
          {summary.skipped.length > 0 && (
            <div style={importStyles.skipped}>
              <strong>Skipped:</strong>
              <ul style={importStyles.list}>
                {summary.skipped.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div style={importStyles.warning}>
            ⚠ This will replace existing tasks, projects, and notes in{' '}
            <strong>{workspaceName || 'this workspace'}</strong>. This cannot be undone.
          </div>
          <div style={importStyles.btnRow}>
            <button onClick={reset} style={importStyles.cancelBtn} disabled={importing}>
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              style={{
                ...importStyles.confirmBtn,
                opacity: importing ? 0.5 : 1,
                cursor: importing ? 'not-allowed' : 'pointer',
              }}
            >
              {importing ? 'Importing…' : 'Replace and import'}
            </button>
          </div>
        </div>
      )}

      {done && (
        <div style={importStyles.result}>
          <div style={importStyles.resultTitle}>Import complete</div>
          <ul style={importStyles.list}>
            {Object.entries(done.imported || {}).map(([k, n]) =>
              n > 0 ? (
                <li key={k}>
                  ✓ {n} {k}
                </li>
              ) : null
            )}
          </ul>
          {(done.errors || []).length > 0 && (
            <div style={importStyles.errorBlock}>
              <strong>Errors ({done.errors.length}):</strong>
              <ul style={importStyles.list}>
                {done.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {done.errors.length > 5 && (
                  <li>...and {done.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
          <div style={importStyles.btnRow}>
            <button onClick={reset} style={importStyles.cancelBtn}>
              Import another file
            </button>
            <button onClick={reloadPage} style={importStyles.confirmBtn}>
              Reload to see changes
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const styles = {
  wrap: {
    flex: 1,
    background: 'var(--bg-surface)',
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
    background: 'var(--bg-surface)',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
  },
  todayBtn: {
    padding: '4px 10px',
    background: 'var(--accent)',
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
    background: 'var(--bg-surface)',
    fontSize: 12,
  },
  weekLabel: { fontSize: 12, color: 'var(--color-text-secondary)' },
  primaryBtn: {
    padding: '7px 14px',
    background: 'var(--accent)',
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
    background: 'var(--bg-surface)',
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
    background: 'var(--accent)',
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
    color: 'var(--accent)',
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
    background: 'var(--bg-surface)',
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
    background: 'var(--accent-soft)',
    borderTop: '1px solid var(--accent-soft-border)',
  },
  fallback: {
    width: '100%',
    padding: 8,
    fontSize: 11,
    fontFamily: 'monospace',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
    resize: 'vertical',
    background: 'var(--bg-surface)',
    outline: 'none',
  },
};

const importStyles = {
  fileRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  fileInput: {
    padding: '8px',
    border: '0.5px dashed var(--color-border-primary)',
    borderRadius: 6,
    background: 'var(--bg-surface)',
    fontSize: 12,
  },
  error: {
    color: '#e24b4a',
    fontSize: 11,
    fontWeight: 500,
  },
  preview: {
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
  list: {
    margin: 0,
    paddingLeft: 18,
    fontSize: 11,
    color: 'var(--color-text-primary)',
    lineHeight: 1.6,
  },
  skipped: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    background: 'var(--color-background-secondary)',
    padding: 8,
    borderRadius: 6,
  },
  warning: {
    padding: 8,
    background: '#e24b4a11',
    border: '0.5px solid #e24b4a44',
    borderRadius: 6,
    fontSize: 11,
    color: '#e24b4a',
    lineHeight: 1.5,
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 11,
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '6px 14px',
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
  },
  result: {
    background: '#1d9e7511',
    border: '0.5px solid #1d9e7544',
    borderRadius: 8,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1d9e75',
  },
  errorBlock: {
    background: '#e24b4a11',
    padding: 8,
    borderRadius: 6,
    fontSize: 11,
    color: '#e24b4a',
  },
};
