// Sandbox checkout guards. No Stripe network calls and no real customer data.
//   node netlify/functions/checkoutSession.check.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';
import {
  CHECKOUT_QUANTITY,
  FIELD_INTENTS,
  SAMPLE_CANCEL_URL,
  SAMPLE_PRICE_ID,
  SAMPLE_SUCCESS_URL,
  acceptableCheckoutUrl,
  associationBlockers,
  buildIdempotencyKey,
  buildSessionCreateParams,
  classifySecretKey,
  handleCheckoutRequest,
  parseCheckoutBody,
  readinessBlockers,
  resolveSettings,
} from './checkoutSession.js';
import { createStripeClient, handler } from './create-checkout-session.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function anonJwt(role = 'anon') {
  const payload = Buffer.from(JSON.stringify({ role, ref: 'unit' })).toString('base64url');
  return `eyJhbGciOiJub25lIn0.${payload}.sig`;
}

const workspaceId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const readyPrice = 'price_unittestprice';
const readyEnv = {
  STRIPE_SECRET_KEY: 'rk_test_examplekey',
  STRIPE_PRICE_ID: readyPrice,
  STRIPE_SUCCESS_URL: 'https://billing.example.test/success?session_id={CHECKOUT_SESSION_ID}',
  STRIPE_CANCEL_URL: 'https://billing.example.test/cancel',
  SUPABASE_URL: 'https://example-project.supabase.co',
  SUPABASE_ANON_KEY: anonJwt('anon'),
};

function readyRequest(overrides = {}) {
  const calls = [];
  const deps = {
    loadOwnerWorkspace: async () => ({
      userId,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    }),
    createSession: async (input) => {
      calls.push(input);
      return { livemode: false, url: 'https://checkout.stripe.com/c/pay/cs_test_unit' };
    },
    ...overrides.deps,
  };
  return {
    calls,
    run: () =>
      handleCheckoutRequest({
        method: 'POST',
        headers: { authorization: 'Bearer unit-token' },
        rawBody: JSON.stringify({ workspaceId }),
        env: readyEnv,
        now: Date.UTC(2026, 10, 7, 12, 0, 0),
        deps,
        ...overrides.request,
      }),
  };
}

const defaults = resolveSettings({});
assert(defaults.priceId === SAMPLE_PRICE_ID, 'default price placeholder');
assert(defaults.successUrl === SAMPLE_SUCCESS_URL, 'default success placeholder');
assert(defaults.cancelUrl === SAMPLE_CANCEL_URL, 'default cancel placeholder');
assert(defaults.quantity === 1, 'quantity is server controlled');
const defaultBlockers = readinessBlockers(defaults, { nodeVersion: '22.0.0' });
for (const code of [
  'missing_secret_key',
  'missing_supabase_url',
  'missing_supabase_anon_key',
  'placeholder_price',
  'placeholder_success_url',
  'placeholder_cancel_url',
]) {
  assert(defaultBlockers.includes(code), `expected blocker ${code}, got ${defaultBlockers.join(',')}`);
}

assert(classifySecretKey('sk_live_example').reason === 'live_key_refused', 'live secret refused');
assert(classifySecretKey('rk_live_example').reason === 'live_key_refused', 'live restricted refused');
assert(classifySecretKey('pk_test_example').reason === 'publishable_key_refused', 'publishable refused');
assert(classifySecretKey('whsec_example').reason === 'webhook_secret_refused', 'webhook secret refused');
assert(classifySecretKey('rk_test_examplekey').ok === true, 'sandbox restricted key accepted');
assert(classifySecretKey('sk_test_examplekey').ok === true, 'sandbox secret key accepted');
assert(classifySecretKey('rk_test_examplekey\nmore').ok === false, 'multiline key refused');

