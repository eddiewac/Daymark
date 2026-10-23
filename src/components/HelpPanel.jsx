import { useEffect } from 'react';

// ── HelpPanel ───────────────────────────────────────────────────────────────
// Slides in from the right with the 5-minute walkthrough. Keyboard-dismissable
// (Esc) and click-outside-to-close.

export default function HelpPanel({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Getting started with Daymark</span>
          <button onClick={onClose} style={styles.close} title="Close (Esc)">×</button>
        </div>

        <div style={styles.body}>
          <Section title="The tabs">
            <DefRow term="Today" def="One screen showing what needs your attention now: priority, overdue, due today, awaiting replies, stale stations, congresses." />
            <DefRow term="Tasks" def="Plan → Tasks. List, kanban, or table. Filterable by project, priority, status, etc." />
            <DefRow term="Plan" def="Weekly planning. Calendar (drag tasks) or List (with timer + estimate-setting). Generates a capacity email for your team." />
            <DefRow term="Projects" def="Where projects, deliverables, stations, and comms live. Card grid, Gantt timeline, or full-screen Track view." />
            <DefRow term="Notes" def="Notes linked to specific projects — research, meeting outputs, briefs. Lives with the project, surfaces in handoffs." />
            <DefRow term="Notepad" def="Freeform scratchpad for things not yet structured. Paste in emails, brainstorm, jot ideas. Convert sections into tasks or projects when ready." />
            <DefRow term="Status" def="Weekly project status updates, archived per round." />
            <DefRow term="Time" def="Block-based time tracking. Reports break down hours by project, week, or month." />
            <DefRow term="Congresses" def="Calendar of upcoming medical congresses, optionally linked to projects." />
          </Section>

          <Section title="A common workflow">
            <p>
              Many PMs use the <strong>Notepad</strong> as an inbox-triage surface:
              paste a batch of emails in, scan through, and as you find work that
              needs tracking, convert sections into tasks or projects. The original
              text stays in the notepad as a record while the structured items
              flow into Tasks and Projects with the context attached.
            </p>
            <p>
              Once a task or project exists, use <strong>Notes</strong> for the
              ongoing record — meeting outputs, briefs, decisions. Notes are
              linked to the project and surface in the project's handoff export
              when you eventually pass it on.
            </p>
          </Section>

          <Section title="Five minutes to try it">
            <Step n={1} title="Create your first project">
              Click <strong>+ New</strong> in the top bar (or press <Kbd>Cmd</Kbd>+<Kbd>K</Kbd>),
              choose <strong>Project</strong>, name it.
            </Step>
            <Step n={2} title="Add a deliverable + stations">
              Open the project. Add a deliverable (e.g. "Slide deck draft"). Add 3-4
              stations: <em>Draft 1 → Internal review → Client review → Approved</em>.
            </Step>
            <Step n={3} title="Open the Track view">
              Click <strong>🚂 Track</strong> in the project header — see the workflow
              as a train of stations.
            </Step>
            <Step n={4} title="Click into the first station">
              Add a task or two. Log a comm ("Sent to internal team"). Optionally set
              "Expect reply by" tomorrow.
            </Step>
            <Step n={5} title="Check the Today tab">
              See your priority, the tasks you scheduled, and the comm you logged
              all surfaced in one place.
            </Step>
          </Section>

          <Section title="Useful shortcuts">
            <DefRow term={<><Kbd>Cmd</Kbd>+<Kbd>K</Kbd></>} def="Quick capture from anywhere — add a task or project without navigating." />
            <DefRow term="+ New" def="Same as Cmd+K but as a button in the top bar." />
            <DefRow term="🚂 Track" def="Full-screen workflow visualisation for any project." />
            <DefRow term="📋 Handoff" def="Generate a markdown summary of any project for handoff or archiving." />
          </Section>

          <Section title="What's missing">
            <p>
              No mobile app yet (web works on phones but isn't optimised). No
              integrations (Slack, Outlook). No AI features. No real-time
              collaboration cursors. These may come if real users ask. For now,
              focus is on getting the core right.
            </p>
          </Section>

          <Section title="Feedback welcome">
            <p>
              The most useful feedback at this stage: <strong>where it didn't
              make sense</strong>, <strong>what's missing for how your team
              works</strong>, and <strong>what's wrong</strong>. Email me at{' '}
              <a href="mailto:support@getdaymark.com" style={styles.link}>
                support@getdaymark.com
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

function DefRow({ term, def }) {
  return (
    <div style={styles.defRow}>
      <span style={styles.defTerm}>{term}</span>
      <span style={styles.defDesc}>{def}</span>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div style={styles.step}>
      <div style={styles.stepNum}>{n}</div>
      <div style={styles.stepBody}>
        <div style={styles.stepTitle}>{title}</div>
        <div style={styles.stepDesc}>{children}</div>
      </div>
    </div>
  );
}

function Kbd({ children }) {
  return <kbd style={styles.kbd}>{children}</kbd>;
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 1400,
  },
  panel: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 'min(480px, 90vw)',
    background: 'var(--bg-surface)',
    boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    flexShrink: 0,
  },
  title: { fontSize: 14, fontWeight: 600 },
  close: {
    width: 28,
    height: 28,
    background: 'transparent',
    border: 'none',
    fontSize: 22,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    borderRadius: 6,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 18px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: {
    fontSize: 12,
    lineHeight: 1.55,
    color: 'var(--color-text-primary)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  defRow: {
    display: 'flex',
    gap: 8,
    fontSize: 11.5,
    lineHeight: 1.5,
  },
  defTerm: {
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    flexShrink: 0,
    minWidth: 80,
  },
  defDesc: {
    color: 'var(--color-text-secondary)',
  },
  step: {
    display: 'flex',
    gap: 10,
    padding: '8px 0',
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' },
  stepDesc: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    marginTop: 2,
    lineHeight: 1.5,
  },
  kbd: {
    fontFamily: 'monospace',
    fontSize: 10,
    padding: '1px 5px',
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 3,
    margin: '0 2px',
  },
  link: { color: 'var(--accent)', textDecoration: 'none' },
};
