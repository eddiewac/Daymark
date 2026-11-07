# Stripe Checkout setup

Scenario **B**. Latest `main` (`a78f861`, fetched before this change) has no `stripe.checkout.sessions.create` call and no Stripe SDK. This change adds one sandbox-only Netlify Function. It does not change the billing UI, the floating notepad, confidential notes, or the marketing homepage.

The upgrade button in [src/components/WorkspaceManagePopover.jsx](src/components/WorkspaceManagePopover.jsx) still shows the existing “Stripe integration not enabled yet” alert. Wiring that button is intentionally not part of this change.

## Next owner step

In the **Daymark sandbox** (test mode, not live mode), create a restricted key whose prefix is `rk_test_`, then set the Netlify environment variables in the table below. Leave the three sample values in place until you replace them: the function refuses to call Stripe while they remain. Do not paste the key into chat, git, or any `VITE_` variable.

## Files

| File | Role |
| --- | --- |
| [netlify/functions/checkoutSession.js](netlify/functions/checkoutSession.js) | Field intents, placeholders, and fail-closed checks. No network. |
| [netlify/functions/create-checkout-session.js](netlify/functions/create-checkout-session.js) | Netlify Function. The only `checkout.sessions.create` call. |
| [netlify/functions/checkoutSession.check.js](netlify/functions/checkoutSession.check.js) | Unit and static checks. No Stripe network. No customer data. |

Placeholder values live in [netlify/functions/checkoutSession.js](netlify/functions/checkoutSession.js) as `SAMPLE_PRICE_ID`, `SAMPLE_SUCCESS_URL`, and `SAMPLE_CANCEL_URL`.

## Values to set

| Field | Current value | What to set |
| --- | --- | --- |
| Mode | `subscription` | Leave `subscription`. The service is recurring. |
| Price | `price_...` | Sandbox Price `price_1UZ7JbF8hZNSn1FgHXFOLd8U`. Set `STRIPE_PRICE_ID` in Netlify. Do not put this id in client code. |
| Success URL | `https://example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}` | An `https` URL you control. Keep `{CHECKOUT_SESSION_ID}` if the page needs the session id. There is no checkout return route in this repo. The page must not unlock the workspace. |
| Cancel URL | `https://example.com/checkout/cancel` | An `https` URL you control. |
| Quantity | `1` (server constant) | Not accepted from the browser. This is not a seat count. See pre-live tasks. |
| Secret key | unset | Sandbox restricted key (`rk_test_`). `sk_test_` is accepted and not recommended. Any `sk_live_` or `rk_live_` key is refused. |

`example.com`, `example.org`, and `example.net` are treated as placeholders and fail closed.

### Verified sandbox Price (not active in code)

Read-only connector context, account **Daymark sandbox** (`acct_1TRsgfF8hZNSn1Fg`), livemode false:

| | |
| --- | --- |
| Product | `prod_VaHtVDhWrxfqIl`, name Daymark. Description: medical communications project management with deliverable tracking, follow-ups, time tracking, and freelancer invoicing. Billed monthly per paid seat. |
| Price | `price_1UZ7JbF8hZNSn1FgHXFOLd8U`, active, USD 1200 per month, `interval_count` 1, recurring, licensed, `per_unit`. |
| Tax behavior | unspecified |
| `trial_period_days` | null. A 14-day Stripe trial is **not** active on this Price. |

This change does not create or update Stripe products, prices, customers, or subscriptions. Confirm the Dashboard amount before anyone pays: Stripe stores USD in cents (`unit_amount`). The figure above is the amount supplied with the verified sandbox context.

The in-app copy in [src/lib/billing.js](src/lib/billing.js) is still `$29` per workspace with unlimited members. That does not match this per-seat sandbox Price. The copy was left unchanged.

## Configured Checkout parameters

Sent only after the fail-closed checks pass. `payment_method_types` is omitted. `automatic_tax.enabled` is false. No `customer_email`, `receipt_email`, or `invoice_creation`.

