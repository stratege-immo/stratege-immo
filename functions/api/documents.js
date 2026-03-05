// ═══════════════════════════════════════════════════════════
// STRATEGE — Documents API
// POST /api/documents  → upload document
// GET  /api/documents  → list documents for authenticated user
// ═══════════════════════════════════════════════════════════

// ── JWT helpers (same as auth.js) ────────────────────────
function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(base64urlDecode(signature), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(base64urlDecode(body));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

// ── POST: Upload document ────────────────────────────────
export async function onRequestPost({ request, env }) {
  const JWT_SECRET = env.JWT_SECRET || 'stratege-default-secret-change-me';

  try {
    const token = getToken(request);
    if (!token) return jsonResponse({ success: false, error: 'Non authentifie' }, 401);

    const payload = await verifyJWT(token, JWT_SECRET);
    if (!payload) return jsonResponse({ success: false, error: 'Token invalide ou expire' }, 401);

    const body = await request.json();
    const { name, category, data, type } = body;

    if (!name || !category || !data) {
      return jsonResponse({ success: false, error: 'Champs requis: name, category, data' }, 400);
    }

    const validCategories = [
      'Piece d\'identite', 'Justificatif domicile', 'Avis d\'imposition',
      'Bulletins de salaire', 'RIB', 'Autre'
    ];
    if (!validCategories.includes(category)) {
      return jsonResponse({ success: false, error: 'Categorie invalide' }, 400);
    }

    // Check base64 size (~10MB limit -> ~13.3MB in base64)
    if (data.length > 14 * 1024 * 1024) {
      return jsonResponse({ success: false, error: 'Fichier trop volumineux (max 10 Mo)' }, 400);
    }

    const userId = payload.sub;
    const timestamp = Date.now();
    const docId = `doc:${userId}:${timestamp}`;

    const docMeta = {
      id: docId,
      user_id: userId,
      name: name.slice(0, 200),
      category,
      type: type || 'application/pdf',
      status: 'en_attente',
      uploaded_at: new Date().toISOString(),
      size: Math.round(data.length * 0.75) // approximate original size from base64
    };

    // Store document data
    await env.STRATEGE_DB.put(docId, JSON.stringify({ ...docMeta, data }), {
      expirationTtl: 365 * 24 * 60 * 60
    });

    // Update user's document index
    const indexKey = `doc_index:${userId}`;
    const existingIndex = await env.STRATEGE_DB.get(indexKey);
    let docs = [];
    if (existingIndex) {
      try { docs = JSON.parse(existingIndex); } catch { docs = []; }
    }
    docs.push(docMeta);
    await env.STRATEGE_DB.put(indexKey, JSON.stringify(docs), {
      expirationTtl: 365 * 24 * 60 * 60
    });

    return jsonResponse({
      success: true,
      message: 'Document telecharge avec succes',
      document: docMeta
    });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

// ── GET: List documents ──────────────────────────────────
export async function onRequestGet({ request, env }) {
  const JWT_SECRET = env.JWT_SECRET || 'stratege-default-secret-change-me';

  try {
    const token = getToken(request);
    if (!token) return jsonResponse({ success: false, error: 'Non authentifie' }, 401);

    const payload = await verifyJWT(token, JWT_SECRET);
    if (!payload) return jsonResponse({ success: false, error: 'Token invalide ou expire' }, 401);

    const userId = payload.sub;
    const indexKey = `doc_index:${userId}`;
    const existingIndex = await env.STRATEGE_DB.get(indexKey);
    let docs = [];
    if (existingIndex) {
      try { docs = JSON.parse(existingIndex); } catch { docs = []; }
    }

    // Return metadata only (no base64 data)
    return jsonResponse({
      success: true,
      documents: docs.map(function(d) {
        return {
          id: d.id,
          name: d.name,
          category: d.category,
          type: d.type,
          status: d.status,
          uploaded_at: d.uploaded_at,
          size: d.size
        };
      })
    });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

// ── DELETE: Remove document ──────────────────────────────
export async function onRequestDelete({ request, env }) {
  const JWT_SECRET = env.JWT_SECRET || 'stratege-default-secret-change-me';

  try {
    const token = getToken(request);
    if (!token) return jsonResponse({ success: false, error: 'Non authentifie' }, 401);

    const payload = await verifyJWT(token, JWT_SECRET);
    if (!payload) return jsonResponse({ success: false, error: 'Token invalide ou expire' }, 401);

    const url = new URL(request.url);
    const docId = url.searchParams.get('id');
    if (!docId) return jsonResponse({ success: false, error: 'ID document requis' }, 400);

    const userId = payload.sub;

    // Verify ownership
    if (!docId.startsWith(`doc:${userId}:`)) {
      return jsonResponse({ success: false, error: 'Acces non autorise' }, 403);
    }

    // Delete document data
    await env.STRATEGE_DB.delete(docId);

    // Update index
    const indexKey = `doc_index:${userId}`;
    const existingIndex = await env.STRATEGE_DB.get(indexKey);
    let docs = [];
    if (existingIndex) {
      try { docs = JSON.parse(existingIndex); } catch { docs = []; }
    }
    docs = docs.filter(function(d) { return d.id !== docId; });
    await env.STRATEGE_DB.put(indexKey, JSON.stringify(docs), {
      expirationTtl: 365 * 24 * 60 * 60
    });

    return jsonResponse({ success: true, message: 'Document supprime' });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
