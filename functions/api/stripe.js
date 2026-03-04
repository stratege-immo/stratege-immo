// ═══════════════════════════════════════════════════════════
// STRATÈGE — Stripe API (Checkout, Webhook, Billing Portal)
// POST /api/stripe?action=create-checkout|webhook|billing-portal|reservation-status
// ═══════════════════════════════════════════════════════════

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    if (action === 'create-checkout') return await handleCreateCheckout(request, env);
    if (action === 'webhook') return await handleWebhook(request, env);
    if (action === 'billing-portal') return await handleBillingPortal(request, env);
    if (action === 'reservation-status') return await handleReservationStatus(request, env);
    return jsonRes({ success: false, error: 'Action inconnue' }, 400);
  } catch (err) {
    return jsonRes({ success: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

// ── Create Checkout Session ─────────────────────────────
async function handleCreateCheckout(request, env) {
  const body = await request.json();
  const { bienId, bienNom, montant, userId, userEmail } = body;

  if (!bienId || !montant || !userEmail) {
    return jsonRes({ success: false, error: 'Paramètres manquants' }, 400);
  }

  const params = new URLSearchParams({
    'mode': 'payment',
    'success_url': `https://stratege-immo.fr/reservation-confirmee.html?bien=${bienId}&session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url': `https://stratege-immo.fr/bien-detail.html?id=${bienId}&cancelled=1`,
    'customer_email': userEmail,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][product_data][name]': `Réservation — ${bienNom || bienId}`,
    'line_items[0][price_data][product_data][description]': 'Frais de réservation Stratège',
    'line_items[0][price_data][unit_amount]': String(Math.round(montant * 100)),
    'line_items[0][quantity]': '1',
    'metadata[bien_id]': bienId,
    'metadata[user_id]': userId || '',
    'payment_intent_data[metadata][bien_id]': bienId,
    'payment_intent_data[metadata][user_id]': userId || ''
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  const session = await res.json();
  if (!res.ok) {
    return jsonRes({ success: false, error: session.error?.message || 'Erreur Stripe' }, 400);
  }

  return jsonRes({ success: true, url: session.url, sessionId: session.id });
}

// ── Stripe Webhook ─────────────────────────────────────
async function handleWebhook(request, env) {
  const payload = await request.text();
  const sigHeader = request.headers.get('stripe-signature');

  if (!sigHeader) return jsonRes({ error: 'Missing signature' }, 400);

  const valid = await verifyStripeSignature(payload, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return jsonRes({ error: 'Invalid signature' }, 400);

  const event = JSON.parse(payload);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bienId = session.metadata?.bien_id;
    const userId = session.metadata?.user_id;

    if (bienId) {
      const reservation = {
        status: 'paid',
        stripe_session_id: session.id,
        customer_email: session.customer_email,
        amount: session.amount_total / 100,
        currency: session.currency,
        user_id: userId,
        bien_id: bienId,
        paid_at: new Date().toISOString()
      };
      await env.STRATEGE_DB.put(`reservation:${bienId}:${userId || session.customer_email}`, JSON.stringify(reservation));
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    const customerId = invoice.customer;
    if (customerId) {
      await env.STRATEGE_DB.put(`subscription:${customerId}`, JSON.stringify({
        status: 'active',
        invoice_id: invoice.id,
        updated_at: new Date().toISOString()
      }));
    }
  }

  return new Response('OK', { status: 200 });
}

// ── Billing Portal ─────────────────────────────────────
async function handleBillingPortal(request, env) {
  const body = await request.json();
  const { customerId } = body;

  if (!customerId) return jsonRes({ success: false, error: 'Customer ID requis' }, 400);

  const params = new URLSearchParams({
    'customer': customerId,
    'return_url': 'https://stratege-immo.fr/dashboard.html#facturation'
  });

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  const session = await res.json();
  if (!res.ok) {
    return jsonRes({ success: false, error: session.error?.message || 'Erreur Stripe' }, 400);
  }

  return jsonRes({ success: true, url: session.url });
}

// ── Reservation Status ─────────────────────────────────
async function handleReservationStatus(request, env) {
  const body = await request.json();
  const { bienId, userId } = body;

  if (!bienId) return jsonRes({ success: false, error: 'Bien ID requis' }, 400);

  const data = await env.STRATEGE_DB.get(`reservation:${bienId}:${userId || ''}`);
  if (!data) return jsonRes({ success: true, reservation: null });

  return jsonRes({ success: true, reservation: JSON.parse(data) });
}

// ── Stripe Signature Verification (Web Crypto) ─────────
async function verifyStripeSignature(payload, sigHeader, secret) {
  try {
    const parts = {};
    sigHeader.split(',').forEach(function(pair) {
      const [k, v] = pair.split('=');
      parts[k.trim()] = v;
    });

    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) return false;

    // Check timestamp tolerance (5 minutes)
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
    const expected = Array.from(new Uint8Array(sig)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');

    return expected === signature;
  } catch {
    return false;
  }
}

// ── Helpers ─────────────────────────────────────────────
function jsonRes(d, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}
