import { COMM_TYPES, LABEL_MAX } from '../../lib/commsLogModel.js';

// One tap logs the type. The link and label are optional and already on screen,
// so adding a comm is not a form you have to open first.

export default function CommsQuickAdd({ label, url, onLabel, onUrl, onLog, busy }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.buttons}>
        {COMM_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            disabled={busy}
            onClick={() => onLog(type.id)}
            style={{ ...styles.btn, ...(busy ? styles.btnBusy : {}) }}
          >
            {type.button}
          </button>
        ))}
      </div>
      <input
        value={url}
        onChange={(e) => onUrl(e.target.value)}
        placeholder="Teams or Slack link (optional)"
        aria-label="External link"
        inputMode="url"
        style={styles.input}
      />
      <input
        value={label}
        onChange={(e) => onLabel(e.target.value)}
        placeholder="Who or topic — no client details"
        aria-label="Short label"
        maxLength={LABEL_MAX}
        style={styles.input}
      />
      <div style={styles.hint}>No client details · {LABEL_MAX} characters max</div>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  buttons: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  btn: {
    border: '0.5px solid var(--color-border-secondary)',
    background: 'var(--bg-surface)',
    borderRadius: 8,
    padding: '6px 11px',
    fontWeight: 650,
    fontSize: 12.5,
    cursor: 'pointer',
    color: 'var(--color-text-primary)',
  },
  btnBusy: { opacity: 0.6, cursor: 'default' },
  input: {
    width: '100%',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 7,
    padding: '7px 9px',
    background: 'var(--bg-surface)',
    color: 'var(--color-text-primary)',
    boxSizing: 'border-box',
    fontSize: 13,
  },
  hint: { fontSize: 11, color: 'var(--color-text-tertiary)' },
};
