// ═══════════════════════════════════════════════════════════
// STRATEGE — Advisor Portal API (Cloudflare Pages Functions)
// Catch-all route: /api/advisor/*
// Auth: JWT with role "advisor" or "admin"
// ═══════════════════════════════════════════════════════════

const JWT_EXPIRY = 24 * 60 * 60;

// ── CORS ────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ── JWT verification ────────────────────────────────────
async function verifyJWT(token, secret) {
  try {
    const [header, body, signature] = token.split('.');
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(header + '.' + body));
    if (!valid) return null;
    const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ── JWT signing ─────────────────────────────────────────
function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJWT(payload, secret) {
  const enc = new TextEncoder();
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const signature = base64url(String.fromCharCode(...new Uint8Array(sig)));
  return `${data}.${signature}`;
}

// ── Password hashing (PBKDF2) ──────────────────────────
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

async function verifyPassword(password, salt, hash) {
  return (await hashPassword(password, salt)) === hash;
}

// ── Auth middleware ──────────────────────────────────────
async function authenticate(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const secret = env.JWT_SECRET || 'stratege-admin-jwt-secret-2026';
  const payload = await verifyJWT(token, secret);
  if (!payload) return null;
  if (payload.role !== 'advisor' && payload.role !== 'admin') return null;
  return payload;
}

// ── Route parser ────────────────────────────────────────
function parsePath(url) {
  const path = new URL(url).pathname.replace('/api/advisor/', '').replace(/\/$/, '');
  const parts = path.split('/').filter(Boolean);
  return parts;
}

// ── KV list helper (paginated) ──────────────────────────
async function kvListAll(kv, prefix) {
  const results = [];
  let cursor = undefined;
  do {
    const list = await kv.list({ prefix, cursor, limit: 1000 });
    results.push(...list.keys);
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return results;
}

// ═══════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════

// GET /api/advisor/seed — create default advisor account
async function handleSeed(env) {
  const email = 'conseiller@stratege-immo.fr';
  const existing = await env.STRATEGE_DB.get(`admin:${email}`);
  if (existing) {
    return jsonResponse({ success: false, message: 'Le compte conseiller existe deja.' });
  }

  const salt = crypto.randomUUID();
  const hash = await hashPassword('Conseiller2026!', salt);

  const advisor = {
    email,
    role: 'advisor',
    salt,
    hash,
    created_at: new Date().toISOString(),
    last_login: null,
  };

  await env.STRATEGE_DB.put(`admin:${email}`, JSON.stringify(advisor));

  return jsonResponse({
    success: true,
    message: 'Compte conseiller cree avec succes',
    email,
    role: 'advisor',
  });
}

// GET /api/advisor/clients — list all users
async function handleGetClients(env) {
  const keys = await kvListAll(env.STRATEGE_DB, 'user:');
  const clients = [];
  for (const k of keys) {
    const data = await env.STRATEGE_DB.get(k.name);
    if (data) {
      try {
        const user = JSON.parse(data);
        // Count simulations
        const simKeys = await env.STRATEGE_DB.list({ prefix: `sim:${user.email || k.name.replace('user:', '')}:`, limit: 100 });
        clients.push({
          ...user,
          key: k.name,
          email: user.email || k.name.replace('user:', ''),
          simulations_count: simKeys.keys.length,
        });
      } catch {
        clients.push({ key: k.name, raw: data });
      }
    }
  }
  return jsonResponse({ success: true, clients });
}

// GET /api/advisor/clients/{email} — user detail + sims + docs
async function handleGetClientDetail(env, email) {
  const decodedEmail = decodeURIComponent(email);
  const userData = await env.STRATEGE_DB.get(`user:${decodedEmail}`);
  const user = userData ? JSON.parse(userData) : { email: decodedEmail };

  // Simulations
  const simKeys = await kvListAll(env.STRATEGE_DB, `sim:${decodedEmail}:`);
  const simulations = [];
  for (const k of simKeys) {
    const d = await env.STRATEGE_DB.get(k.name);
    if (d) simulations.push({ key: k.name, ...JSON.parse(d) });
  }

  // Documents
  const docKeys = await kvListAll(env.STRATEGE_DB, `doc:${decodedEmail}:`);
  const documents = [];
  for (const k of docKeys) {
    const d = await env.STRATEGE_DB.get(k.name);
    if (d) documents.push({ key: k.name, ...JSON.parse(d) });
  }

  return jsonResponse({ success: true, user, simulations, documents });
}

// POST /api/advisor/clients/{email}/notes — save advisor note
async function handlePostNotes(request, env, email) {
  const decodedEmail = decodeURIComponent(email);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'JSON invalide' }, 400); }

  const existing = await env.STRATEGE_DB.get(`advisor_notes:${decodedEmail}`);
  const notes = existing ? JSON.parse(existing) : [];
  notes.push({
    text: body.text || '',
    author: body.author || 'conseiller',
    created_at: new Date().toISOString(),
  });

  await env.STRATEGE_DB.put(`advisor_notes:${decodedEmail}`, JSON.stringify(notes));
  return jsonResponse({ success: true, notes });
}

