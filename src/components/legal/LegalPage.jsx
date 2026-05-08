import ReactMarkdown from 'react-markdown';
import { DaymarkWordmark } from '../Logo.jsx';

// ── LegalPage ───────────────────────────────────────────────────────────────
// Public-facing layout used by /privacy, /terms, /security pages. Renders
// markdown content with consistent typography, plus a header linking back
// to the app and a footer with cross-links between the legal pages.

export default function LegalPage({ title, content }) {
  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <a href="/" style={styles.logoLink} aria-label="Back to Daymark">
          <DaymarkWordmark height={26} />
        </a>
        <a href="/" style={styles.appLink}>
          ← Back to app
        </a>
      </header>

      <main style={styles.main}>
        <article style={styles.article}>
          <ReactMarkdown
            components={{
              h1: (props) => <h1 style={mdStyles.h1} {...props} />,
              h2: (props) => <h2 style={mdStyles.h2} {...props} />,
              h3: (props) => <h3 style={mdStyles.h3} {...props} />,
              p: (props) => <p style={mdStyles.p} {...props} />,
              ul: (props) => <ul style={mdStyles.ul} {...props} />,
              ol: (props) => <ol style={mdStyles.ol} {...props} />,
              li: (props) => <li style={mdStyles.li} {...props} />,
              a: (props) => (
                <a
                  style={mdStyles.a}
                  target={props.href?.startsWith('http') ? '_blank' : undefined}
                  rel={props.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                  {...props}
                />
              ),
              code: (props) => <code style={mdStyles.code} {...props} />,
              strong: (props) => <strong style={mdStyles.strong} {...props} />,
              em: (props) => <em style={mdStyles.em} {...props} />,
              hr: (props) => <hr style={mdStyles.hr} {...props} />,
              table: (props) => (
                <div style={mdStyles.tableWrap}>
                  <table style={mdStyles.table} {...props} />
                </div>
              ),
              thead: (props) => <thead {...props} />,
              tbody: (props) => <tbody {...props} />,
              tr: (props) => <tr style={mdStyles.tr} {...props} />,
              th: (props) => <th style={mdStyles.th} {...props} />,
              td: (props) => <td style={mdStyles.td} {...props} />,
              blockquote: (props) => <blockquote style={mdStyles.blockquote} {...props} />,
            }}
          >
            {content}
          </ReactMarkdown>
        </article>
      </main>

      <footer style={styles.footer}>
        <div style={styles.footerLinks}>
          <a href="/privacy" style={styles.footerLink}>Privacy</a>
          <span style={styles.footerSep}>·</span>
          <a href="/terms" style={styles.footerLink}>Terms</a>
          <span style={styles.footerSep}>·</span>
          <a href="/security" style={styles.footerLink}>Security</a>
        </div>
        <div style={styles.footerMeta}>
          © {new Date().getFullYear()} Daymark. Brisbane, Australia.
        </div>
      </footer>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-page)',
    color: 'var(--text-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    borderBottom: '0.5px solid var(--border-tertiary)',
    background: 'var(--bg-surface)',
  },
  logoLink: {
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
  },
  appLink: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
  },
  main: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    padding: '32px 24px 64px',
  },
  article: {
    width: '100%',
    maxWidth: 720,
  },
  footer: {
    borderTop: '0.5px solid var(--border-tertiary)',
    padding: '20px 24px',
    background: 'var(--bg-surface)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  footerLinks: {
    display: 'flex',
    gap: 8,
    fontSize: 12,
  },
  footerLink: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
  },
  footerSep: { color: 'var(--text-tertiary)' },
  footerMeta: { fontSize: 11, color: 'var(--text-tertiary)' },
};

const mdStyles = {
  h1: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginTop: 0,
    marginBottom: 12,
    lineHeight: 1.2,
  },
  h2: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginTop: 32,
    marginBottom: 8,
    lineHeight: 1.3,
  },
  h3: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginTop: 20,
    marginBottom: 6,
  },
  p: {
    fontSize: 14,
    color: 'var(--text-primary)',
    lineHeight: 1.65,
    margin: '0 0 12px 0',
  },
  ul: {
    margin: '0 0 12px 0',
    padding: '0 0 0 24px',
  },
  ol: {
    margin: '0 0 12px 0',
    padding: '0 0 0 24px',
  },
  li: {
    fontSize: 14,
    color: 'var(--text-primary)',
    lineHeight: 1.65,
    marginBottom: 4,
  },
  a: {
    color: 'var(--accent)',
    textDecoration: 'none',
    borderBottom: '1px solid var(--accent-soft-border)',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    background: 'var(--bg-surface-alt)',
    padding: '1px 6px',
    borderRadius: 3,
  },
  strong: {
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  em: {
    fontStyle: 'italic',
  },
  hr: {
    border: 'none',
    borderTop: '0.5px solid var(--border-secondary)',
    margin: '24px 0',
  },
  tableWrap: {
    overflowX: 'auto',
    margin: '12px 0 16px',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: 13,
  },
  tr: {
    borderBottom: '0.5px solid var(--border-tertiary)',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    background: 'var(--bg-surface-alt)',
    fontSize: 12,
  },
  td: {
    padding: '8px 12px',
    color: 'var(--text-primary)',
    verticalAlign: 'top',
  },
  blockquote: {
    margin: '12px 0',
    padding: '8px 16px',
    borderLeft: '3px solid var(--accent-soft-border)',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
  },
};
