import { useMemo, useState } from 'react';
import {
  CONGRESS_SUGGESTIONS,
  THERAPY_AREAS,
  TA_COLORS,
} from '../../lib/congressSuggestions.js';

const BLANK_CONGRESS = {
  name: '',
  abbr: '',
  ta: '',
  color: '#534AB7',
  location: '',
  startDate: '',
  endDate: '',
  abstractDeadline: '',
  lateBreakingDeadline: '',
  sourceVerified: false,
  fromSuggestion: false,
};

export default function CongressesPanel({
  congresses,
  loading,
  workspaceId,
  workspaceName,
  onAdd,
  onEdit,
  onRemove,
}) {
  const [filterTA, setFilterTA] = useState('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [form, setForm] = useState(BLANK_CONGRESS);

  // Filter + search
  const filtered = useMemo(() => {
    let list = congresses;
    if (filterTA !== 'all') list = list.filter((c) => c.ta === filterTA);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          c.abbr.toLowerCase().includes(s) ||
          c.location.toLowerCase().includes(s) ||
          c.ta.toLowerCase().includes(s)
      );
    }
    return list.sort((a, b) => {
      // Sort by start date asc, no-date last
      if (a.startDate && !b.startDate) return -1;
      if (!a.startDate && b.startDate) return 1;
      if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
      return a.name.localeCompare(b.name);
    });
  }, [congresses, filterTA, search]);

  // List of TAs that have at least one congress (for filter buttons)
  const presentTAs = useMemo(
    () => [...new Set(congresses.map((c) => c.ta).filter(Boolean))].sort(),
    [congresses]
  );

  // ── Form actions ──────────────────────────────────────────────────────────
  const openNewBlank = () => {
    setForm(BLANK_CONGRESS);
    setEditingId(null);
    setShowAdd(true);
    setShowSuggestions(false);
  };

  const openSuggestions = () => {
    setForm(BLANK_CONGRESS);
    setEditingId(null);
    setShowAdd(true);
    setShowSuggestions(true);
  };

  const startEdit = (c) => {
    setForm({
      name: c.name,
      abbr: c.abbr,
      ta: c.ta,
      color: c.color,
      location: c.location,
      startDate: c.startDate,
      endDate: c.endDate,
      abstractDeadline: c.abstractDeadline,
      lateBreakingDeadline: c.lateBreakingDeadline,
      sourceVerified: c.sourceVerified,
      fromSuggestion: c.fromSuggestion,
    });
    setEditingId(c.id);
    setShowAdd(true);
    setShowSuggestions(false);
  };

  const cancel = () => {
    setShowAdd(false);
    setEditingId(null);
    setForm(BLANK_CONGRESS);
    setShowSuggestions(false);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await onEdit(editingId, form);
    } else {
      await onAdd(form);
    }
    cancel();
  };

  const pickSuggestion = (s) => {
    // Pre-fill form with suggestion data, then user can tweak before saving
    setForm({
      ...BLANK_CONGRESS,
      ...s,
      fromSuggestion: true,
    });
    setShowSuggestions(false);
  };

  // Already-used suggestion abbrs (so we don't show ones already added)
  const usedAbbrs = useMemo(
    () => new Set(congresses.map((c) => c.abbr).filter(Boolean)),
    [congresses]
  );

  return (
    <div style={styles.wrap}>
      <div style={styles.scroll}>
        {/* Header */}
        <div style={styles.intro}>
          <div style={styles.introTitle}>
            Congress calendar · {workspaceName || 'Personal'}
          </div>
          <div style={styles.introSub}>
            Track upcoming medical congresses with abstract deadlines. Linked
            congresses appear as markers on your project Gantt charts.
          </div>
        </div>

        {/* Toolbar */}
        <div style={styles.toolbar}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, abbreviation, TA…"
            style={styles.searchInput}
          />
          <button onClick={openSuggestions} style={styles.secondaryBtn}>
            + Pick from common congresses
          </button>
          <button onClick={openNewBlank} style={styles.primaryBtn}>
            + Add custom
          </button>
        </div>

        {/* TA filter chips */}
        {presentTAs.length > 0 && (
          <div style={styles.filterRow}>
            <button
              onClick={() => setFilterTA('all')}
              style={{
                ...styles.filterChip,
                ...(filterTA === 'all' ? styles.filterChipActive : {}),
              }}
            >
              All ({congresses.length})
            </button>
            {presentTAs.map((ta) => {
              const count = congresses.filter((c) => c.ta === ta).length;
              const color = TA_COLORS[ta] || '#666';
              const isActive = filterTA === ta;
              return (
                <button
                  key={ta}
                  onClick={() => setFilterTA(ta)}
                  style={{
                    ...styles.filterChip,
                    ...(isActive
                      ? {
                          background: color + '22',
                          color,
                          borderColor: color + '44',
                          fontWeight: 500,
                        }
                      : {}),
                  }}
                >
                  {ta} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Add / edit form */}
        {showAdd && (
          <CongressForm
            form={form}
            setForm={setForm}
            editingId={editingId}
            showSuggestions={showSuggestions}
            setShowSuggestions={setShowSuggestions}
            onSave={save}
            onCancel={cancel}
            onPickSuggestion={pickSuggestion}
            usedAbbrs={usedAbbrs}
          />
        )}

        {/* List */}
        {loading ? (
          <div style={styles.empty}>Loading…</div>
        ) : congresses.length === 0 && !showAdd ? (
          <div style={styles.emptyBig}>
            <div style={styles.emptyTitle}>No congresses yet</div>
            <div style={styles.emptyHint}>
              Add congresses to start tracking abstract deadlines and meeting dates.
            </div>
            <button onClick={openSuggestions} style={styles.primaryBtnLarge}>
              Pick from common congresses
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>
            No congresses match your filter or search.
          </div>
        ) : (
          <div style={styles.list}>
            {filtered.map((c) => (
              <CongressCard
                key={c.id}
                congress={c}
                onEdit={() => startEdit(c)}
                onRemove={() => onRemove(c.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CongressForm ────────────────────────────────────────────────────────────
function CongressForm({
  form,
  setForm,
  editingId,
  showSuggestions,
  setShowSuggestions,
  onSave,
  onCancel,
  onPickSuggestion,
  usedAbbrs,
}) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div style={formStyles.wrap}>
      <div style={formStyles.header}>
        <div style={formStyles.title}>
          {editingId ? 'Edit congress' : 'Add congress'}
        </div>
        <button onClick={onCancel} style={formStyles.closeBtn}>
          ×
        </button>
      </div>

      {!editingId && (
        <button
          onClick={() => setShowSuggestions((v) => !v)}
          style={formStyles.toggleSuggestions}
        >
          {showSuggestions ? 'Hide suggestions' : 'Pick from common congresses'}
        </button>
      )}

      {showSuggestions && (
        <div style={formStyles.suggestionList}>
          {CONGRESS_SUGGESTIONS.map((s) => {
            const used = usedAbbrs.has(s.abbr);
            const color = TA_COLORS[s.ta] || '#666';
            return (
              <button
                key={s.abbr}
                onClick={() => !used && onPickSuggestion(s)}
                disabled={used}
                style={{
                  ...formStyles.suggestionBtn,
                  borderColor: color + '44',
                  background: used ? 'var(--color-background-secondary)' : '#fff',
                  opacity: used ? 0.5 : 1,
                  cursor: used ? 'not-allowed' : 'pointer',
                }}
                title={used ? 'Already added' : ''}
              >
                <span
                  style={{
                    ...formStyles.suggestionDot,
                    background: color,
                  }}
                />
                <div style={formStyles.suggestionText}>
                  <div style={formStyles.suggestionName}>{s.abbr}</div>
                  <div style={formStyles.suggestionTa}>{s.ta}</div>
                </div>
                {s.startDate && (
                  <span style={formStyles.suggestionDate}>
                    {fmtMonth(s.startDate)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!showSuggestions && (
        <div style={formStyles.fields}>
          <div style={formStyles.row2}>
            <div style={formStyles.field}>
              <label style={formStyles.label}>Name *</label>
              <input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="ASCO Annual Meeting"
                style={formStyles.input}
              />
            </div>
            <div style={formStyles.field}>
              <label style={formStyles.label}>Abbreviation</label>
              <input
                value={form.abbr}
                onChange={(e) => set({ abbr: e.target.value })}
                placeholder="ASCO"
                style={formStyles.input}
              />
            </div>
          </div>

          <div style={formStyles.row2}>
            <div style={formStyles.field}>
              <label style={formStyles.label}>Therapy area</label>
              <select
                value={form.ta}
                onChange={(e) => {
                  const newTa = e.target.value;
                  const newColor = TA_COLORS[newTa] || form.color;
                  set({ ta: newTa, color: newColor });
                }}
                style={formStyles.input}
              >
                <option value="">—</option>
                {THERAPY_AREAS.map((ta) => (
                  <option key={ta} value={ta}>{ta}</option>
                ))}
              </select>
            </div>
            <div style={formStyles.field}>
              <label style={formStyles.label}>Colour</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => set({ color: e.target.value })}
                style={{ ...formStyles.input, padding: 2, height: 32 }}
              />
            </div>
          </div>

          <div style={formStyles.field}>
            <label style={formStyles.label}>Location</label>
            <input
              value={form.location}
              onChange={(e) => set({ location: e.target.value })}
              placeholder="Chicago, IL — McCormick Place"
              style={formStyles.input}
            />
          </div>

          <div style={formStyles.row2}>
            <div style={formStyles.field}>
              <label style={formStyles.label}>Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => set({ startDate: e.target.value })}
                style={formStyles.input}
              />
            </div>
            <div style={formStyles.field}>
              <label style={formStyles.label}>End date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => set({ endDate: e.target.value })}
                style={formStyles.input}
              />
            </div>
          </div>

          <div style={formStyles.row2}>
            <div style={formStyles.field}>
              <label style={formStyles.label}>Abstract deadline</label>
              <input
                type="date"
                value={form.abstractDeadline}
                onChange={(e) => set({ abstractDeadline: e.target.value })}
                style={formStyles.input}
              />
            </div>
            <div style={formStyles.field}>
              <label style={formStyles.label}>Late-breaking deadline</label>
              <input
                type="date"
                value={form.lateBreakingDeadline}
                onChange={(e) => set({ lateBreakingDeadline: e.target.value })}
                style={formStyles.input}
              />
            </div>
          </div>

          {form.fromSuggestion && form.sourceVerified && (
            <div style={formStyles.verifiedBanner}>
              ⚠ Dates were prefilled from our records. Please verify against
              the official source before relying on them — congress organisers
              do change dates.
            </div>
          )}

          <div style={formStyles.btnRow}>
            <button onClick={onCancel} style={formStyles.cancelBtn}>
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!form.name.trim()}
              style={{
                ...formStyles.saveBtn,
                opacity: form.name.trim() ? 1 : 0.4,
                cursor: form.name.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {editingId ? 'Save changes' : 'Add congress'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CongressCard ────────────────────────────────────────────────────────────
function CongressCard({ congress, onEdit, onRemove }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const c = congress;
  const taColor = c.color || TA_COLORS[c.ta] || '#666';
  const isPast = c.endDate && c.endDate < new Date().toISOString().slice(0, 10);

  return (
    <div
      style={{
        ...cardStyles.wrap,
        opacity: isPast ? 0.55 : 1,
        borderLeft: `3px solid ${taColor}`,
      }}
    >
      <div style={cardStyles.topRow}>
        <div style={cardStyles.titleArea}>
          <div style={cardStyles.titleLine}>
            {c.abbr && (
              <span
                style={{
                  ...cardStyles.abbrBadge,
                  background: taColor + '22',
                  color: taColor,
                }}
              >
                {c.abbr}
              </span>
            )}
            <span style={cardStyles.name}>{c.name}</span>
          </div>
          <div style={cardStyles.metaLine}>
            {c.ta && <span style={cardStyles.taLabel}>{c.ta}</span>}
            {c.location && (
              <>
                <span style={cardStyles.metaSep}>·</span>
                <span>{c.location}</span>
              </>
            )}
          </div>
        </div>
        <div style={cardStyles.actions}>
          <button onClick={onEdit} style={cardStyles.iconBtn} title="Edit">✎</button>
          {!confirmRemove ? (
            <button
              onClick={() => setConfirmRemove(true)}
              style={cardStyles.iconBtn}
              title="Remove"
            >
              🗑
            </button>
          ) : (
            <>
              <button onClick={onRemove} style={cardStyles.confirmRemove}>
                Delete
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                style={cardStyles.iconBtn}
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>

      <div style={cardStyles.datesRow}>
        {c.startDate ? (
          <DateChip
            label="Congress"
            date={c.startDate}
            endDate={c.endDate}
            color={taColor}
            primary
          />
        ) : (
          <span style={cardStyles.noDates}>No dates set</span>
        )}
        {c.abstractDeadline && (
          <DateChip
            label="Abstract"
            date={c.abstractDeadline}
            color="#1d9e75"
          />
        )}
        {c.lateBreakingDeadline && (
          <DateChip
            label="Late-breaking"
            date={c.lateBreakingDeadline}
            color="#BA7517"
          />
        )}
      </div>

      {c.fromSuggestion && c.sourceVerified && (
        <div style={cardStyles.verifyHint}>
          ⚠ Verify dates against the official source
        </div>
      )}
    </div>
  );
}

function DateChip({ label, date, endDate, color, primary }) {
  const dStr = endDate
    ? `${fmtDay(date)} – ${fmtDay(endDate)}`
    : fmtDay(date);
  const past = date < new Date().toISOString().slice(0, 10);
  return (
    <div
      style={{
        ...cardStyles.dateChip,
        background: primary ? color + '15' : '#fff',
        border: `0.5px solid ${color}55`,
        color,
        opacity: past ? 0.5 : 1,
      }}
    >
      <span style={cardStyles.dateLabel}>{label}</span>
      <span style={{ ...cardStyles.dateValue, color }}>{dStr}</span>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  wrap: {
    flex: 1,
    background: 'var(--bg-surface)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  scroll: { flex: 1, overflowY: 'auto', padding: 14 },
  intro: {
    background: 'var(--color-background-secondary)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  introTitle: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  introSub: { fontSize: 11, color: 'var(--color-text-secondary)' },
  toolbar: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: 220,
    padding: '6px 12px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
  },
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
  primaryBtnLarge: {
    padding: '10px 22px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: 12,
  },
  secondaryBtn: {
    padding: '7px 14px',
    background: 'transparent',
    border: '0.5px solid #534AB7',
    color: '#534AB7',
    borderRadius: 8,
    fontSize: 12,
    cursor: 'pointer',
  },
  filterRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  filterChip: {
    padding: '4px 10px',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-secondary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 14,
    fontSize: 11,
    cursor: 'pointer',
  },
  filterChipActive: {
    background: '#534AB711',
    color: '#534AB7',
    borderColor: '#534AB744',
    fontWeight: 500,
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  emptyBig: {
    padding: 32,
    textAlign: 'center',
    background: 'var(--color-background-secondary)',
    borderRadius: 12,
  },
  emptyTitle: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  emptyHint: { fontSize: 12, color: 'var(--color-text-secondary)' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
};

const formStyles = {
  wrap: {
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 13, fontWeight: 600, color: '#534AB7' },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 18,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
  },
  toggleSuggestions: {
    alignSelf: 'flex-start',
    padding: '3px 10px',
    background: 'transparent',
    border: '0.5px solid #534AB7',
    color: '#534AB7',
    borderRadius: 8,
    fontSize: 11,
    cursor: 'pointer',
  },
  suggestionList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 6,
  },
  suggestionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    border: '0.5px solid',
    borderRadius: 8,
    textAlign: 'left',
  },
  suggestionDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  suggestionText: { flex: 1, minWidth: 0 },
  suggestionName: { fontSize: 12, fontWeight: 500 },
  suggestionTa: { fontSize: 10, color: 'var(--color-text-secondary)' },
  suggestionDate: {
    fontSize: 10,
    color: 'var(--color-text-secondary)',
    flexShrink: 0,
  },
  fields: { display: 'flex', flexDirection: 'column', gap: 10 },
  row2: { display: 'flex', gap: 10 },
  field: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
  input: {
    padding: '5px 8px',
    border: '0.5px solid var(--color-border-primary)',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--bg-surface)',
    outline: 'none',
    fontFamily: 'inherit',
  },
  verifiedBanner: {
    padding: '8px 10px',
    background: '#ef9f2722',
    border: '0.5px solid #ef9f2744',
    borderRadius: 8,
    fontSize: 11,
    color: '#BA7517',
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  cancelBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '0.5px solid var(--color-border-primary)',
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '6px 18px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
  },
};

const cardStyles = {
  wrap: {
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  topRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleArea: { flex: 1, minWidth: 0 },
  titleLine: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  abbrBadge: {
    fontSize: 10,
    fontWeight: 600,
    padding: '1px 8px',
    borderRadius: 6,
    letterSpacing: 0.4,
  },
  name: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  metaLine: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaSep: { color: 'var(--color-text-tertiary)' },
  taLabel: { fontWeight: 500 },
  actions: { display: 'flex', gap: 4, alignItems: 'center' },
  iconBtn: {
    width: 28,
    height: 28,
    background: 'transparent',
    border: 'none',
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    borderRadius: 4,
    cursor: 'pointer',
  },
  confirmRemove: {
    padding: '3px 10px',
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  datesRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  noDates: { fontSize: 11, color: 'var(--color-text-tertiary)', fontStyle: 'italic' },
  dateChip: {
    display: 'inline-flex',
    flexDirection: 'column',
    padding: '4px 10px',
    borderRadius: 8,
    minWidth: 100,
  },
  dateLabel: {
    fontSize: 9,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  dateValue: {
    fontSize: 11,
    fontWeight: 500,
  },
  verifyHint: {
    fontSize: 10,
    color: '#BA7517',
    fontStyle: 'italic',
    paddingTop: 4,
    borderTop: '0.5px dashed var(--color-border-tertiary)',
  },
};
