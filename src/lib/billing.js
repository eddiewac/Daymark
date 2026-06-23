// ── Billing & subscription helpers ──────────────────────────────────────────
//
// The single source of truth for "is enforcement on?" and "what state is this
// workspace in?". Other code consults these helpers rather than reading
// subscription fields directly.
//
// Right now enforcement is OFF by default (feature flag). The UI still shows
// trial countdowns and an "early access" banner so we can find friction
// during real-world use without locking anyone out.

// Feature flag: set to true to actually enforce the trial → read-only flow.
// Until this is true, all team workspaces remain fully writable regardless
// of subscription_status or trial_ends_at.
//
// We also allow per-browser override via localStorage for testing the
// enforced flow locally:  localStorage.setItem('daymark-billing-enforce', '1')
const ENFORCE_BILLING_DEFAULT = false;

export function billingEnforced() {
  if (ENFORCE_BILLING_DEFAULT) return true;
  try {
    return localStorage.getItem('daymark-billing-enforce') === '1';
  } catch {
    return false;
  }
}

// ── Workspace state classification ─────────────────────────────────────────
//
// Returns one of:
//   'active'    — paid, full access
//   'trial'     — trial in progress, full access
//   'expired'   — trial over and unpaid, READ-ONLY (when enforcement is on)
//   'past_due'  — was paid but payment failed, READ-ONLY (when enforcement is on)
//   'canceled'  — owner canceled, access until period end then read-only
//   'free'      — personal workspace (workspaceId == null)

export function workspaceState(ws) {
  if (!ws) return 'free';

  // Paid + active subscription → always good
  if (ws.subscriptionStatus === 'active' || ws.paid) return 'active';

  if (ws.subscriptionStatus === 'past_due') return 'past_due';
  if (ws.subscriptionStatus === 'canceled') return 'canceled';

  // Otherwise, evaluate trial status
  const ends = ws.trialEndsAt ? new Date(ws.trialEndsAt).getTime() : 0;
  const now = Date.now();

  if (!ends) return 'trial'; // missing data — be permissive
  return now < ends ? 'trial' : 'expired';
}

// ── Permission: can the user write to this workspace? ──────────────────────
// When enforcement is off (default): always true.
// When enforcement is on: trial/active = true; expired/past_due = false.
export function canWriteToWorkspace(ws) {
  if (!ws) return true; // personal workspace
  if (!billingEnforced()) return true;

  const state = workspaceState(ws);
  return state === 'active' || state === 'trial' || state === 'canceled';
  // canceled is still writable until period end. Stripe webhook flips to
  // expired when the period ends.
}

// ── Trial countdown ────────────────────────────────────────────────────────
export function daysLeftInTrial(ws) {
  if (!ws?.trialEndsAt) return null;
  const ms = new Date(ws.trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

// ── Owner check ────────────────────────────────────────────────────────────
export function isWorkspaceOwner(ws, userId) {
  if (!ws || !userId) return false;
  return ws.ownerId === userId;
}

// ── Pricing (single source of truth for the UI) ─────────────────────────────
//
// Two tiers:
//   • Standard — flat per-workspace, unlimited members. The differentiator:
//     one price per team, no per-seat tax on collaboration.
//   • Enterprise — custom pricing for large agencies / company-wide rollout.
//     Procurement at that scale expects a custom quote, so we don't publish a
//     number; the UI shows "Contact us".
export const WORKSPACE_PRICE_USD = 29; // Standard: per workspace, per month
export const TRIAL_DAYS = 14;

// Tier definitions for the pricing UI to render from. Keeping this here means
// the pricing page, settings, and any upgrade prompts all stay in sync.
export const PRICING_TIERS = [
  {
    id: 'standard',
    name: 'Standard',
    priceUsd: WORKSPACE_PRICE_USD,
    priceLabel: `$${WORKSPACE_PRICE_USD}`,
    period: '/workspace /month',
    tagline: 'One flat price per team — unlimited members.',
    features: [
      'Unlimited members per workspace',
      'All projects, deliverables & tracking',
      'Resourcing & cross-workspace sharing',
      'Congress planning',
      `${TRIAL_DAYS}-day free trial`,
    ],
    cta: 'Start free trial',
    custom: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceUsd: null,
    priceLabel: 'Custom',
    period: '',
    tagline: 'For large agencies and company-wide rollouts.',
    features: [
      'Everything in Standard',
      'Volume pricing across many teams',
      'Procurement & invoicing support',
      'Onboarding & priority support',
      'Security review & custom terms',
    ],
    cta: 'Contact us',
    custom: true,
  },
];