const liveSettings = resolveSettings({ ...readyEnv, STRIPE_SECRET_KEY: 'sk_live_example' });
assert(
  readinessBlockers(liveSettings, { nodeVersion: '22.0.0' }).includes('live_key_refused'),
  'live key blocks a otherwise ready config'
);
const serviceSettings = resolveSettings({ ...readyEnv, SUPABASE_ANON_KEY: anonJwt('service_role') });
assert(
  readinessBlockers(serviceSettings, { nodeVersion: '22.0.0' }).includes('service_role_refused'),
  'service role refused'
);
assert(
  readinessBlockers(resolveSettings(readyEnv), { nodeVersion: '18.20.0' }).includes('node_below_20'),
  'node 18 blocks stripe-node 23'
);
assert(
  readinessBlockers(resolveSettings(readyEnv), { nodeVersion: '22.23.4' }).length === 0,
  'ready sandbox settings have no blockers'
);

const untrusted = parseCheckoutBody(JSON.stringify({
  workspaceId,
  price: readyPrice,
  quantity: 4,
  success_url: 'https://billing.example.test/success',
}));
assert(untrusted.error === 'untrusted_client_field', 'client price and quantity rejected');
assert(untrusted.fields.includes('price') && untrusted.fields.includes('quantity'), 'field names only');

const params = buildSessionCreateParams({
  priceId: readyPrice,
  successUrl: readyEnv.STRIPE_SUCCESS_URL,
  cancelUrl: readyEnv.STRIPE_CANCEL_URL,
  workspaceId,
  userId,
  stripeCustomerId: 'cus_unittest',
});
assert(params.mode === 'subscription', 'mode');
assert(params.ui_mode === 'hosted_page', 'ui_mode');
assert(params.billing_address_collection === 'auto', 'billing address');
assert(params.phone_number_collection.enabled === false, 'phone off');
assert(params.automatic_tax.enabled === false, 'tax off');
assert(Object.keys(params.automatic_tax).join() === 'enabled', 'tax object has no extra keys');
assert(params.allow_promotion_codes === false, 'promotion codes off');
assert(params.payment_method_collection === 'always', 'payment method collection');
assert(params.submit_type === 'auto', 'submit type');
assert(params.integration_identifier === 'hosted_web_0001', 'integration identifier');
assert(params.origin_context === 'web', 'origin context');
assert(params.customer === 'cus_unittest', 'existing customer reused');
assert(params.line_items.length === 1, 'one line');
assert(params.line_items[0].price === readyPrice, 'server price');
assert(params.line_items[0].quantity === CHECKOUT_QUANTITY, 'server quantity');
assert(Object.keys(params.line_items[0]).sort().join() === 'price,quantity', 'no adjustable quantity');
assert(!Object.hasOwn(params, 'payment_method_types'), 'dynamic payment methods');
assert(!Object.hasOwn(params, 'customer_email'), 'no email sent to Stripe');
assert(!Object.hasOwn(params, 'subscription_data'), 'no trial or subscription lifecycle');
assert(!Object.hasOwn(params, 'invoice_creation'), 'no extra invoices');
assert(params.metadata.daymark_workspace_id === workspaceId, 'workspace metadata');
assert(params.metadata.daymark_owner_user_id === userId, 'owner metadata');
assert(Object.keys(params.metadata).length === 2, 'metadata is technical ids only');
assert(params.mode === FIELD_INTENTS.mode, 'mode matches the fixed intent');

const withoutCustomer = buildSessionCreateParams({
  priceId: readyPrice,
  successUrl: readyEnv.STRIPE_SUCCESS_URL,
  cancelUrl: readyEnv.STRIPE_CANCEL_URL,
  workspaceId,
  userId,
  stripeCustomerId: null,
});
assert(!Object.hasOwn(withoutCustomer, 'customer'), 'omit customer when none is stored');
assert(
  associationBlockers({ stripeSubscriptionId: 'sub_existing' }).includes('subscription_already_recorded'),
  'stored subscription blocks another checkout'
);
assert(
  associationBlockers({ stripeCustomerId: 'not-a-customer' }).includes('stored_customer_invalid'),
  'malformed stored customer blocks checkout'
);

const placeholderCall = readyRequest({
  request: { env: {} },
});
const placeholderResult = await placeholderCall.run();
assert(placeholderResult.statusCode === 503, 'placeholders fail closed');
assert(placeholderResult.body.error === 'checkout_not_ready', 'not ready');
assert(!placeholderResult.body.url, 'no url while placeholders remain');
assert(placeholderCall.calls.length === 0, 'stripe not called for placeholders');

