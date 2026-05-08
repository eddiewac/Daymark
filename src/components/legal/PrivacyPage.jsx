import LegalPage from './LegalPage.jsx';

const CONTENT = `# Privacy Policy

**Last updated:** 8 May 2026
**Effective date:** 8 May 2026

This Privacy Policy describes how Ed Carter, operating as Daymark ("we", "us", "our") collects, uses, stores, and shares personal data when you use Daymark, our project management web application, available at getdaymark.com (the "Service").

We take privacy seriously. This policy is written in plain English. If anything is unclear, contact us at privacy@getdaymark.com.

## 1. Who we are

Daymark is operated by Ed Carter, based in Brisbane, Australia.

For the purposes of the EU General Data Protection Regulation (GDPR), the UK GDPR, and the Australian Privacy Act 1988:

- We are the **data controller** for personal data we collect about you when you sign up and use Daymark.
- We are the **data processor** for any personal data you upload into Daymark (for example, names, emails, or notes about your colleagues, clients, or stakeholders).
- For data we process on your behalf, a Data Processing Agreement (DPA) is available — see Section 11 below.

## 2. What data we collect

We collect the following categories of personal data:

**Account data** — email address, name (if provided), authentication information from Google if you sign in with Google. Required to operate your account.

**Workspace data** — the projects, tasks, notes, comms logs, time entries, and other content you create in Daymark. This includes any personal data you choose to enter (e.g. names of colleagues or stakeholders).

**Usage data** — which features you use, when you log in, basic technical information like browser type and approximate location (derived from IP address). Used to improve the Service and to detect security issues.

**Communications** — if you contact us via email, we keep a record of the correspondence.

We do **not** collect:
- Special categories of personal data (e.g. health data, biometric data, religious beliefs) unless you choose to enter them yourself
- Payment card details (handled by our payment processor — see Section 6)
- Tracking data for advertising purposes — we do not use tracking pixels or advertising cookies

## 3. How we use your data

We use your personal data to:

- Provide the Daymark service and your workspaces
- Authenticate you and keep your account secure
- Communicate with you about your account, service updates, or support requests
- Detect and prevent abuse, fraud, or security incidents
- Comply with legal obligations
- Improve the Service based on aggregated usage patterns

We do **not**:
- Sell your personal data to third parties
- Share your personal data with advertisers
- Use your workspace content (projects, notes, etc.) for our own purposes, including AI training

## 4. Lawful basis for processing (GDPR / UK GDPR)

Where GDPR or UK GDPR applies, our lawful bases for processing your personal data are:

- **Contract** — to provide the Service you've signed up for
- **Legitimate interests** — to keep the Service secure, prevent fraud, and improve the product
- **Legal obligation** — to comply with applicable laws (e.g. tax records, lawful requests from authorities)
- **Consent** — for any optional processing where we ask for your explicit permission

## 5. Where your data is stored

Daymark uses Supabase as its database and authentication provider. Customer data is currently stored in Supabase's \`ap-northeast-1\` region (Tokyo, Japan).

Japan has been recognised by the European Commission as providing an adequate level of data protection (Adequacy Decision of 23 January 2019). Transfers of EU personal data to Japan are therefore permitted under Article 45 of the GDPR. The same recognition applies under UK GDPR.

For Australian users, data storage in Japan complies with Australian Privacy Principle 8 (cross-border disclosure) given Japan's adequate protection regime.

We are working to add additional hosting regions, including an EU region, before any enterprise deployment requires it.

## 6. Sub-processors we use

We use the following third-party services to operate Daymark:

| Service | Purpose | Location |
|---|---|---|
| Supabase | Database, authentication, file storage | Tokyo, Japan (with EU adequacy) |
| Netlify | Web hosting and content delivery | Global CDN |
| Cloudflare | DNS, email forwarding, security | Global |
| Google | Optional sign-in (OAuth only — no broader data sharing) | EU/US |
| Stripe (when payments enabled) | Payment processing | Australia / EU / US per customer location |

Each sub-processor is contractually bound to data protection terms equivalent to those described in this policy. A current sub-processor list is available on request from privacy@getdaymark.com.

## 7. How long we keep your data

- **Active account data**: kept while your account is active
- **After account deletion**: removed from our active systems within 30 days; may persist in encrypted backups for up to 90 days as part of normal backup rotation
- **Logs and aggregated usage data**: retained for up to 12 months for security and operational purposes
- **Email correspondence**: retained for up to 24 months
- **Legal records** (e.g. invoices, tax records): retained for 7 years as required by Australian law

## 8. Your rights

Under GDPR, UK GDPR, and the Australian Privacy Act, you have the following rights:

- **Right to access** — request a copy of the personal data we hold about you
- **Right to rectification** — ask us to correct inaccurate data
- **Right to erasure ("right to be forgotten")** — ask us to delete your account and personal data. You can do this yourself in Settings; or contact us if you'd like assistance.
- **Right to restrict processing** — ask us to limit how we process your data
- **Right to data portability** — request your data in a machine-readable format
- **Right to object** — object to processing based on legitimate interests
- **Right to withdraw consent** — where processing is based on consent, you can withdraw it at any time

To exercise any of these rights, email privacy@getdaymark.com. We will respond within 30 days.

You also have the right to lodge a complaint with a supervisory authority:
- **Australia**: Office of the Australian Information Commissioner (oaic.gov.au)
- **UK**: Information Commissioner's Office (ico.org.uk)
- **EU**: your local data protection authority

## 9. Security

We protect your data with industry-standard security measures, including:

- **Encryption in transit**: all data transmitted between your browser and Daymark uses TLS (HTTPS)
- **Encryption at rest**: all data stored in our database is encrypted at rest
- **Authentication**: optional multi-factor authentication; secure password hashing for email/password accounts
- **Access control**: only authorised personnel have access to production systems; access is logged
- **Backups**: regular automated backups; backups are encrypted
- **Principle of least privilege**: services and people have only the minimum access necessary

We will notify affected users and (where required) the relevant data protection authority within 72 hours of becoming aware of a personal data breach that poses a risk to user rights and freedoms, in accordance with Article 33 of the GDPR.

## 10. Cookies and tracking

Daymark uses only the minimum cookies required for the Service to function:

- **Authentication cookies** — keep you logged in between visits
- **Preference cookies** — remember settings like which tab you were last on

We do **not** use:
- Advertising or marketing cookies
- Third-party tracking pixels
- Analytics tools that fingerprint or follow you across sites

## 11. Data Processing Agreement (DPA)

If you are a business customer subject to GDPR, UK GDPR, or equivalent regulations, a Data Processing Agreement is available on request from privacy@getdaymark.com. The DPA describes our role as a processor of personal data you upload into Daymark, our security measures, sub-processor arrangements, breach notification process, and your audit rights.

## 12. Children

Daymark is intended for use by professionals and is not designed for children under 16. We do not knowingly collect personal data from anyone under 16. If you become aware that a child has provided personal data to us, contact privacy@getdaymark.com and we will delete the data.

## 13. Changes to this policy

We may update this Privacy Policy from time to time. If we make material changes, we will notify you by email or via an in-app notice before the changes take effect. The "Last updated" date at the top of this policy indicates when it was last revised.

## 14. Contact us

For privacy questions, GDPR requests, or any other privacy-related matter:

**Email:** privacy@getdaymark.com
**Postal:** Postal address available on request to privacy@getdaymark.com

For general support: support@getdaymark.com
`;

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" content={CONTENT} />;
}
