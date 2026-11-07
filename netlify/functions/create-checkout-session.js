// Netlify Function: sandbox-only hosted Checkout for a workspace subscription.
// No apiVersion is passed. stripe-node applies its own packaged default.
// This file never reads VITE_ variables and never returns a live-mode URL.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { handleCheckoutRequest } from './checkoutSession.js';

export function createStripeClient(secretKey) {
  return new Stripe(secretKey);
}

export async function loadOwnerWorkspace({ supabaseUrl, supabaseAnonKey, accessToken, workspaceId }) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user?.id) return { error: 'unauthorized' };

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, owner_id, stripe_customer_id, stripe_subscription_id')
    .eq('id', workspaceId)
    .maybeSingle();

  if (workspaceError || !workspace) return { error: 'not_found' };
  if (workspace.owner_id !== data.user.id) return { error: 'forbidden' };
  return {
    userId: data.user.id,
    stripeCustomerId: workspace.stripe_customer_id,
    stripeSubscriptionId: workspace.stripe_subscription_id,
  };
}

async function createSession({ secretKey, params, idempotencyKey }) {
  try {
    const stripeClient = createStripeClient(secretKey);
    const session = await stripeClient.checkout.sessions.create(params, { idempotencyKey });
    if (session?.livemode === true) {
      if (session.id) {
        try {
          await stripeClient.checkout.sessions.expire(session.id);
        } catch {
          // Still refuse the URL below.
        }
      }
      return { livemode: true, url: null };
    }
    return {
      livemode: false,
      url: typeof session?.url === 'string' ? session.url : null,
    };
  } catch (err) {
    const requestId = err?.requestId;
    return {
      failed: true,
      requestId: typeof requestId === 'string' && /^req_[A-Za-z0-9]+$/.test(requestId) ? requestId : null,
    };
  }
}

const JSON_HEADERS = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
};

export async function handler(event = {}) {
  try {
    const result = await handleCheckoutRequest({
      method: event.httpMethod,
      headers: event.headers || {},
      rawBody: event.body,
      isBase64Encoded: event.isBase64Encoded === true,
      env: process.env,
      deps: {
        loadOwnerWorkspace,
        createSession,
      },
    });
    return {
      statusCode: result.statusCode,
      headers: JSON_HEADERS,
      body: JSON.stringify(result.body),
    };
  } catch {
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: 'checkout_failed' }),
    };
  }
}
