// ═══════════════════════════════════════════════════════════
// STRATÈGE — Newsletter API
// POST /api/newsletter — Subscribe to newsletter
// ═══════════════════════════════════════════════════════════

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ success: false, error: 'Email invalide' }, 400);
    }

    const key = `newsletter:${email}`;
    const existing = await env.STRATEGE_DB.get(key);
    if (existing) {
      return jsonResponse({ success: true, message: 'Vous êtes déjà inscrit à la newsletter.' });
    }

    await env.STRATEGE_DB.put(key, JSON.stringify({
      email,
      subscribed_at: new Date().toISOString(),
      source: body.source || 'footer'
    }));

    return jsonResponse({ success: true, message: 'Inscription à la newsletter confirmée !' });
  } catch (err) {
    return jsonResponse({ success: false, error: 'Erreur serveur' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
