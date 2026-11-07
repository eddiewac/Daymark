// Sandbox-only Checkout Session parameters for Daymark.
// Creating a session does not grant workspace access and does not write
// stripe_customer_id or stripe_subscription_id.

export const CHECKOUT_MODE = 'subscription';
export const CHECKOUT_QUANTITY = 1;

export const SAMPLE_PRICE_ID = 'price_...';
export const SAMPLE_SUCCESS_URL =
  'https://example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}';
export const SAMPLE_CANCEL_URL = 'https://example.com/checkout/cancel';

// Fixed field intents. Values are sent as configured after compatibility
// checks against stripe-node 23.1.0 (ui_mode hosted_page, not legacy hosted).
export const FIELD_INTENTS = Object.freeze({
  ui_mode: 'hosted_page',
  billing_address_collection: 'auto',
  phone_number_collection: Object.freeze({ enabled: false }),
  automatic_tax: Object.freeze({ enabled: false }),
  allow_promotion_codes: false,
  payment_method_collection: 'always',
  submit_type: 'auto',
  integration_identifier: 'hosted_web_0001',
  origin_context: 'web',
  mode: CHECKOUT_MODE,
});

const WORKSPACE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function nodeMajor(version = process.versions.node) {
  const major = Number(String(version).split('.')[0]);
  return Number.isFinite(major) ? major : 0;
}

function isExampleHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  return (
    host === 'example.com' ||
    host.endsWith('.example.com') ||
    host === 'example.org' ||
    host.endsWith('.example.org') ||
    host === 'example.net' ||
    host.endsWith('.example.net')
  );
}

export function classifySecretKey(value) {
  if (typeof value !== 'string') return { ok: false, reason: 'missing_secret_key' };
  const key = value.trim();
  if (!key) return { ok: false, reason: 'missing_secret_key' };
  if (/\s/.test(key)) return { ok: false, reason: 'unrecognized_key' };
  if (/^(sk|rk)_live_/.test(key)) return { ok: false, reason: 'live_key_refused' };
  if (key.startsWith('pk_')) return { ok: false, reason: 'publishable_key_refused' };
  if (key.startsWith('whsec_')) return { ok: false, reason: 'webhook_secret_refused' };
  if (/^(sk|rk)_test_[A-Za-z0-9]+$/.test(key) && key.length >= 16) {
    return { ok: true, key };
  }
  return { ok: false, reason: 'unrecognized_key' };
}

export function classifyAnonKey(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, reason: 'missing_supabase_anon_key' };
  }
  const parts = value.trim().split('.');
  if (parts.length !== 3) return { ok: false, reason: 'supabase_anon_key_unrecognized' };
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.role === 'service_role') return { ok: false, reason: 'service_role_refused' };
    if (payload.role !== 'anon') return { ok: false, reason: 'supabase_anon_key_unrecognized' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'supabase_anon_key_unrecognized' };
  }
}

export function classifySupabaseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, reason: 'missing_supabase_url' };
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false, reason: 'missing_supabase_url' };
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return { ok: false, reason: 'missing_supabase_url' };
  }
  if (isExampleHost(url.hostname)) return { ok: false, reason: 'placeholder_supabase_url' };
  if (!url.hostname.endsWith('.supabase.co')) {
    return { ok: false, reason: 'supabase_url_not_project' };
  }
  return { ok: true, url: value.trim() };
}

export function classifyPrice(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('...')) {
    return { ok: false, reason: 'placeholder_price' };
  }
  const priceId = value.trim();
  if (priceId === SAMPLE_PRICE_ID) return { ok: false, reason: 'placeholder_price' };
  if (!/^price_[A-Za-z0-9]{8,}$/.test(priceId)) return { ok: false, reason: 'invalid_price' };
  return { ok: true, priceId };
}

export function classifyReturnUrl(value, which) {
  const placeholder = `placeholder_${which}_url`;
  const invalid = `invalid_${which}_url`;
  const notHttps = `${which}_url_not_https`;
  if (typeof value !== 'string' || !value.trim()) return { ok: false, reason: placeholder };
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false, reason: invalid };
  }
  if (url.username || url.password) return { ok: false, reason: invalid };
  if (url.protocol !== 'https:') return { ok: false, reason: notHttps };
  if (isExampleHost(url.hostname)) return { ok: false, reason: placeholder };
  return { ok: true, url: value.trim() };
}

