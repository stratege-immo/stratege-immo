// ═══════════════════════════════════════════════════════════
// STRATEGE — Admin Auth API (JWT + Web Crypto)
// POST /api/admin/auth?action=login|verify|seed
// ═══════════════════════════════════════════════════════════

const JWT_EXPIRY = 24 * 60 * 60; // 24 hours
const RATE_LIMIT_MAX = 5; // max login attempts per window
const RATE_LIMIT_TTL = 120; // 2 min window

// ── CORS headers ─────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ── Rate limiting (IP-based via KV) ─────────────────────
async function checkRateLimit(request, env, action) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `ratelimit:admin:${action}:${ip}`;
  const attempts = await env.STRATEGE_DB.get(key);
  const count = attempts ? parseInt(attempts) : 0;
  if (count >= RATE_LIMIT_MAX) {
    return jsonResponse(
      { success: false, error: 'Trop de tentatives. Reessayez dans 2 minutes.' },
      429
    );
  }
  await env.STRATEGE_DB.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_TTL });
  return null;
}

// ── Web Crypto password hashing (PBKDF2) ───────────────
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

async function verifyPassword(password, salt, hash) {
  const computed = await hashPassword(password, salt);
  return computed === hash;
}

// ── JWT (HMAC-SHA256 via Web Crypto) ────────────────────
function base64url(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function signJWT(payload, secret) {
  const enc = new TextEncoder();
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const signature = base64url(String.fromCharCode(...new Uint8Array(sig)));
  return `${data}.${signature}`;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = Uint8Array.from(base64urlDecode(signature), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      enc.encode(`${header}.${body}`)
    );
    if (!valid) return null;
    const payload = JSON.parse(base64urlDecode(body));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Extract JWT from Authorization header ───────────────
function getToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// ── Sanitize input ──────────────────────────────────────
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
    .slice(0, 200);
}

// ── Check if any admin account exists ───────────────────
async function adminExists(env) {
  const list = await env.STRATEGE_DB.list({ prefix: 'admin:' });
  return list.keys.length > 0;
}

// ── Main POST handler ───────────────────────────────────
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const JWT_SECRET = env.JWT_SECRET || 'stratege-admin-jwt-secret-2026';

  try {
    if (action === 'login') return await handleLogin(request, env, JWT_SECRET);
    if (action === 'verify') return await handleVerify(request, env, JWT_SECRET);
    if (action === 'seed') return await handleSeed(request, env, JWT_SECRET);
    return jsonResponse({ success: false, error: 'Action inconnue' }, 400);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

// ── GET handler (for verify + seed) ─────────────────────
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const JWT_SECRET = env.JWT_SECRET || 'stratege-admin-jwt-secret-2026';

  try {
    if (action === 'verify') return await handleVerify(request, env, JWT_SECRET);
    if (action === 'seed') return await handleSeed(request, env, JWT_SECRET);
    return jsonResponse({ success: false, error: 'Action inconnue' }, 400);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

// ── OPTIONS (CORS preflight) ────────────────────────────
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

// ── LOGIN ───────────────────────────────────────────────
async function handleLogin(request, env, secret) {
  // Rate limiting
  const rateLimited = await checkRateLimit(request, env, 'login');
  if (rateLimited) return rateLimited;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Corps JSON invalide' }, 400);
  }

  const email = sanitize(body.email || '').toLowerCase();
  const password = body.password || '';

  if (!email || !password) {
    return jsonResponse({ success: false, error: 'Email et mot de passe requis' }, 400);
  }

  // Look up admin account
  const adminKey = `admin:${email}`;
  const adminData = await env.STRATEGE_DB.get(adminKey);
  if (!adminData) {
    return jsonResponse({ success: false, error: 'Identifiants incorrects' }, 401);
  }

  const admin = JSON.parse(adminData);
  const valid = await verifyPassword(password, admin.salt, admin.hash);
  if (!valid) {
    return jsonResponse({ success: false, error: 'Identifiants incorrects' }, 401);
  }

  // Update last_login
  admin.last_login = new Date().toISOString();
  await env.STRATEGE_DB.put(adminKey, JSON.stringify(admin));

  // Sign JWT
  const token = await signJWT(
    {
      sub: admin.email,
      email: admin.email,
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY,
    },
    secret
  );

  return jsonResponse({
    success: true,
    token,
    user: { email: admin.email, role: admin.role },
  });
}

// ── VERIFY ──────────────────────────────────────────────
async function handleVerify(request, env, secret) {
  const token = getToken(request);
  if (!token) {
    return jsonResponse({ success: false, valid: false, error: 'Token manquant' }, 401);
  }

  const payload = await verifyJWT(token, secret);
  if (!payload) {
    return jsonResponse({ success: false, valid: false, error: 'Token invalide ou expire' }, 401);
  }

  // Verify the admin account still exists in KV
  const adminKey = `admin:${payload.email}`;
  const adminData = await env.STRATEGE_DB.get(adminKey);
  if (!adminData) {
    return jsonResponse({ success: false, valid: false, error: 'Compte supprime' }, 401);
  }

  return jsonResponse({
    success: true,
    valid: true,
    email: payload.email,
    role: payload.role,
  });
}

// ── SEED (create initial admin if none exists) ──────────
async function handleSeed(request, env, secret) {
  const exists = await adminExists(env);
  if (exists) {
    return jsonResponse({
      success: false,
      error: 'Un compte admin existe deja. Seeding interdit.',
    });
  }

  const email = 'rajaa@stratege-immo.fr';
  const password = 'MotDePasseAdmin2026!';
  const salt = crypto.randomUUID();
  const hash = await hashPassword(password, salt);

  const admin = {
    email,
    role: 'admin',
    salt,
    hash,
    created_at: new Date().toISOString(),
    last_login: null,
  };

  await env.STRATEGE_DB.put(`admin:${email}`, JSON.stringify(admin));

  return jsonResponse({
    success: true,
    message: 'Compte admin cree avec succes',
    email,
    role: 'admin',
  });
}