// GET /api/advisor/clients/{email}/notes — get notes
async function handleGetNotes(env, email) {
  const decodedEmail = decodeURIComponent(email);
  const data = await env.STRATEGE_DB.get(`advisor_notes:${decodedEmail}`);
  const notes = data ? JSON.parse(data) : [];
  return jsonResponse({ success: true, notes });
}

// GET /api/advisor/rdv — list all RDV
async function handleGetRdv(env) {
  const keys = await kvListAll(env.STRATEGE_DB, 'rdv:');
  const rdvs = [];
  for (const k of keys) {
    const d = await env.STRATEGE_DB.get(k.name);
    if (d) {
      try { rdvs.push({ key: k.name, ...JSON.parse(d) }); }
      catch { rdvs.push({ key: k.name, raw: d }); }
    }
  }
  // Sort by date descending
  rdvs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return jsonResponse({ success: true, rdvs });
}

// POST /api/advisor/email — send email via Mailchannels
async function handleSendEmail(request) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'JSON invalide' }, 400); }

  const { to, subject, html } = body;
  if (!to || !subject || !html) {
    return jsonResponse({ success: false, error: 'to, subject et html requis' }, 400);
  }

  try {
    const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'conseiller@stratege-immo.fr', name: 'Stratege Conseiller' },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });
    const ok = resp.status >= 200 && resp.status < 300;
    return jsonResponse({ success: ok, status: resp.status });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

// GET /api/advisor/messages/{email} — get chat messages
async function handleGetMessages(env, email) {
  const decodedEmail = decodeURIComponent(email);
  const data = await env.STRATEGE_DB.get(`chat:${decodedEmail}`);
  const messages = data ? JSON.parse(data) : [];
  return jsonResponse({ success: true, messages });
}

// POST /api/advisor/messages/{email} — send a message
async function handlePostMessage(request, env, email) {
  const decodedEmail = decodeURIComponent(email);
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'JSON invalide' }, 400); }

  const data = await env.STRATEGE_DB.get(`chat:${decodedEmail}`);
  const messages = data ? JSON.parse(data) : [];

  messages.push({
    from: body.from || 'advisor',
    text: body.text || '',
    timestamp: new Date().toISOString(),
    read: false,
  });

  await env.STRATEGE_DB.put(`chat:${decodedEmail}`, JSON.stringify(messages));
  return jsonResponse({ success: true, messages });
}

// ═══════════════════════════════════════════════════════════
// MAIN ROUTER
// ═══════════════════════════════════════════════════════════

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  const parts = parsePath(request.url);
  const secret = env.JWT_SECRET || 'stratege-admin-jwt-secret-2026';

  // ── Public endpoint: seed ─────────────────────────────
  if (parts[0] === 'seed' && method === 'GET') {
    return handleSeed(env);
  }

  // ── Public endpoint: login ────────────────────────────
  if (parts[0] === 'login' && method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'JSON invalide' }, 400); }

    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    if (!email || !password) return jsonResponse({ success: false, error: 'Email et mot de passe requis' }, 400);

    const adminData = await env.STRATEGE_DB.get(`admin:${email}`);
    if (!adminData) return jsonResponse({ success: false, error: 'Identifiants incorrects' }, 401);

    const account = JSON.parse(adminData);
    if (account.role !== 'advisor' && account.role !== 'admin') {
      return jsonResponse({ success: false, error: 'Acces non autorise' }, 403);
    }

    const valid = await verifyPassword(password, account.salt, account.hash);
    if (!valid) return jsonResponse({ success: false, error: 'Identifiants incorrects' }, 401);

    account.last_login = new Date().toISOString();
    await env.STRATEGE_DB.put(`admin:${email}`, JSON.stringify(account));

    const token = await signJWT(
      { sub: email, email, role: account.role, exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY },
      secret
    );

    return jsonResponse({ success: true, token, user: { email, role: account.role } });
  }

  // ── All other routes require auth ─────────────────────
  const user = await authenticate(request, env);
  if (!user) {
    return jsonResponse({ success: false, error: 'Non authentifie' }, 401);
  }

  // ── Route: clients ────────────────────────────────────
  if (parts[0] === 'clients') {
    if (parts.length === 1 && method === 'GET') {
      return handleGetClients(env);
    }
    if (parts.length === 2 && method === 'GET') {
      return handleGetClientDetail(env, parts[1]);
    }
    if (parts.length === 3 && parts[2] === 'notes') {
      if (method === 'GET') return handleGetNotes(env, parts[1]);
      if (method === 'POST') return handlePostNotes(request, env, parts[1]);
    }
  }

  // ── Route: rdv ────────────────────────────────────────
  if (parts[0] === 'rdv' && method === 'GET') {
    return handleGetRdv(env);
  }

  // ── Route: email ──────────────────────────────────────
  if (parts[0] === 'email' && method === 'POST') {
    return handleSendEmail(request);
  }

  // ── Route: messages ───────────────────────────────────
  if (parts[0] === 'messages' && parts.length === 2) {
    if (method === 'GET') return handleGetMessages(env, parts[1]);
    if (method === 'POST') return handlePostMessage(request, env, parts[1]);
  }

  return jsonResponse({ success: false, error: 'Route introuvable' }, 404);
}