export function resolveSettings(env = {}) {
  const read = (name, sample) => {
    const value = env[name];
    if (typeof value !== 'string' || !value.trim()) return sample;
    return value.trim();
  };
  return {
    secretKey: typeof env.STRIPE_SECRET_KEY === 'string' ? env.STRIPE_SECRET_KEY : '',
    priceId: read('STRIPE_PRICE_ID', SAMPLE_PRICE_ID),
    successUrl: read('STRIPE_SUCCESS_URL', SAMPLE_SUCCESS_URL),
    cancelUrl: read('STRIPE_CANCEL_URL', SAMPLE_CANCEL_URL),
    supabaseUrl: typeof env.SUPABASE_URL === 'string' ? env.SUPABASE_URL : '',
    supabaseAnonKey: typeof env.SUPABASE_ANON_KEY === 'string' ? env.SUPABASE_ANON_KEY : '',
    quantity: CHECKOUT_QUANTITY,
  };
}

export function readinessBlockers(settings, { nodeVersion = process.versions.node } = {}) {
  const blockers = [];
  if (nodeMajor(nodeVersion) < 20) blockers.push('node_below_20');
  const key = classifySecretKey(settings.secretKey);
  if (!key.ok) blockers.push(key.reason);
  const supabaseUrl = classifySupabaseUrl(settings.supabaseUrl);
  if (!supabaseUrl.ok) blockers.push(supabaseUrl.reason);
  const anon = classifyAnonKey(settings.supabaseAnonKey);
  if (!anon.ok) blockers.push(anon.reason);
  const price = classifyPrice(settings.priceId);
  if (!price.ok) blockers.push(price.reason);
  const success = classifyReturnUrl(settings.successUrl, 'success');
  if (!success.ok) blockers.push(success.reason);
  const cancel = classifyReturnUrl(settings.cancelUrl, 'cancel');
  if (!cancel.ok) blockers.push(cancel.reason);
  if (settings.quantity !== CHECKOUT_QUANTITY) blockers.push('quantity_not_server_controlled');
  return blockers;
}

export function paymentMethodCollectionFor(mode) {
  if (mode === 'subscription') return FIELD_INTENTS.payment_method_collection;
  return undefined;
}

export function storedCustomerId(value) {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  if (!id) return null;
  if (!/^cus_[A-Za-z0-9]+$/.test(id)) return null;
  return id;
}

export function associationBlockers({ stripeCustomerId, stripeSubscriptionId } = {}) {
  const blockers = [];
  const subscriptionId =
    typeof stripeSubscriptionId === 'string' ? stripeSubscriptionId.trim() : '';
  if (subscriptionId) blockers.push('subscription_already_recorded');
  if (typeof stripeCustomerId === 'string' && stripeCustomerId.trim()) {
    if (!storedCustomerId(stripeCustomerId)) blockers.push('stored_customer_invalid');
  }
  return blockers;
}

export function buildSessionCreateParams({
  priceId,
  successUrl,
  cancelUrl,
  workspaceId,
  userId,
  stripeCustomerId,
}) {
  if (FIELD_INTENTS.mode !== 'subscription') {
    throw new Error('checkout_mode_must_be_subscription');
  }
  const params = {
    mode: FIELD_INTENTS.mode,
    ui_mode: FIELD_INTENTS.ui_mode,
    billing_address_collection: FIELD_INTENTS.billing_address_collection,
    phone_number_collection: { enabled: FIELD_INTENTS.phone_number_collection.enabled },
    automatic_tax: { enabled: FIELD_INTENTS.automatic_tax.enabled },
    allow_promotion_codes: FIELD_INTENTS.allow_promotion_codes,
    submit_type: FIELD_INTENTS.submit_type,
    integration_identifier: FIELD_INTENTS.integration_identifier,
    origin_context: FIELD_INTENTS.origin_context,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: priceId, quantity: CHECKOUT_QUANTITY }],
    client_reference_id: workspaceId,
    metadata: {
      daymark_workspace_id: workspaceId,
      daymark_owner_user_id: userId,
    },
  };
  const collection = paymentMethodCollectionFor(params.mode);
  if (collection) params.payment_method_collection = collection;
  if (stripeCustomerId) params.customer = stripeCustomerId;
  return params;
}

export function buildIdempotencyKey(workspaceId, now = Date.now()) {
  const bucket = Math.floor(now / 3600000);
  return `daymark_sandbox_checkout_${workspaceId}_${bucket}`;
}