| Parameter | Value | Evidence |
| --- | --- | --- |
| `mode` | `subscription` | SDK `SessionCreateParams.Mode` includes `subscription`. Required for a recurring Price. |
| `ui_mode` | `hosted_page` | SDK 23.1.0 union is `elements`, `embedded_page`, `form`, `hosted_page`. API reference default is `hosted_page` (hosted page the customer is redirected to). Legacy `hosted` is the pre-21 name and was not substituted. |
| `billing_address_collection` | `auto` | Enum `auto`, `required`. |
| `phone_number_collection` | `{ enabled: false }` | Allowed when mode is `payment` or `subscription`. |
| `automatic_tax` | `{ enabled: false }` | Boolean `enabled`. Tax is off. |
| `allow_promotion_codes` | `false` | Boolean. |
| `payment_method_collection` | `always` | Included only because mode is `subscription`. SDK names `always` and `if_required`. Connector schema also listed `auto`; the configured value `always` is in both. |
| `submit_type` | `auto` | Enum includes `auto`. SDK text: allowed in `payment` or `subscription` mode. Blank or `auto` uses the `pay` button label. Value was not changed. |
| `integration_identifier` | `hosted_web_0001` | SDK type is `string`. Sent exactly as configured. Stripe’s agent guidance suggests an 8-letter random suffix for dashboard comparisons. That is not an API rejection, so the configured value was not rewritten. |
| `origin_context` | `web` | Enum `mobile_app`, `web`. Allowed when `ui_mode` is not `elements`. |
| `success_url`, `cancel_url` | sample `https://example.com/...` until replaced | Allowed for `hosted_page`. Not allowed for `embedded_page` or `elements`. |
| `line_items` | `[{ price, quantity: 1 }]` | Price comes from `STRIPE_PRICE_ID`. Quantity is the server constant. `adjustable_quantity` is not set. |

No fixed-field incompatibility was found against stripe-node 23.1.0 or the Checkout Session create schema. Nothing in the table was silently rewritten.

### Association fields (not field intents)

These stay so a later webhook can attach the session to the workspace. They are technical ids only.

| Parameter | When |
| --- | --- |
| `customer` | Only when `workspaces.stripe_customer_id` matches `cus_` + letters and digits. |
| `client_reference_id` | Workspace id. |
| `metadata.daymark_workspace_id` | Workspace id. |
| `metadata.daymark_owner_user_id` | Authenticated owner id. |

No workspace name, email, note, or client/patient content is sent.

The constructor is `new Stripe(secretKey)` with no second argument and no `apiVersion`. stripe-node 23.1.0 then sends its packaged default `2026-10-28.endive` (`Stripe.API_VERSION`). This repo does not choose that header. The skill text cited `2026-09-30.endive` and SDK 23.0.0; npm’s current 23.1.0 package is newer. The connector’s operation catalog reported OpenAPI `2026-09-30.preview`. Field names were checked against both.

`stripe docs /references/billing` and `stripe docs /references/security` returned 404 on Stripe CLI 1.55.8, with no login prompt. That is a missing page, not a gated-doc refusal. Public pages used instead are listed under Resources. No CLI login was attempted.

## Environment, dependency, deploy

Server variables. Set them in the Netlify UI (Site configuration → Environment variables) for **Functions**. Do not prefix them with `VITE_`. Vite would ship a `VITE_` value to the browser.

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Sandbox restricted key. Never `VITE_`, never committed. |
| `STRIPE_PRICE_ID` | Replace `price_...`. |
| `STRIPE_SUCCESS_URL` | Replace the example.com success URL. |
| `STRIPE_CANCEL_URL` | Replace the example.com cancel URL. |
| `SUPABASE_URL` | `https://….supabase.co` for this project. The public URL is already in [src/lib/supabase.js](src/lib/supabase.js). |
| `SUPABASE_ANON_KEY` | Public anon key (JWT role `anon`) from that same file. A `service_role` key is refused. |

Hosted Checkout returns `session.url`. A publishable key is not required. Do not add `VITE_STRIPE_PUBLISHABLE_KEY` for this flow.

