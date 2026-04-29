import { useState } from 'react';

export default function SettingsPanel({
  settings,
  loading,
  workspaceId,
  workspaceName,
  onUpdate,
}) {
  return (
    <div style={styles.wrap}>
      <div style={styles.scroll}>
        <div style={styles.intro}>
          <div style={styles.introTitle}>
            Settings · {workspaceName || 'Personal'}
          </div>
          <div style={styles.introSub}>
            These settings apply to this workspace only. Personal and team
            workspaces have separate settings.
          </div>
        </div>

        {loading ? (
          <div style={styles.loading}>Loading…</div>
        ) : (
          <>
            <ListEditor
              title="Categories"
              hint="Used in the task category dropdown."
              items={settings.categories}
              onChange={(items) => onUpdate({ categories: items })}
              placeholder="Add a category…"
            />

            <ListEditor
              title="Priorities"
              hint="Order matters — first item is the default for new tasks."
              items={settings.priorities}
              onChange={(items) => onUpdate({ priorities: items })}
              placeholder="Add a priority…"
            />

            <ListEditor
              title="Statuses"
              hint="The states a task can be in. The last one (e.g. Done) marks completion."
              items={settings.statuses}
              onChange={(items) => onUpdate({ statuses: items })}
              placeholder="Add a status…"
            />

            <ListEditor
              title="Default review stages"
              hint='Used when you click "Use default stages" on a deliverable.'
              items={settings.reviewStages}
              onChange={(items) => onUpdate({ reviewStages: items })}
              placeholder="Add a review stage…"
            />

            <TagChecklistEditor
              checklists={settings.tagChecklists}
              onChange={(tagChecklists) => onUpdate({ tagChecklists })}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── ListEditor: simple ordered text-list editor (categories, priorities, etc) ──
function ListEditor({ title, hint, items, onChange, placeholder }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...items, v]);
    setDraft('');
  };

  const remove = (i) => onChange(items.filter((_, x) => x !== i));

  const move = (i, dir) => {
    const newIdx = dir === 'up' ? i - 1 : i + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    const next = [...items];
    [next[i], next[newIdx]] = [next[newIdx], next[i]];
    onChange(next);
  };

  const rename = (i, val) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {hint && <div style={styles.sectionHint}>{hint}</div>}
      <div style={styles.list}>
        {items.length === 0 && (
          <div style={styles.empty}>No items yet.</div>
        )}
        {items.map((item, i) => (
          <div key={i} style={styles.row}>
            <button
              onClick={() => move(i, 'up')}
              disabled={i === 0}
              style={{ ...styles.iconBtn, opacity: i === 0 ? 0.3 : 1 }}
              title="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => move(i, 'down')}
              disabled={i === items.length - 1}
              style={{
                ...styles.iconBtn,
                opacity: i === items.length - 1 ? 0.3 : 1,
              }}
              title="Move down"
            >
              ↓
            </button>
            <input
              value={item}
              onChange={(e) => rename(i, e.target.value)}
              style={styles.itemInput}
            />
            <button
              onClick={() => remove(i)}
              style={styles.removeBtn}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div style={styles.addRow}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={placeholder}
          style={styles.addInput}
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          style={{
            ...styles.addBtn,
            opacity: draft.trim() ? 1 : 0.4,
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Add
        </button>
      </div>
    </section>
  );
}

// ── TagChecklistEditor: tag → list of checklist items ────────────────────────
function TagChecklistEditor({ checklists, onChange }) {
  const [newTag, setNewTag] = useState('');
  const tags = Object.keys(checklists || {});

  const addTag = () => {
    const t = newTag.trim();
    if (!t) return;
    if (checklists[t]) {
      setNewTag('');
      return;
    }
    onChange({ ...checklists, [t]: ['New item'] });
    setNewTag('');
  };

  const removeTag = (tag) => {
    const next = { ...checklists };
    delete next[tag];
    onChange(next);
  };

  const renameTag = (oldTag, newTag) => {
    const trimmed = newTag.trim();
    if (!trimmed || trimmed === oldTag) return;
    if (checklists[trimmed]) return; // collision
    const next = {};
    for (const k of Object.keys(checklists)) {
      if (k === oldTag) next[trimmed] = checklists[k];
      else next[k] = checklists[k];
    }
    onChange(next);
  };

  const updateItems = (tag, items) =>
    onChange({ ...checklists, [tag]: items });

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Tag checklists</div>
      <div style={styles.sectionHint}>
        When a task is tagged with one of these, the checklist appears in
        the focus box (when you start a timer). Multiple tags = multiple
        checklists shown stacked.
      </div>

      {tags.length === 0 && (
        <div style={styles.empty}>
          No tag checklists yet. Add a tag below — say "Review" — and define
          its checklist.
        </div>
      )}

      <div style={styles.tagList}>
        {tags.map((tag) => (
          <TagChecklistRow
            key={tag}
            tag={tag}
            items={checklists[tag]}
            onRename={(newName) => renameTag(tag, newName)}
            onUpdateItems={(items) => updateItems(tag, items)}
            onRemove={() => removeTag(tag)}
          />
        ))}
      </div>

      <div style={styles.addRow}>
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          placeholder="Tag name (e.g. Review)…"
          style={styles.addInput}
        />
        <button
          onClick={addTag}
          disabled={!newTag.trim()}
          style={{
            ...styles.addBtn,
            opacity: newTag.trim() ? 1 : 0.4,
            cursor: newTag.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Add tag
        </button>
      </div>
    </section>
  );
}

function TagChecklistRow({ tag, items, onRename, onUpdateItems, onRemove }) {
  const [tagName, setTagName] = useState(tag);
  const [draft, setDraft] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const addItem = () => {
    const v = draft.trim();
    if (!v) return;
    onUpdateItems([...items, v]);
    setDraft('');
  };

  const removeItem = (i) => onUpdateItems(items.filter((_, x) => x !== i));

  const renameItem = (i, val) => {
    const next = [...items];
    next[i] = val;
    onUpdateItems(next);
  };

  const moveItem = (i, dir) => {
    const newIdx = dir === 'up' ? i - 1 : i + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    const next = [...items];
    [next[i], next[newIdx]] = [next[newIdx], next[i]];
    onUpdateItems(next);
  };

  return (
    <div style={styles.tagBlock}>
      <div style={styles.tagHeader}>
        <span style={styles.tagPrefix}>#</span>
        <input
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          onBlur={() => tagName !== tag && onRename(tagName)}
          style={styles.tagInput}
        />
        {!confirmRemove ? (
          <button
            onClick={() => setConfirmRemove(true)}
            style={styles.removeTagBtn}
            title="Remove this tag's checklist"
          >
            🗑
          </button>
        ) : (
          <>
            <button onClick={onRemove} style={styles.confirmRemove}>
              Delete
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              style={styles.cancelSmall}
            >
              ×
            </button>
          </>
        )}
      </div>

      <div style={styles.tagItems}>
        {items.length === 0 && (
          <div style={styles.empty}>Empty checklist.</div>
        )}
        {items.map((item, i) => (
          <div key={i} style={styles.row}>
            <button
              onClick={() => moveItem(i, 'up')}
              disabled={i === 0}
              style={{ ...styles.iconBtn, opacity: i === 0 ? 0.3 : 1 }}
            >
              ↑
            </button>
            <button
              onClick={() => moveItem(i, 'down')}
              disabled={i === items.length - 1}
              style={{
                ...styles.iconBtn,
                opacity: i === items.length - 1 ? 0.3 : 1,
              }}
            >
              ↓
            </button>
            <input
              value={item}
              onChange={(e) => renameItem(i, e.target.value)}
              style={styles.itemInput}
            />
            <button
              onClick={() => removeItem(i)}
              style={styles.removeBtn}
              title="Remove item"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div style={styles.addRow}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder="Add checklist item…"
          style={styles.addInput}
        />
        <button
          onClick={addItem}
          disabled={!draft.trim()}
          style={{
            ...styles.addBtn,
            opacity: draft.trim() ? 1 : 0.4,
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { flex: 1, background: '#fff', display: 'flex', flexDirection: 'column' },
  scroll: { flex: 1, overflowY: 'auto', padding: 14 },
  intro: {
    background: 'var(--color-background-secondary)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  introTitle: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  introSub: { fontSize: 11, color: 'var(--color-text-secondary)' },
  loading: { padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' },
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
  sectionHint: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginBottom: 10,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 6px',
    background: '#fff',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
  },
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
  itemInput: {
    flex: 1,
    padding: '3px 8px',
    border: 'none',
    background: 'transparent',
    fontSize: 12,
    outline: 'none',
  },
  removeBtn: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 14,
    cursor: 'pointer',
  },
  empty: {
    padding: 8,
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  addRow: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
  },
  addInput: {
    flex: 1,
    padding: '5px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    fontSize: 12,
    background: '#fff',
    outline: 'none',
  },
  addBtn: {
    padding: '5px 12px',
    background: '#534AB7',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
  },
  tagList: { display: 'flex', flexDirection: 'column', gap: 14 },
  tagBlock: {
    background: '#fff',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    padding: 10,
  },
  tagHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  tagPrefix: { fontSize: 13, color: '#534AB7', fontWeight: 600 },
  tagInput: {
    flex: 1,
    padding: '4px 8px',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    background: 'var(--color-background-tertiary)',
    color: '#534AB7',
    outline: 'none',
  },
  removeTagBtn: {
    width: 26,
    height: 26,
    background: 'transparent',
    border: 'none',
    fontSize: 13,
    color: 'var(--color-text-tertiary)',
    cursor: 'pointer',
    borderRadius: 4,
  },
  confirmRemove: {
    padding: '4px 10px',
    background: '#e24b4a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
  },
  cancelSmall: {
    width: 22,
    height: 22,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)',
    fontSize: 14,
    cursor: 'pointer',
  },
  tagItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 8,
  },
};