const nodeResult = await readyRequest({ request: { nodeVersion: '18.0.0' } }).run();
assert(nodeResult.statusCode === 503, 'old node fail closed');
assert(nodeResult.body.blockers.includes('node_below_20'), 'node blocker');

const liveCall = readyRequest({
  request: { env: { ...readyEnv, STRIPE_SECRET_KEY: 'rk_live_example' } },
});
const liveResult = await liveCall.run();
assert(liveResult.statusCode === 503, 'live key fail closed');
assert(liveResult.body.blockers.includes('live_key_refused'), 'live blocker');
assert(liveCall.calls.length === 0, 'stripe not called for live key');
assert(!JSON.stringify(liveResult.body).includes('rk_live_example'), 'live key not echoed');

const untrustedResult = await handleCheckoutRequest({
  method: 'POST',
  headers: { Authorization: 'Bearer unit-token' },
  rawBody: JSON.stringify({ workspaceId, quantity: 9 }),
  env: readyEnv,
  deps: { loadOwnerWorkspace: async () => { throw new Error('should not auth'); }, createSession: async () => { throw new Error('should not create'); } },
});
assert(untrustedResult.statusCode === 400, 'untrusted body');
assert(untrustedResult.body.fields.includes('quantity'), 'quantity field rejected');

const anon = await readyRequest({ request: { headers: {} } }).run();
assert(anon.statusCode === 401, 'anonymous rejected');

const forbidden = await readyRequest({
  deps: { loadOwnerWorkspace: async () => ({ error: 'forbidden' }) },
}).run();
assert(forbidden.statusCode === 403, 'non-owner rejected');

const duplicate = await readyRequest({
  deps: {
    loadOwnerWorkspace: async () => ({
      userId,
      stripeCustomerId: 'cus_unittest',
      stripeSubscriptionId: 'sub_unittest',
    }),
  },
}).run();
assert(duplicate.statusCode === 409, 'existing subscription id blocks');
assert(duplicate.body.blockers.includes('subscription_already_recorded'), 'duplicate blocker');

const ok = readyRequest();
const okResult = await ok.run();
assert(okResult.statusCode === 200, 'sandbox session url returned');
assert(okResult.body.url === 'https://checkout.stripe.com/c/pay/cs_test_unit', 'hosted url');
assert(Object.keys(okResult.body).join() === 'url', 'response is only the url');
assert(ok.calls.length === 1, 'one create');
assert(ok.calls[0].secretKey === 'rk_test_examplekey', 'test key passed through');
assert(ok.calls[0].params.payment_method_collection === 'always', 'subscription collection');
assert(ok.calls[0].params.line_items[0].quantity === 1, 'quantity not from client');
assert(
  ok.calls[0].idempotencyKey === buildIdempotencyKey(workspaceId, Date.UTC(2026, 10, 7, 12, 0, 0)),
  'idempotency key'
);
assert(!JSON.stringify(okResult.body).includes(userId), 'user id not returned to browser');

const livemode = await readyRequest({
  deps: { createSession: async () => ({ livemode: true, url: 'https://checkout.stripe.com/c/pay/cs_live_nope' }) },
}).run();
assert(livemode.statusCode === 503, 'livemode response refused');
assert(livemode.body.error === 'livemode_refused', 'livemode code');
assert(!livemode.body.url, 'live url dropped');

