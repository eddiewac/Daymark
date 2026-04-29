import { useEffect, useRef, useState } from 'react';
import { loadNotepad, saveNotepad } from '../../lib/notepad.js';

export default function Notepad() {
  const [body, setBody] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);

  // Initial load
  useEffect(() => {
    loadNotepad()
      .then((b) => {
        setBody(b);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Debounced save
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveNotepad(body);
      setSavedAt(Date.now());
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [body, loaded]);

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>📒 Notepad</div>
          <div style={styles.sub}>
            Quick personal scratchpad. Auto-saves as you type. Always private.
          </div>
        </div>
        <div style={styles.savedNote}>
          {savedAt ? `Saved ${fmtTime(savedAt)}` : loaded ? 'Loaded' : ''}
        </div>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={loaded ? 'Start jotting…' : 'Loading…'}
        disabled={!loaded}
        style={styles.area}
      />
    </div>
  );
}

function fmtTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 5000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '14px 18px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  title: { fontSize: 16, fontWeight: 600 },
  sub: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginTop: 2,
  },
  savedNote: {
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
  },
  area: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '14px 18px',
    fontSize: 13,
    lineHeight: 1.6,
    fontFamily: 'inherit',
    resize: 'none',
    color: 'var(--color-text-primary)',
  },
};
