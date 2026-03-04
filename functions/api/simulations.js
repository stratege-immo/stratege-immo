// ═══════════════════════════════════════════════════════════
// STRATÈGE — User Simulations API
// GET /api/simulations — list user's saved simulations
// POST /api/simulations — save a simulation
// DELETE /api/simulations?id=xxx — delete a simulation
// ═══════════════════════════════════════════════════════════

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    let sigStr = signature.replace(/-/g, '+').replace(/_/g, '/');
    while (sigStr.length % 4) sigStr += '=';
    const sigBytes = Uint8Array.from(atob(sigStr), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${header}.${body}`));
    if (!valid) return null;
    let bodyStr = body.replace(/-/g, '+').replace(/_/g, '/');
    while (bodyStr.length % 4) bodyStr += '=';
    const payload = JSON.parse(atob(bodyStr));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getToken(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

async function authenticate(request, env) {
  const token = getToken(request);
  if (!token) return null;
  const secret = env.JWT_SECRET || 'stratege-default-secret-change-me';
  return await verifyJWT(token, secret);
}

// ── GET: list simulations ───────────────────────────────
export async function onRequestGet({ request, env }) {
  const payload = await authenticate(request, env);
  if (!payload) return jsonResponse({ success: false, error: 'Non authentifié' }, 401);

  const prefix = `sim:${payload.sub}:`;
  const list = await env.STRATEGE_DB.list({ prefix });
  const simulations = [];

  for (const key of list.keys) {
    const data = await env.STRATEGE_DB.get(key.name);
    if (data) {
      try {
        simulations.push(JSON.parse(data));
      } catch { /* skip corrupted */ }
    }
  }

  simulations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return jsonResponse({ success: true, total: simulations.length, simulations });
}

// ── POST: save simulation ───────────────────────────────
export async function onRequestPost({ request, env }) {
  const payload = await authenticate(request, env);
  if (!payload) return jsonResponse({ success: false, error: 'Non authentifié' }, 401);

  const data = await request.json();
  const simId = `sim_${Date.now()}`;
  const simulation = {
    id: simId,
    userId: payload.sub,
    email: payload.email,
    ...data,
    created_at: new Date().toISOString()
  };

  const key = `sim:${payload.sub}:${Date.now()}`;
  await env.STRATEGE_DB.put(key, JSON.stringify(simulation), {
    expirationTtl: 60 * 60 * 24 * 365 * 3 // 3 years
  });

  return jsonResponse({ success: true, simulation_id: simId, message: 'Simulation sauvegardée' });
}

// ── DELETE: remove simulation ───────────────────────────
export async function onRequestDelete({ request, env }) {
  const payload = await authenticate(request, env);
  if (!payload) return jsonResponse({ success: false, error: 'Non authentifié' }, 401);

  const url = new URL(request.url);
  const simId = url.searchParams.get('id');
  if (!simId) return jsonResponse({ success: false, error: 'ID simulation requis' }, 400);

  // Find and delete the matching key
  const prefix = `sim:${payload.sub}:`;
  const list = await env.STRATEGE_DB.list({ prefix });
  let deleted = false;

  for (const key of list.keys) {
    const data = await env.STRATEGE_DB.get(key.name);
    if (data) {
      try {
        const sim = JSON.parse(data);
        if (sim.id === simId) {
          await env.STRATEGE_DB.delete(key.name);
          deleted = true;
          break;
        }
      } catch { /* skip */ }
    }
  }

  if (deleted) {
    return jsonResponse({ success: true, message: 'Simulation supprimée' });
  }
  return jsonResponse({ success: false, error: 'Simulation introuvable' }, 404);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