const oddHost = await readyRequest({
  deps: { createSession: async () => ({ livemode: false, url: 'https://checkout.stripe.com.evil.test/pay' }) },
}).run();
assert(oddHost.statusCode === 502, 'unexpected host refused');
assert(!oddHost.body.url, 'foreign url dropped');
assert(acceptableCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_ok') === true, 'stripe host');
assert(acceptableCheckoutUrl('http://checkout.stripe.com/c/pay/cs_test_ok') === false, 'https only');

const encoded = Buffer.from(JSON.stringify({ workspaceId }), 'utf8').toString('base64');
const decoded = await readyRequest({
  request: { rawBody: encoded, isBase64Encoded: true },
}).run();
assert(decoded.statusCode === 200, 'base64 body accepted');

const getResult = await readyRequest({ request: { method: 'GET' } }).run();
assert(getResult.statusCode === 405, 'get rejected');

const wrapped = await handler({
  httpMethod: 'POST',
  headers: {},
  body: JSON.stringify({ workspaceId }),
});
assert(wrapped.statusCode === 401, 'handler requires a bearer token');
assert(wrapped.headers['cache-control'] === 'no-store', 'no store');
const wrappedBody = JSON.parse(wrapped.body);
assert(wrappedBody.error === 'unauthorized', 'handler unauthorized body');

const stripeClient = createStripeClient('rk_test_examplekey');
assert(typeof stripeClient.checkout.sessions.create === 'function', 'instance create');
assert(typeof stripeClient.checkout.sessions.expire === 'function', 'instance expire');
assert(stripeClient.getApiField('version') === Stripe.API_VERSION, 'empty apiVersion uses SDK default');
assert(Stripe.API_VERSION === '2026-10-28.endive', `unexpected SDK API version ${Stripe.API_VERSION}`);

const handlerSource = fs.readFileSync(path.join(here, 'create-checkout-session.js'), 'utf8');
assert(handlerSource.includes('new Stripe(secretKey)'), 'StripeClient instance');
assert(!/apiVersion\s*:/.test(handlerSource), 'apiVersion argument left empty');
assert(!handlerSource.includes('payment_method_types'), 'payment_method_types omitted');
assert(handlerSource.includes(".select('id, owner_id, stripe_customer_id, stripe_subscription_id')"), 'billing columns only');
assert(!handlerSource.includes('customer_email'), 'handler does not send email');
assert(!/process\.env\.VITE_/.test(handlerSource), 'no VITE_ env in server function');
assert(!handlerSource.includes('VITE_' + 'STRIPE'), 'no vite stripe name');

const sessionSource = fs.readFileSync(path.join(here, 'checkoutSession.js'), 'utf8');
assert(!sessionSource.includes('payment_method_types'), 'builder omits payment method types');
assert(!sessionSource.includes('trial_period_days'), 'no trial invented');

const secretPatterns = [
  /sk_live_[A-Za-z0-9]{20,}/,
  /rk_live_[A-Za-z0-9]{20,}/,
  /sk_test_[A-Za-z0-9]{20,}/,
  /rk_test_[A-Za-z0-9]{20,}/,
  /pk_live_[A-Za-z0-9]{8,}/,
  /pk_test_[A-Za-z0-9]{20,}/,
  /whsec_[A-Za-z0-9]{20,}/,
];
const scanned = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx|md|toml|json|html|css)$/.test(entry.name) && entry.name !== 'package-lock.json') scanned.push(full);
  }
}
walk(root);
const todoPath = path.join(root, 'STRIPE_INTEGRATION_TODO.md');
assert(fs.existsSync(todoPath), 'TODO file exists');
const todo = fs.readFileSync(todoPath, 'utf8');
const todoPrices = todo.match(/price_[A-Za-z0-9]{8,}/g) || [];
assert(todoPrices.length >= 1, 'TODO lists a configurable sandbox price id');
assert(todo.includes(SAMPLE_PRICE_ID), 'TODO lists the price placeholder');
assert(todo.includes('example.com'), 'TODO lists the example.com placeholders');
for (const file of scanned) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of secretPatterns) {
    assert(!pattern.test(text), `${path.relative(root, file)} matched ${pattern}`);
  }
  if (file !== todoPath) {
    for (const price of todoPrices) {
      assert(!text.includes(price), `${path.relative(root, file)} must not embed ${price}`);
    }
    if (file.endsWith('.js') || file.endsWith('.jsx')) {
      const viteStripe = 'VITE_' + 'STRIPE';
      assert(!text.includes(viteStripe), `${path.relative(root, file)} must not name a Vite Stripe variable`);
    }
  }
}

console.log('checkoutSession.check.js: ok');