Dependency: `stripe` **23.1.0** (exact). It requires Node 20 or newer. The function returns `node_below_20` on older runtimes. In Netlify, set the site Node version to 22 if the function logs that blocker. No `netlify.toml` was added, so the existing build command and publish directory stay as they are in the Netlify UI.

Recommended restricted-key permissions, everything else **None**:

| Resource | Permission | Why |
| --- | --- | --- |
| Checkout Sessions | Write | `POST /v1/checkout/sessions`, and expire if a live-mode session is ever returned. |
| Customers | Write | Checkout creates a customer when none is stored, and reads one when `customer` is set. |
| Prices | Read | The session references a Price. |
| Subscriptions | Write | Subscription mode creates a subscription at Stripe. |

Create the key in the Daymark **sandbox**, not live mode. If the sandbox log names another missing permission, add only that resource. Do not use an unrestricted secret key. Guide: [restricted API keys](https://docs.stripe.com/keys/restricted-api-keys).

Deploy from git so Netlify bundles `netlify/functions`. Publishing the `dist` folder alone does not deploy the function. Endpoint: `/.netlify/functions/create-checkout-session`. [public/_redirects](public/_redirects) was not changed. If that URL returns the app HTML, the function did not deploy.

The function fails closed when:

- the secret is missing, not a test key, a live key, a publishable key, or a webhook secret
- the Price or either URL is still a placeholder, not `https`, or not a real Price id
- Supabase URL is not an `https` `*.supabase.co` host, or the anon key is not role `anon`
- Node is below 20
- the body includes anything besides `workspaceId` (price, quantity, URLs, and mode are rejected)
- the caller is not the workspace owner
- `stripe_subscription_id` is already stored, or `stripe_customer_id` is non-empty and not a `cus_` id
- Stripe returns `livemode: true` (the URL is dropped; the code tries to expire that session)
- the URL host is not `checkout.stripe.com`

## Flow

1. A signed-in workspace owner sends `POST` with `Authorization: Bearer <Supabase access token>` and `{ "workspaceId": "<uuid>" }`.
2. The function rejects any other JSON field.
3. Placeholder, live-key, and auth configuration checks run before Stripe is called.
4. Supabase is called with that user’s token. RLS still applies. The row must be owned by that user. Selected columns are `id`, `owner_id`, `stripe_customer_id`, `stripe_subscription_id`.
5. The function creates one Checkout Session and returns `{ "url": "https://checkout.stripe.com/..." }`.
6. The browser would redirect to that URL. Nothing in Daymark is updated.

Creating the session does **not** activate subscription access. `paid`, `subscription_status`, `stripe_customer_id`, and `stripe_subscription_id` are not written. A successful payment, including a card charge in the sandbox, does not unlock the workspace. The success URL is not proof of payment. There is no webhook here, and this document does not include a sample that grants access on redirect.

An idempotency key is sent as `daymark_sandbox_checkout_<workspaceId>_<hour>` so a double click in the same hour reuses one Stripe request. That is not duplicate-subscription protection across hours.

## Sandbox test

Use Stripe’s test cards only. Do not use a real card. Official list: [Testing](https://docs.stripe.com/testing). Billing-specific cases: [Test your Billing integration](https://docs.stripe.com/billing/testing).

Visa success number: `4242424242424242`. Any future expiry (for example `12/34`), any 3-digit CVC, and any other form value. More brands and decline numbers are on the testing page.

1. Set the Netlify variables and deploy the git branch.
2. Sign in as the workspace owner on the deployed site.
3. In the browser console, using the workspace id from the app (not a patient id, not an email):

```javascript
const raw = localStorage.getItem('sb-yhzsexzgrzmghjxmxuwz-auth-token');
const token = JSON.parse(raw).access_token;
const workspaceId = 'PASTE-WORKSPACE-UUID';
const res = await fetch('/.netlify/functions/create-checkout-session', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: 'Bearer ' + token,
  },
  body: JSON.stringify({ workspaceId }),
});
const body = await res.json();
console.log(res.status, body.error || body.blockers || 'checkout url ready');
if (body.url) location.assign(body.url);
```

4. Before the placeholders are replaced, expect HTTP 503 and `checkout_not_ready`. Stripe is not called.
5. After they are replaced, complete Checkout with the test card above. Then reload Daymark. The workspace billing state must be unchanged. Cancel the sandbox subscription in the Stripe Dashboard if you do not want it to renew there. This app has no cancel control yet.

Do not paste the access token or the restricted key into chat.

## Blocking work before any live payment

Do not switch on live keys, live mode, or billing enforcement until all of these exist. This PR does not implement them.

- **Webhooks.** Verify `Stripe-Signature` against the raw body, with the endpoint’s webhook secret. Make handling idempotent. Fulfillment belongs on `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and only when `payment_status` is paid. Also handle `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, and `invoice.payment_failed`. The success redirect must not grant access. [Webhooks](https://docs.stripe.com/webhooks).
- **Trusted linkage.** Persist `stripe_customer_id` and `stripe_subscription_id` from the verified webhook, using the metadata workspace id. The columns already exist on `workspaces` ([initial schema](supabase/migrations/20260511000000_initial_schema.sql), read in [src/lib/workspaces.js](src/lib/workspaces.js)). No new billing table was added.
- **Seats.** The sandbox Price is licensed per unit. Quantity is hardcoded to 1. Before launch, quantity has to come from a trusted seat authority, including proration when seats change. The browser cannot choose it.
- **Trial.** App copy uses a 14-day workspace trial (`TRIAL_DAYS` in [src/lib/billing.js](src/lib/billing.js)). The Stripe Price has `trial_period_days` null. Decide the Checkout trial separately (`subscription_data.trial_period_days` or the equivalent) and how it relates to `trial_ends_at`. Do not describe the Stripe trial as already on.
- **Portal, cancellation, and failed payments.** Not in this PR. Owners still cannot update a card or cancel in the app.
- **Duplicate subscriptions.** The function stops when `stripe_subscription_id` is already stored. It cannot see a subscription that exists only in Stripe, because nothing writes that column. Two checkouts can create two Stripe subscriptions until webhooks and a uniqueness check exist.
- **Bank and verification.** Stripe may require identity or bank verification before live charges. Not started.
- **Tax.** `automatic_tax` is false. Review whether Daymark must collect sales tax, VAT, or GST, and add registrations before turning tax on. An enabled flag with no registration collects nothing. This change does not turn tax on.
- **Price and copy.** Reconcile the $29 unlimited-member UI with the per-seat sandbox Price before showing a pay button.
- **Dashboard email.** This code does not enable receipt or invoice emails. Stripe can still send subscription email from Dashboard settings. Review those before launch.

## Checks

No Stripe secret was available, and no Checkout Session was created against the sandbox. The unit file uses short fake ids and does not contain a real person, patient, or card.

Command: `node netlify/functions/checkoutSession.check.js`

Command: `npm run build`

Results from this implementation, with no Stripe key in the environment:

- `node netlify/functions/checkoutSession.check.js` printed `checkoutSession.check.js: ok`.
- `npm run build` passed (`vite v5.4.21`, production build completed). A search of `dist/` found no `sk_live_`, `rk_live_`, `STRIPE_SECRET`, `VITE_STRIPE`, `checkout.sessions.create`, or the sandbox Price id. Vite still prints its existing notice that the client bundle is large; this endpoint is not in that bundle.

## Resources

- [Stripe support](https://support.stripe.com)
- [Stripe MCP docs](https://docs.stripe.com/mcp)
- [Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create)
- [Hosted subscription Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions?payment-ui=stripe-hosted)
- [API keys](https://docs.stripe.com/keys)
- [Restricted API keys](https://docs.stripe.com/keys/restricted-api-keys)
- [Key best practices](https://docs.stripe.com/keys-best-practices)
- [Testing](https://docs.stripe.com/testing)
- [Webhooks](https://docs.stripe.com/webhooks)
