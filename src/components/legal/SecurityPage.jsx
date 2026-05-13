import LegalPage from './LegalPage.jsx';

const CONTENT = `# Security & Privacy

We built Daymark for medical communications agencies. That means we know the kind of work you do involves sensitive client information, regulatory considerations, and pharmaceutical company contractual obligations. This page describes how we approach security and privacy.

## What we believe

**Your data belongs to you.** We don't sell it, share it with advertisers, or use it to train AI models. You can delete your account and your data at any time.

**Be honest about what we can and can't do.** Daymark is built by a small team with limited resources. We do many things well, and there are some things we haven't built yet. This page tries to be straight about both.

**Privacy is part of the product, not a compliance afterthought.** The decisions we make about features (no advertising, no third-party tracking, account deletion built in from day one) reflect this.

## Where your data lives

Daymark uses Supabase as its database and authentication provider. Customer data is stored in Supabase's eu-west-1 region (Ireland, European Union).

Hosting within the EU means your data is subject to EU data protection law, including the GDPR. For UK users, data hosted in Ireland remains under UK-recognised data protection standards. Australia users benefit from the same GDPR-compliant infrastructure.

## How we protect your data

- **All data is encrypted in transit** using TLS (HTTPS)
- **All data is encrypted at rest** in our database
- **Backups are automated and encrypted** through Supabase
- **Authentication** uses industry-standard practices: Google OAuth, secure password hashing, optional multi-factor authentication
- **Principle of least privilege** — only authorised personnel can access production systems, and access is logged
- **Sub-processors are kept to a minimum** — we use Supabase, Netlify, and Cloudflare as our infrastructure providers, and Stripe for payments when paid plans launch. Each is contractually bound to data protection terms.

## What we don't do

We don't:
- Sell user data to anyone
- Share user data with advertisers
- Use customer workspace content (projects, tasks, notes, etc.) for AI training
- Use third-party tracking pixels or advertising cookies
- Track you across other websites
- Lock your data in — you can export everything at any time

## GDPR, UK GDPR, and Australian Privacy Act

Daymark is operated from Brisbane, Australia, and is built to comply with:
- Australian Privacy Act 1988 and Australian Privacy Principles
- EU General Data Protection Regulation (GDPR)
- UK GDPR

You can:
- Access your data at any time within Daymark
- Export your data at any time
- Delete your account and your data at any time (Settings → Delete Account)
- Request rectification, restriction, or portability of your data by emailing privacy@getdaymark.com

For business customers, a Data Processing Agreement (DPA) is available on request from privacy@getdaymark.com.

## Breach notification

In the event of a personal data breach that poses a risk to user rights and freedoms, we will notify affected users and the relevant supervisory authority within 72 hours of becoming aware of the breach, in accordance with GDPR Article 33.

## Honest about gaps

Things we don't have yet that some buyers expect:

**SOC 2 Type II certification.** SOC 2 is a comprehensive third-party audit of security controls. It's a meaningful commitment for any SaaS company but expensive to obtain ($30k–$50k AUD over 6–12 months). We will pursue it once we have enterprise customers who require it.

**ISO 27001 certification.** Same reasoning as SOC 2. Not yet, but the controls described above broadly align with ISO 27001 Annex A requirements.

**Dedicated Data Protection Officer (DPO).** Not yet required given our scale and the nature of data we process. Privacy queries are handled directly by the founder.

If your agency or your agency's clients require any of the above, talk to us. We can usually find a path forward, even if formal certification isn't yet in place.

## Sub-processors

| Service | Purpose | Location |
|---|---|---|
| Supabase | Database, authentication, file storage | Ireland (EU) |
| Netlify | Web hosting and CDN | Global |
| Cloudflare | DNS, email forwarding, security | Global |
| Google | Optional sign-in | EU/US |
| Stripe (when payments enabled) | Payment processing | Australia/EU/US |

A current sub-processor list is available from privacy@getdaymark.com.

## Changes to these practices

If we make material changes to how we handle data, we'll let you know via email or in-app notice before the changes take effect. The Privacy Policy is the authoritative document — this page is a plain-English overview.

## Contact

**Privacy and security questions:** privacy@getdaymark.com
**General support:** support@getdaymark.com
**Data Processing Agreement requests:** privacy@getdaymark.com

For full legal detail, see our [Privacy Policy](/privacy) and [Terms of Service](/terms).
`;

export default function SecurityPage() {
  return <LegalPage title="Security & Privacy" content={CONTENT} />;
}
