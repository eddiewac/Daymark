import LegalPage from './LegalPage.jsx';

const CONTENT = `# Terms of Service

**Last updated:** 30 May 2026
**Effective date:** 8 May 2026

These Terms of Service ("Terms") govern your use of Daymark, a project management web application available at getdaymark.com ("the Service"), operated by Edward Carter, trading as Kenilworth & Co (ABN 76 959 252 036) ("we", "us", "our").

By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.

## 1. Eligibility

You must be at least 16 years old to use Daymark. If you are using Daymark on behalf of an organisation, you represent that you have authority to bind that organisation to these Terms.

## 2. Accounts

You are responsible for:
- Providing accurate registration information
- Keeping your password confidential
- All activity that occurs under your account
- Notifying us immediately of any unauthorised access at support@getdaymark.com

We may suspend or terminate accounts that:
- Violate these Terms
- Are inactive for more than 24 months (with prior notice)
- Are used for unlawful or abusive purposes

## 3. Workspaces

Daymark organises work into "workspaces":

- **Personal workspaces** are private to you
- **Team workspaces** are shared with members you invite

If you create a team workspace, you are the workspace administrator. You control:
- Who is invited to the workspace
- What data is added to the workspace
- Whether to delete the workspace

If you are added to someone else's team workspace, the workspace administrator controls that workspace's data, including the right to remove you or delete the workspace.

## 4. Acceptable use

You agree not to use Daymark to:

- Violate any applicable law or regulation
- Infringe anyone's intellectual property rights
- Upload viruses, malware, or other harmful code
- Attempt to gain unauthorised access to other accounts, workspaces, or systems
- Reverse-engineer, scrape, or systematically extract data from the Service
- Resell or sublicense the Service without our written agreement
- Use the Service to send spam, phishing attempts, or unsolicited communications
- Use the Service in a way that overburdens our infrastructure (excessive automated requests, etc.)
- Process personal data in violation of applicable data protection laws
- Upload content that is unlawful, harassing, defamatory, or infringes the rights of others

We reserve the right to remove content or suspend accounts that violate these rules.

## 5. Your content

You retain ownership of all content you upload to Daymark ("Your Content"). This includes projects, tasks, notes, comms logs, and any other data you create or upload.

You grant us a limited, non-exclusive, royalty-free licence to host, store, process, and display Your Content solely for the purpose of providing the Service to you.

We do not:
- Claim ownership of Your Content
- Use Your Content to train AI models
- Share Your Content with third parties for advertising or marketing purposes
- Sell Your Content under any circumstances

You are responsible for ensuring you have the right to upload Your Content (for example, that you have permission to store information about clients or colleagues if it includes their personal data).

## 6. Service availability

We aim to keep Daymark available at all times but do not guarantee uninterrupted service. The Service may be unavailable due to:
- Scheduled maintenance (we will provide notice where possible)
- Unscheduled maintenance or bug fixes
- Issues with our infrastructure providers (Supabase, Netlify, Cloudflare)
- Force majeure events

The Service is provided "as is" without warranty of any kind, to the extent permitted by law.

## 7. Pricing and payments

Daymark is currently free to use during its early access period.

When paid plans are introduced:
- Existing users will receive at least 30 days' notice
- Existing users will receive at least 3 months of free access from the date paid plans launch
- Pricing will be clearly displayed before any charges are made
- Subscription fees will be charged in advance and are non-refundable except as required by law (including the Australian Consumer Law for Australian users)

## 8. Intellectual property

The Service, including its software, design, branding, and documentation, is owned by Edward Carter, trading as Kenilworth & Co and is protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our written permission.

The "Daymark" name and logo are trademarks of Edward Carter, trading as Kenilworth & Co.

## 9. Privacy

Our handling of personal data is governed by our Privacy Policy at getdaymark.com/privacy. By using the Service, you acknowledge our Privacy Policy.

For business customers subject to GDPR, UK GDPR, or equivalent regulations, a Data Processing Agreement (DPA) is available from privacy@getdaymark.com.

## 10. Termination

You may terminate your account at any time via the Settings → Delete Account feature. On termination:
- Your account is deactivated immediately
- Your personal data is deleted from active systems within 30 days
- Encrypted backups containing your data are rotated within 90 days
- Workspaces you administer are either transferred to another member (if multiple members exist) or deleted

We may terminate or suspend your account if you breach these Terms, with or without notice depending on the severity of the breach.

## 11. Limitation of liability

To the maximum extent permitted by law:

- We are not liable for indirect, incidental, consequential, or special damages arising from your use of the Service
- Our total liability to you for any claim arising from the Service is limited to the greater of (a) the amount you paid us in the 12 months prior to the claim, or (b) AUD $100
- Nothing in these Terms excludes liability for fraud, fraudulent misrepresentation, death or personal injury caused by negligence, or any liability that cannot be lawfully excluded

For Australian users, nothing in these Terms excludes the application of consumer guarantees under the Australian Consumer Law.

## 12. Indemnity

You agree to indemnify and hold us harmless from claims arising from:
- Your use of the Service in breach of these Terms
- Your Content
- Your violation of any third party's rights
- Your violation of applicable law

## 13. Changes to these Terms

We may update these Terms from time to time. If we make material changes, we will notify you by email or via an in-app notice at least 30 days before the changes take effect. Continued use of the Service after the effective date constitutes acceptance of the updated Terms.

## 14. Governing law and disputes

These Terms are governed by the laws of Queensland, Australia.

Any dispute arising from these Terms or your use of the Service will be resolved in the courts of Queensland, Australia, unless applicable consumer law in your jurisdiction provides otherwise.

For EU/UK users: this clause does not deprive you of the protection of mandatory consumer-protection laws of the country where you are habitually resident.

## 15. Severability

If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions will continue in full force.

## 16. Contact

For questions about these Terms:

**Email:** support@getdaymark.com
**Postal:** Postal address available on request to support@getdaymark.com
`;

export default function TermsPage() {
  return <LegalPage title="Terms of Service" content={CONTENT} />;
}