export function acceptableCheckoutUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'checkout.stripe.com';
  } catch {
    return false;
  }
}

export function bearerToken(headers = {}) {
  const source = headers.authorization ?? headers.Authorization ?? '';
  const value = Array.isArray(source) ? source[0] : String(source || '');
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : null;
}

export function parseCheckoutBody(rawBody, isBase64Encoded = false) {
  if (typeof rawBody !== 'string' || rawBody === '') return { error: 'invalid_json' };
  if (rawBody.length > 4096) return { error: 'body_too_large' };
  let text = rawBody;
  if (isBase64Encoded) {
    try {
      text = Buffer.from(rawBody, 'base64').toString('utf8');
    } catch {
      return { error: 'invalid_json' };
    }
    if (text.length > 4096) return { error: 'body_too_large' };
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { error: 'invalid_json' };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'invalid_json' };
  const extra = Object.keys(body).filter((key) => key !== 'workspaceId');
  if (extra.length) return { error: 'untrusted_client_field', fields: extra.sort() };
  if (typeof body.workspaceId !== 'string' || !WORKSPACE_UUID.test(body.workspaceId)) {
    return { error: 'invalid_workspace_id' };
  }
  return { workspaceId: body.workspaceId };
}

export async function handleCheckoutRequest({
  method,
  headers,
  rawBody,
  isBase64Encoded = false,
  env,
  nodeVersion = process.versions.node,
  now = Date.now(),
  deps,
}) {
  if (method !== 'POST') {
    return { statusCode: 405, body: { error: 'method_not_allowed' } };
  }
  const parsed = parseCheckoutBody(rawBody, isBase64Encoded);
  if (parsed.error) {
    const body = { error: parsed.error };
    if (parsed.fields) body.fields = parsed.fields;
    return { statusCode: 400, body };
  }
  if (!bearerToken(headers)) {
    return { statusCode: 401, body: { error: 'unauthorized' } };
  }

  const settings = resolveSettings(env);
  const blockers = readinessBlockers(settings, { nodeVersion });
  if (blockers.length) {
    return { statusCode: 503, body: { error: 'checkout_not_ready', blockers } };
  }

  const loaded = await deps.loadOwnerWorkspace({
    supabaseUrl: classifySupabaseUrl(settings.supabaseUrl).url,
    supabaseAnonKey: settings.supabaseAnonKey.trim(),
    accessToken: bearerToken(headers),
    workspaceId: parsed.workspaceId,
  });
  if (!loaded || loaded.error === 'unauthorized') {
    return { statusCode: 401, body: { error: 'unauthorized' } };
  }
  if (loaded.error === 'forbidden') return { statusCode: 403, body: { error: 'forbidden' } };
  if (loaded.error) return { statusCode: 404, body: { error: 'not_found' } };

  const userId = typeof loaded.userId === 'string' ? loaded.userId : '';
  if (!WORKSPACE_UUID.test(userId)) return { statusCode: 403, body: { error: 'forbidden' } };

  const association = associationBlockers(loaded);
  if (association.length) {
    return { statusCode: 409, body: { error: 'checkout_blocked', blockers: association } };
  }

  const price = classifyPrice(settings.priceId);
  const success = classifyReturnUrl(settings.successUrl, 'success');
  const cancel = classifyReturnUrl(settings.cancelUrl, 'cancel');
  const key = classifySecretKey(settings.secretKey);
  if (!price.ok || !success.ok || !cancel.ok || !key.ok) {
    return { statusCode: 503, body: { error: 'checkout_not_ready' } };
  }
  const params = buildSessionCreateParams({
    priceId: price.priceId,
    successUrl: success.url,
    cancelUrl: cancel.url,
    workspaceId: parsed.workspaceId,
    userId,
    stripeCustomerId: storedCustomerId(loaded.stripeCustomerId),
  });
  const created = await deps.createSession({
    secretKey: key.key,
    params,
    idempotencyKey: buildIdempotencyKey(parsed.workspaceId, now),
  });
  if (!created || created.failed) {
    return {
      statusCode: 502,
      body: { error: 'stripe_request_failed', requestId: created?.requestId || null },
    };
  }
  if (created.livemode === true) {
    return { statusCode: 503, body: { error: 'livemode_refused' } };
  }
  if (!acceptableCheckoutUrl(created.url)) {
    return { statusCode: 502, body: { error: 'unexpected_checkout_url' } };
  }
  return { statusCode: 200, body: { url: created.url } };
}
