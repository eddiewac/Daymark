import { DaymarkWordmark } from './Logo.jsx';

// ── LandingPage ─────────────────────────────────────────────────────────────
//
// Public marketing page at getdaymark.com root. Shown to visitors who don't
// have an active session. Existing users (with a session cookie) skip this
// and go straight to the app — that routing decision happens in App.jsx.
//
// Positioning: "Project management that thinks like a medcomms PM"
// Target audience: medcomms agency PMs, account leads, freelance medcomms
// Goal: persuade them to click "Sign up" or "See it in action"

export default function LandingPage() {
  return (
    <div style={styles.wrap}>
      <Header />
      <Hero />
      <Features />
      <ForWho />
      <Trust />
      <Pricing />
      <FooterCTA />
      <Footer />
    </div>
  );
}

// ── Header (sticky nav with logo + login link) ─────────────────────────────
function Header() {
  return (
    <header style={styles.header}>
      <a href="/" style={styles.logoLink} aria-label="Daymark">
        <DaymarkWordmark height={26} />
      </a>
      <nav style={styles.nav}>
        <a href="/login" style={styles.navLink}>Sign in</a>
        <a href="/login" style={styles.navCta}>Sign up</a>
      </nav>
    </header>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={styles.hero}>
      <div style={styles.heroInner}>
        <div style={styles.eyebrow}>For medcomms agencies and freelance PMs</div>
        <h1 style={styles.heroTitle}>
          Project management that thinks like a medcomms&nbsp;PM
        </h1>
        <p style={styles.heroSub}>
          Daymark tracks every deliverable, every comm, every approval — without
          forcing you to live inside another generic project tool that was built
          for software teams. Designed around how medcomms actually works.
        </p>
        <div style={styles.heroCtas}>
          <a href="/login" style={styles.ctaPrimary}>Start free</a>
          <a href="#features" style={styles.ctaSecondary}>See what's inside ↓</a>
        </div>
        <div style={styles.heroNote}>
          Free during early access. No credit card. Cancel anytime.
        </div>

        {/*
          HERO SCREENSHOT
          Recommended: a wide screenshot of the Today tab with realistic demo
          data — priority task + overdue + due today + stale stations. Should
          show off the at-a-glance value within 1 second of looking.
          File: src/assets/landing/hero-today.png
          Recommended dimensions: 2400×1500 (2x retina for crispness)
        */}
        <div style={styles.heroImageWrap}>
          <img
            src="/landing/hero-today.png"
            alt="The Daymark Today view showing today's priority, overdue tasks, awaiting replies, and stale stations across multiple projects"
            style={styles.heroImage}
            onError={(e) => {
              // Graceful fallback while screenshots aren't taken yet
              e.target.style.display = 'none';
              const placeholder = e.target.nextElementSibling;
              if (placeholder) placeholder.style.display = 'flex';
            }}
          />
          <div style={styles.heroPlaceholder}>
            <div style={styles.placeholderInner}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Hero screenshot goes here</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                Today tab with realistic demo data
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Features (three big ones with screenshots) ─────────────────────────────
function Features() {
  return (
    <section id="features" style={styles.features}>
      <h2 style={styles.sectionTitle}>What makes it different</h2>

      <Feature
        eyebrow="Visual delivery tracking"
        title="Stop pretending your work is a Kanban board"
        body={
          <>
            Each project gets a "train" of stations — Draft 1, Internal review, MLR,
            Client review, Final — and you see at a glance where each deliverable
            is stuck. Reorder, customise, or copy templates between projects.
            Built for the way medcomms work actually moves.
          </>
        }
        imageSrc="/landing/feature-train.png"
        imageAlt="The Daymark train view showing deliverables and their stations side by side, with completed stations highlighted"
        placeholder="Train view: deliverables × stations"
        flip={false}
      />

      <Feature
        eyebrow="Comms tracking that doesn't lie"
        title="Know exactly who you're waiting on"
        body={
          <>
            Log every email, every chase, every approval request — and tag it
            with the date you expect a reply. The dashboard surfaces overdue
            replies so nothing falls through. No more "did we get sign-off on
            that?" Slack threads.
          </>
        }
        imageSrc="/landing/feature-comms.png"
        imageAlt="The Daymark comms log showing an awaiting-reply request with an overdue chip and inline date picker"
        placeholder="Comms log with awaiting-reply chip"
        flip={true}
      />
      
    </section>
  );
}

function Feature({ eyebrow, title, body, imageSrc, imageAlt, placeholder, flip }) {
  return (
    <div style={{ ...styles.feature, flexDirection: flip ? 'row-reverse' : 'row' }}>
      <div style={styles.featureText}>
        <div style={styles.featureEyebrow}>{eyebrow}</div>
        <h3 style={styles.featureTitle}>{title}</h3>
        <p style={styles.featureBody}>{body}</p>
      </div>
      <div style={styles.featureImageWrap}>
        <img
          src={imageSrc}
          alt={imageAlt}
          style={styles.featureImage}
          onError={(e) => {
            e.target.style.display = 'none';
            const ph = e.target.nextElementSibling;
            if (ph) ph.style.display = 'flex';
          }}
        />
        <div style={styles.featurePlaceholder}>
          <div style={styles.placeholderInner}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{placeholder}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              Screenshot
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── For who (positioning reinforcement) ─────────────────────────────────────
function ForWho() {
  return (
    <section style={styles.forWho}>
      <div style={styles.forWhoInner}>
        <h2 style={styles.sectionTitleCentered}>Built for medcomms, not for software teams</h2>
        <p style={styles.forWhoBody}>
          Most project tools (Asana, Monday, Notion) were designed for engineering
          and marketing workflows. Medcomms is different. You have MLR rounds,
          regulatory sign-offs, advisory boards, congress submissions, statements
          of work that mention specific deliverables. Daymark speaks that language
          from day one.
        </p>
        <div style={styles.forWhoList}>
          <div style={styles.forWhoItem}>
            <div style={styles.forWhoBullet}>✓</div>
            <div>
              <strong>Account leads</strong> tracking 8-15 concurrent projects
              across multiple clients
            </div>
          </div>
          <div style={styles.forWhoItem}>
            <div style={styles.forWhoBullet}>✓</div>
            <div>
              <strong>Project managers</strong> coordinating writers, designers,
              clients, and medical leads
            </div>
          </div>
          <div style={styles.forWhoItem}>
            <div style={styles.forWhoBullet}>✓</div>
            <div>
              <strong>Freelance medcomms PMs</strong> juggling clients without a
              full agency infrastructure
            </div>
          </div>
          <div style={styles.forWhoItem}>
            <div style={styles.forWhoBullet}>✓</div>
            <div>
              <strong>Small agencies</strong> wanting visibility across team
              workloads without enterprise pricing
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Trust signals ──────────────────────────────────────────────────────────
function Trust() {
  return (
    <section style={styles.trust}>
      <div style={styles.trustInner}>
        <h2 style={styles.sectionTitleCentered}>Built with your data in mind</h2>
        <div style={styles.trustGrid}>
          <div style={styles.trustItem}>
            <div style={styles.trustIcon}>🇪🇺</div>
            <div style={styles.trustTitle}>EU-hosted</div>
            <div style={styles.trustBody}>
              Data stored in Ireland (eu-west-1). GDPR-compliant by default.
              UK clients and EU clients can tick the box.
            </div>
          </div>
          <div style={styles.trustItem}>
            <div style={styles.trustIcon}>🔒</div>
            <div style={styles.trustTitle}>Two-factor authentication</div>
            <div style={styles.trustBody}>
              TOTP support via Google Authenticator, 1Password, Authy. Optional,
              one-click setup in Settings.
            </div>
          </div>
          <div style={styles.trustItem}>
            <div style={styles.trustIcon}>📤</div>
            <div style={styles.trustTitle}>Your data, your control</div>
            <div style={styles.trustBody}>
              Export anything anytime. Delete your account with one click — data
              gone within 30 days, no fight.
            </div>
          </div>
          <div style={styles.trustItem}>
            <div style={styles.trustIcon}>🤝</div>
            <div style={styles.trustTitle}>No tracking, no ads, no AI training</div>
            <div style={styles.trustBody}>
              Your projects stay yours. We don't sell, share, or use your
              workspace content for anything except providing the service.
            </div>
          </div>
        </div>
        <div style={styles.trustFooter}>
          <a href="/privacy" style={styles.trustLink}>Privacy Policy</a>
          <span style={styles.trustSep}>·</span>
          <a href="/security" style={styles.trustLink}>Security overview</a>
          <span style={styles.trustSep}>·</span>
          <a href="/terms" style={styles.trustLink}>Terms</a>
        </div>
      </div>
    </section>
  );
}

// ── Pricing teaser ─────────────────────────────────────────────────────────
function Pricing() {
  return (
    <section style={styles.pricing}>
      <div style={styles.pricingInner}>
        <h2 style={styles.sectionTitleCentered}>Free during early access</h2>
        <p style={styles.pricingBody}>
          Daymark is free to use while we shape it with our earliest users.
          When paid plans launch, every existing user gets at least 3 months
          free on whichever plan they choose.
        </p>
        <p style={styles.pricingBody}>
          No surprise charges. No "your trial is ending" emails. No bait and switch.
        </p>
        <div style={styles.pricingCta}>
          <a href="/login" style={styles.ctaPrimary}>Start using Daymark — free</a>
        </div>
      </div>
    </section>
  );
}

// ── Closing CTA ────────────────────────────────────────────────────────────
function FooterCTA() {
  return (
    <section style={styles.footerCta}>
      <div style={styles.footerCtaInner}>
        <h2 style={styles.footerCtaTitle}>Tired of forcing medcomms into tools built for someone else?</h2>
        <p style={styles.footerCtaBody}>
          Sign up takes about 30 seconds. There's a demo workspace with realistic
          example projects you can poke around before adding your own work.
        </p>
        <a href="/login" style={styles.ctaPrimary}>Sign up free</a>
      </div>
    </section>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.footerInner}>
        <div style={styles.footerCol}>
          <DaymarkWordmark height={22} />
          <div style={styles.footerTag}>Project management for medcomms agencies.</div>
        </div>
        <div style={styles.footerCol}>
          <div style={styles.footerColTitle}>Product</div>
          <a href="/login" style={styles.footerLink}>Sign up</a>
          <a href="/login" style={styles.footerLink}>Sign in</a>
        </div>
        <div style={styles.footerCol}>
          <div style={styles.footerColTitle}>Legal</div>
          <a href="/privacy" style={styles.footerLink}>Privacy Policy</a>
          <a href="/terms" style={styles.footerLink}>Terms of Service</a>
          <a href="/security" style={styles.footerLink}>Security & Privacy</a>
        </div>
        <div style={styles.footerCol}>
          <div style={styles.footerColTitle}>Contact</div>
          <a href="mailto:support@getdaymark.com" style={styles.footerLink}>support@getdaymark.com</a>
          <a href="mailto:privacy@getdaymark.com" style={styles.footerLink}>privacy@getdaymark.com</a>
          <div style={styles.footerMeta}>Brisbane, Australia</div>
        </div>
      </div>
      <div style={styles.footerBottom}>
        © {new Date().getFullYear()} Daymark. Built independently.
      </div>
    </footer>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  wrap: {
    background: 'var(--bg-page)',
    color: 'var(--text-primary)',
    minHeight: '100vh',
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 28px',
    borderBottom: '0.5px solid var(--border-tertiary)',
    background: 'var(--bg-surface)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  logoLink: { display: 'flex', alignItems: 'center', textDecoration: 'none' },
  nav: { display: 'flex', alignItems: 'center', gap: 16 },
  navLink: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
  },
  navCta: {
    fontSize: 13,
    fontWeight: 500,
    color: '#fff',
    background: 'var(--accent)',
    padding: '7px 14px',
    borderRadius: 7,
    textDecoration: 'none',
  },

  // Hero
  hero: {
    padding: '64px 28px 48px',
    background: 'var(--bg-surface)',
  },
  heroInner: {
    maxWidth: 1100,
    margin: '0 auto',
    textAlign: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 'clamp(32px, 5vw, 52px)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.1,
    margin: '0 0 20px',
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: 17,
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
    margin: '0 auto 32px',
    maxWidth: 680,
  },
  heroCtas: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  ctaPrimary: {
    fontSize: 14,
    fontWeight: 500,
    color: '#fff',
    background: 'var(--accent)',
    padding: '12px 22px',
    borderRadius: 8,
    textDecoration: 'none',
  },
  ctaSecondary: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-primary)',
    background: 'transparent',
    border: '0.5px solid var(--border-primary)',
    padding: '12px 22px',
    borderRadius: 8,
    textDecoration: 'none',
  },
  heroNote: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    marginBottom: 48,
  },
  heroImageWrap: {
    maxWidth: 1100,
    margin: '0 auto',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
    border: '0.5px solid var(--border-tertiary)',
  },
  heroImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
  },
  heroPlaceholder: {
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    aspectRatio: '16 / 10',
    background: 'var(--bg-surface-alt)',
  },
  placeholderInner: {
    textAlign: 'center',
    padding: 24,
  },

  // Section titles
  sectionTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 56px',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  sectionTitleCentered: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 auto 24px',
    textAlign: 'center',
    maxWidth: 700,
    letterSpacing: -0.5,
  },

  // Features
  features: {
    padding: '80px 28px',
    maxWidth: 1100,
    margin: '0 auto',
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: 48,
    marginBottom: 80,
    flexWrap: 'wrap',
  },
  featureText: {
    flex: '1 1 360px',
    minWidth: 280,
  },
  featureEyebrow: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 14px',
    lineHeight: 1.2,
    letterSpacing: -0.3,
  },
  featureBody: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: 0,
  },
  featureImageWrap: {
    flex: '1 1 360px',
    minWidth: 280,
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
    border: '0.5px solid var(--border-tertiary)',
  },
  featureImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
  },
  featurePlaceholder: {
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    aspectRatio: '4 / 3',
    background: 'var(--bg-surface-alt)',
  },

  // For who
  forWho: {
    padding: '64px 28px',
    background: 'var(--bg-surface-alt)',
  },
  forWhoInner: {
    maxWidth: 800,
    margin: '0 auto',
    textAlign: 'center',
  },
  forWhoBody: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '0 0 36px',
  },
  forWhoList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
    marginTop: 24,
    textAlign: 'left',
  },
  forWhoItem: {
    display: 'flex',
    gap: 10,
    fontSize: 14,
    color: 'var(--text-primary)',
    lineHeight: 1.5,
  },
  forWhoBullet: {
    color: 'var(--accent)',
    fontWeight: 700,
    flexShrink: 0,
  },

  // Trust
  trust: {
    padding: '80px 28px',
  },
  trustInner: {
    maxWidth: 1000,
    margin: '0 auto',
  },
  trustGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 28,
    marginTop: 36,
  },
  trustItem: {
    padding: 20,
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--border-tertiary)',
    borderRadius: 12,
  },
  trustIcon: {
    fontSize: 24,
    marginBottom: 10,
  },
  trustTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 6,
  },
  trustBody: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  trustFooter: {
    marginTop: 36,
    textAlign: 'center',
    fontSize: 12,
  },
  trustLink: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
  },
  trustSep: {
    color: 'var(--text-tertiary)',
    margin: '0 8px',
  },

  // Pricing
  pricing: {
    padding: '64px 28px',
    background: 'var(--bg-surface-alt)',
  },
  pricingInner: {
    maxWidth: 640,
    margin: '0 auto',
    textAlign: 'center',
  },
  pricingBody: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: '0 0 16px',
  },
  pricingCta: {
    marginTop: 24,
  },

  // Footer CTA
  footerCta: {
    padding: '72px 28px',
    background: 'var(--accent-soft)',
    borderTop: '0.5px solid var(--accent-soft-border)',
    borderBottom: '0.5px solid var(--accent-soft-border)',
  },
  footerCtaInner: {
    maxWidth: 640,
    margin: '0 auto',
    textAlign: 'center',
  },
  footerCtaTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 18px',
    lineHeight: 1.2,
  },
  footerCtaBody: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.55,
    margin: '0 0 28px',
  },

  // Footer
  footer: {
    padding: '40px 28px 24px',
    background: 'var(--bg-surface)',
  },
  footerInner: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 32,
    paddingBottom: 32,
    borderBottom: '0.5px solid var(--border-tertiary)',
  },
  footerCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  footerColTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  footerLink: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    textDecoration: 'none',
  },
  footerTag: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    marginTop: 4,
  },
  footerMeta: {
    fontSize: 11,
    color: 'var(--text-tertiary)',
    marginTop: 4,
  },
  footerBottom: {
    maxWidth: 1100,
    margin: '24px auto 0',
    fontSize: 11,
    color: 'var(--text-tertiary)',
    textAlign: 'center',
  },
};
