import SecuritySection from './SecuritySection.jsx';
import { useState } from 'react';
import { getStoredThemeMode, setThemeMode } from '../../lib/theme.js';
import { GROUP_COLOR_CHOICES, newGroupId } from '../../lib/projectGroups.js';

function fmtRel(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 5000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

export default function SettingsPanel({
  settings,
  loading,
  workspaceId,
  workspaceName,
  savedAt,
  onUpdate,
  userPrefs,
  onUpdateUserPrefs,
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
            {workspaceId && (
              <> Team members will see your changes in real time.</>
            )}
          </div>
          {savedAt && (
            <div style={styles.savedHint}>
              Last updated {fmtRel(savedAt)}
            </div>
          )}
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

            <ProjectGroupsEditor
              groups={settings.projectGroups || []}
              onChange={(projectGroups) => onUpdate({ projectGroups })}
            />

            <NavDefaultsEditor workspaceId={workspaceId} />

            <section style={styles.section}>
              <div style={styles.sectionTitle}>Daily capacity hours</div>
              <div style={styles.sectionHint}>
                A typical working day's hours. Used by the capacity email and
                the Resource view's over-capacity flag. 7.5 is a good default;
                set lower for part-time, higher for longer days.
              </div>
              <input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={settings.dailyHours ?? 7.5}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) onUpdate({ dailyHours: v });
                }}
                style={{ ...styles.itemInput, maxWidth: 120 }}
              />
            </section>

            <StationTemplatesEditor
              templates={settings.stationTemplates || []}
              onChange={(stationTemplates) => onUpdate({ stationTemplates })}
            />

            <TagChecklistEditor
              checklists={settings.tagChecklists}
              onChange={(tagChecklists) => onUpdate({ tagChecklists })}
            />

            {/* User preferences — these apply across all workspaces */}
            {userPrefs && onUpdateUserPrefs && (
              <>
                <ThemeSection />
                <SecuritySection />
                <section style={styles.section}>
                  <div style={styles.sectionTitle}>Your name</div>
                  <div style={styles.sectionHint}>
                    How you appear to others — for example in the Resource view
                    when you share your workload. Leave blank to show your email.
                  </div>
                  <input
                    type="text"
                    value={userPrefs.displayName || ''}
                    onChange={(e) =>
                      onUpdateUserPrefs({ displayName: e.target.value })
                    }
                    placeholder="e.g. Sarah Thompson"
                    style={{ ...styles.itemInput, maxWidth: 280 }}
                  />
                </section>
                <section style={styles.section}>
                  <div style={styles.sectionTitle}>Daily triage</div>
                <div style={styles.sectionHint}>
                  These settings are personal — they apply across all your
                  workspaces.
                </div>
                <label style={prefsToggleStyles.row}>
                  <input
                    type="checkbox"
                    checked={!!userPrefs.showPriorityBanner}
                    onChange={(e) =>
                      onUpdateUserPrefs({ showPriorityBanner: e.target.checked })
                    }
                  />
                  <div>
                    <div style={prefsToggleStyles.label}>
                      Show "today's priority" banner each morning
                    </div>
                    <div style={prefsToggleStyles.hint}>
                      Reminds you to pick the one task you want done today.
                      Turn off to use the manual button only.
                    </div>
                  </div>
                </label>
              </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const prefsToggleStyles = {
  row: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    padding: 10,
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    cursor: 'pointer',
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  hint: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginTop: 3,
    lineHeight: 1.5,
  },
};

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

// ── ProjectGroupsEditor: named, coloured project groups ───────────────────
function ProjectGroupsEditor({ groups, onChange }) {
  const [draftName, setDraftName] = useState('');

  const add = () => {
    const name = draftName.trim();
    if (!name) return;
    // Pick the next colour in the palette by current group count.
    const color = GROUP_COLOR_CHOICES[groups.length % GROUP_COLOR_CHOICES.length];
    onChange([...groups, { id: newGroupId(), name, color }]);
    setDraftName('');
  };

  const remove = (id) => onChange(groups.filter((g) => g.id !== id));

  const rename = (id, name) =>
    onChange(groups.map((g) => (g.id === id ? { ...g, name } : g)));

  const recolour = (id, color) =>
    onChange(groups.map((g) => (g.id === id ? { ...g, color } : g)));

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Project groups</div>
      <div style={styles.sectionHint}>
        Group related projects together with a colour and a label of your
        choosing. Use neutral names — groups appear on project cards, so avoid
        anything confidential. Assign a project to a group in its detail panel.
      </div>
      <div style={styles.list}>
        {groups.length === 0 && (
          <div style={styles.empty}>
            No groups yet. Add one below to start grouping projects.
          </div>
        )}
        {groups.map((g) => (
          <div key={g.id} style={styles.row}>
            {/* Colour picker — swatches */}
            <div style={groupEditorStyles.swatchRow}>
              {GROUP_COLOR_CHOICES.map((c) => (
                <button
                  key={c}
                  onClick={() => recolour(g.id, c)}
                  title={c}
                  style={{
                    ...groupEditorStyles.swatch,
                    background: c,
                    outline: g.color === c ? '2px solid var(--color-text-primary)' : 'none',
                    outlineOffset: 1,
                  }}
                />
              ))}
            </div>
            <input
              value={g.name}
              onChange={(e) => rename(g.id, e.target.value)}
              style={styles.itemInput}
              placeholder="Group name"
            />
            <button
              onClick={() => remove(g.id)}
              style={styles.removeBtn}
              title="Remove group"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div style={styles.addRow}>
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add a group…"
          style={styles.addInput}
        />
        <button
          onClick={add}
          disabled={!draftName.trim()}
          style={{
            ...styles.addBtn,
            opacity: draftName.trim() ? 1 : 0.4,
            cursor: draftName.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Add
        </button>
      </div>
    </section>
  );
}

const groupEditorStyles = {
  swatchRow: {
    display: 'flex',
    gap: 3,
    flexWrap: 'wrap',
    maxWidth: 130,
    flexShrink: 0,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
};

// ── StationTemplatesEditor: named templates of stages ─────────────────────
function StationTemplatesEditor({ templates, onChange }) {
  const [newName, setNewName] = useState('');

  const addTemplate = () => {
    const n = newName.trim();
    if (!n) return;
    if (templates.some((t) => t.name === n)) {
      setNewName('');
      return;
    }
    onChange([
      ...templates,
      {
        id: 'tpl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: n,
        stages: ['Draft', 'Review', 'Final'],
      },
    ]);
    setNewName('');
  };

  const removeTemplate = (id) => {
    onChange(templates.filter((t) => t.id !== id));
  };

  const renameTemplate = (id, name) => {
    onChange(templates.map((t) => (t.id === id ? { ...t, name } : t)));
  };

  const updateStages = (id, stages) => {
    onChange(templates.map((t) => (t.id === id ? { ...t, stages } : t)));
  };

  const moveTemplate = (idx, dir) => {
    const newIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= templates.length) return;
    const next = [...templates];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(next);
  };

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Station templates</div>
      <div style={styles.sectionHint}>
        Pre-built sets of stages for different deliverable types (e.g. a
        slide-deck flow vs a manuscript flow). When creating a deliverable
        in the Track view, you can pick which template to apply.
      </div>

      {templates.length === 0 && (
        <div style={styles.empty}>
          No templates yet. Add one below.
        </div>
      )}

      <div style={styles.tagList}>
        {templates.map((tpl, i) => (
          <StationTemplateRow
            key={tpl.id}
            template={tpl}
            isFirst={i === 0}
            isLast={i === templates.length - 1}
            onMoveUp={() => moveTemplate(i, 'up')}
            onMoveDown={() => moveTemplate(i, 'down')}
            onRename={(name) => renameTemplate(tpl.id, name)}
            onUpdateStages={(stages) => updateStages(tpl.id, stages)}
            onRemove={() => removeTemplate(tpl.id)}
          />
        ))}
      </div>

      <div style={styles.addRow}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTemplate()}
          placeholder='Template name (e.g. "Slide deck")…'
          style={styles.addInput}
        />
        <button
          onClick={addTemplate}
          disabled={!newName.trim()}
          style={{
            ...styles.addBtn,
            opacity: newName.trim() ? 1 : 0.4,
            cursor: newName.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Add template
        </button>
      </div>
    </section>
  );
}

function StationTemplateRow({
  template,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRename,
  onUpdateStages,
  onRemove,
}) {
  const [name, setName] = useState(template.name);
  const [draftStage, setDraftStage] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const addStage = () => {
    const v = draftStage.trim();
    if (!v) return;
    onUpdateStages([...template.stages, v]);
    setDraftStage('');
  };

  const removeStage = (i) =>
    onUpdateStages(template.stages.filter((_, x) => x !== i));

  const renameStage = (i, val) => {
    const next = [...template.stages];
    next[i] = val;
    onUpdateStages(next);
  };

  const moveStage = (i, dir) => {
    const newIdx = dir === 'up' ? i - 1 : i + 1;
    if (newIdx < 0 || newIdx >= template.stages.length) return;
    const next = [...template.stages];
    [next[i], next[newIdx]] = [next[newIdx], next[i]];
    onUpdateStages(next);
  };

  return (
    <div style={styles.tagBlock}>
      <div style={styles.tagHeader}>
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          style={{ ...styles.iconBtn, opacity: isFirst ? 0.3 : 1 }}
          title="Move up"
        >
          ↑
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          style={{ ...styles.iconBtn, opacity: isLast ? 0.3 : 1 }}
          title="Move down"
        >
          ↓
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== template.name && onRename(name)}
          style={styles.tagInput}
        />
        {!confirmRemove ? (
          <button
            onClick={() => setConfirmRemove(true)}
            style={styles.removeTagBtn}
            title="Remove template"
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
        {template.stages.length === 0 && (
          <div style={styles.empty}>No stages defined.</div>
        )}
        {template.stages.map((stage, i) => (
          <div key={i} style={styles.row}>
            <button
              onClick={() => moveStage(i, 'up')}
              disabled={i === 0}
              style={{ ...styles.iconBtn, opacity: i === 0 ? 0.3 : 1 }}
            >
              ↑
            </button>
            <button
              onClick={() => moveStage(i, 'down')}
              disabled={i === template.stages.length - 1}
              style={{
                ...styles.iconBtn,
                opacity: i === template.stages.length - 1 ? 0.3 : 1,
              }}
            >
              ↓
            </button>
            <input
              value={stage}
              onChange={(e) => renameStage(i, e.target.value)}
              style={styles.itemInput}
            />
            <button
              onClick={() => removeStage(i)}
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
          value={draftStage}
          onChange={(e) => setDraftStage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addStage()}
          placeholder="Add stage…"
          style={styles.addInput}
        />
        <button
          onClick={addStage}
          disabled={!draftStage.trim()}
          style={{
            ...styles.addBtn,
            opacity: draftStage.trim() ? 1 : 0.4,
            cursor: draftStage.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Add
        </button>
      </div>
    </div>
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
  wrap: { flex: 1, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column' },
  scroll: { flex: 1, overflowY: 'auto', padding: 14 },
  intro: {
    background: 'var(--color-background-secondary)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  introTitle: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  introSub: { fontSize: 11, color: 'var(--color-text-secondary)' },
  savedHint: {
    fontSize: 10,
    color: '#1d9e75',
    marginTop: 6,
    fontWeight: 500,
  },
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
    background: 'var(--bg-surface)',
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
    background: 'var(--bg-surface)',
    outline: 'none',
  },
  addBtn: {
    padding: '5px 12px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
  },
  tagList: { display: 'flex', flexDirection: 'column', gap: 14 },
  tagBlock: {
    background: 'var(--bg-surface)',
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
  tagPrefix: { fontSize: 13, color: 'var(--accent)', fontWeight: 600 },
  tagInput: {
    flex: 1,
    padding: '4px 8px',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    background: 'var(--color-background-tertiary)',
    color: 'var(--accent)',
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

// ── ThemeSection ────────────────────────────────────────────────────────────
// Three-option theme picker: System, Light, Comfort. Applies immediately and
// persists in localStorage. Lives in the cross-workspace user-prefs area.
function ThemeSection() {
  const [mode, setMode] = useState(() => getStoredThemeMode());

  const choose = (next) => {
    setMode(next);
    setThemeMode(next);
  };

  const options = [
    {
      value: 'system',
      label: 'System',
      desc: 'Match your operating system preference.',
    },
    {
      value: 'light',
      label: 'Light',
      desc: 'Crisp white interface. The default.',
    },
    {
      value: 'comfort',
      label: 'Comfort',
      desc: 'Warmer cream tones with softer contrast — easier on eyes for long sessions.',
    },
  ];

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Appearance</div>
      <div style={styles.sectionHint}>
        Personal preference — applies across all your workspaces.
      </div>
      <div style={themeStyles.options}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => choose(opt.value)}
            style={{
              ...themeStyles.option,
              ...(mode === opt.value ? themeStyles.optionActive : {}),
            }}
          >
            <div style={themeStyles.optionLabel}>
              <span
                style={{
                  ...themeStyles.radio,
                  ...(mode === opt.value ? themeStyles.radioActive : {}),
                }}
              >
                {mode === opt.value && <span style={themeStyles.radioDot} />}
              </span>
              <span style={themeStyles.optionTitle}>{opt.label}</span>
            </div>
            <div style={themeStyles.optionDesc}>{opt.desc}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

const themeStyles = {
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 8,
  },
  option: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '10px 12px',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--border-tertiary)',
    borderRadius: 8,
    textAlign: 'left',
    cursor: 'pointer',
  },
  optionActive: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-soft)',
  },
  optionLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  optionDesc: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    paddingLeft: 24,
  },
  radio: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '0.5px solid var(--border-primary)',
    background: 'var(--bg-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioActive: {
    borderColor: 'var(--accent)',
  },
  radioDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--accent)',
  },
};


// ── Navigation defaults ──────────────────────────────────────────────────────
// Lets the user pin which sub-view the Work and Record group tabs open to.
// "Last viewed" (default) = remember where you last were in that group.
// A specific view = always open there. Stored in localStorage per workspace,
// read by WorkspaceView when a group header is tapped.
const NAV_GROUPS = [
  {
    id: 'projects',
    label: 'Projects',
    options: [
      { key: 'projects', label: 'All projects' },
      { key: 'deliverables', label: 'Deliverables' },
      { key: 'forecast', label: 'Forecast' },
    ],
  },
  {
    id: 'plan',
    label: 'Plan',
    options: [
      { key: 'plan', label: 'This week' },
      { key: 'congresses', label: 'Congresses' },
    ],
  },
  {
    id: 'track',
    label: 'Track',
    options: [
      { key: 'track', label: 'Station track' },
      { key: 'time', label: 'Timesheet' },
      { key: 'deliverables', label: 'Budget vs actual' },
    ],
  },
  {
    id: 'record',
    label: 'Record',
    options: [
      { key: 'record', label: 'Timesheet + Notes' },
      { key: 'comms', label: 'Comms log' },
      { key: 'export', label: 'Export / handoff' },
    ],
  },
];

function NavDefaultsEditor({ workspaceId }) {
  const pinKey = `daymark-group-pin:${workspaceId || 'personal'}`;
  const [pins, setPins] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(pinKey) || '{}');
      return stored && typeof stored === 'object' ? stored : {};
    } catch {
      return {};
    }
  });

  const setPin = (groupId, value) => {
    setPins((prev) => {
      const next = { ...prev };
      if (!value) delete next[groupId]; // '' = Last viewed (no pin)
      else next[groupId] = value;
      try {
        localStorage.setItem(pinKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <section style={styles.section}>
      <div style={styles.sectionTitle}>Tab defaults</div>
      <div style={styles.sectionHint}>
        Choose which view each door opens to. “Last viewed” returns you to
        wherever you were; or pin a specific view so it always opens there.
        Applies to this workspace.
      </div>
      <div style={navStyles.rows}>
        {NAV_GROUPS.map((g) => (
          <div key={g.id} style={navStyles.row}>
            <span style={navStyles.label}>{g.label} opens to</span>
            <select
              value={pins[g.id] || ''}
              onChange={(e) => setPin(g.id, e.target.value)}
              style={navStyles.select}
            >
              <option value="">Last viewed</option>
              {g.options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}

const navStyles = {
  rows: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  row: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  label: {
    fontSize: 13,
    color: 'var(--color-text-primary)',
    minWidth: 130,
  },
  select: {
    padding: '6px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    fontSize: 13,
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    minWidth: 160,
  },
};
