// ═══════════════════════════════════════════════════════════
// STRATÈGE — Auth API (JWT + Web Crypto)
// POST /api/auth?action=register|login|me|reset-request|reset
// ═══════════════════════════════════════════════════════════

const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const RESET_EXPIRY = 3600; // 1 hour
const RATE_LIMIT_MAX = 10; // max attempts per window
const RATE_LIMIT_TTL = 60; // window in seconds

// ── XSS sanitization ────────────────────────────────────
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
    .slice(0, 100);
}

// ── Rate limiting (IP-based via KV) ─────────────────────
async function checkRateLimit(request, env, action) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `ratelimit:${action}:${ip}`;
  const attempts = await env.STRATEGE_DB.get(key);
  const count = attempts ? parseInt(attempts) : 0;
  if (count >= RATE_LIMIT_MAX) {
    return jsonResponse({ success: false, error: 'Trop de tentatives. Réessayez dans 60 secondes.' }, 429);
  }
  await env.STRATEGE_DB.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_TTL });
  return null;
}

// ── Web Crypto password hashing (PBKDF2) ───────────────
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

async function verifyPassword(password, salt, hash) {
  const computed = await hashPassword(password, salt);
  return computed === hash;
}

// ── JWT (HMAC-SHA256 via Web Crypto) ────────────────────
function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
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

// ── Extract JWT from Authorization header ───────────────
function getToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// ── Main handler ────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const JWT_SECRET = env.JWT_SECRET || 'stratege-default-secret-change-me';

  try {
    if (action === 'register') {
      return await handleRegister(request, env, JWT_SECRET);
    } else if (action === 'login') {
      return await handleLogin(request, env, JWT_SECRET);
    } else if (action === 'me') {
      return await handleMe(request, env, JWT_SECRET);
    } else if (action === 'reset-request') {
      return await handleResetRequest(request, env, JWT_SECRET);
    } else if (action === 'reset') {
      return await handleReset(request, env, JWT_SECRET);
    }
    return jsonResponse({ success: false, error: 'Action inconnue' }, 400);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

export async function onRequestGet({ request, env }) {
  const JWT_SECRET = env.JWT_SECRET || 'stratege-default-secret-change-me';
  return await handleMe(request, env, JWT_SECRET);
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

// ── Register ────────────────────────────────────────────
async function handleRegister(request, env, secret) {
  // Rate limiting
  const rateLimited = await checkRateLimit(request, env, 'register');
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const { password } = body;

  // RGPD consent required
  if (!body.rgpd || body.rgpd !== true) {
    return jsonResponse({ success: false, error: 'Consentement RGPD requis' }, 400);
  }

  // Sanitize text inputs
  const prenom = sanitize(body.prenom);
  const nom = sanitize(body.nom);
  const email = sanitize(body.email).toLowerCase();

  if (!email || !password || !prenom || !nom) {
    return jsonResponse({ success: false, error: 'Champs obligatoires manquants' }, 400);
  }
  if (password.length < 8) {
    return jsonResponse({ success: false, error: 'Le mot de passe doit contenir au moins 8 caractères' }, 400);
  }

  const userKey = `user:${email}`;
  const existing = await env.STRATEGE_DB.get(userKey);
  if (existing) {
    return jsonResponse({ success: false, error: 'Un compte existe déjà avec cet email' }, 409);
  }

  const salt = crypto.randomUUID();
  const hash = await hashPassword(password, salt);
  const userId = crypto.randomUUID();

  const user = {
    id: userId,
    email,
    prenom,
    nom,
    salt,
    hash,
    plan: 'express',
    created_at: new Date().toISOString()
  };

  await env.STRATEGE_DB.put(userKey, JSON.stringify(user));

  const token = await signJWT(
    { sub: userId, email: user.email, exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY },
    secret
  );

  // Send welcome email (fire and forget)
  try {
    await sendEmail(env, {
      to: user.email,
      subject: 'Bienvenue sur Stratège !',
      html: welcomeEmailHTML(user.prenom)
    });
  } catch (e) { /* email failure should not block registration */ }

  return jsonResponse({
    success: true,
    token,
    user: { id: userId, email: user.email, prenom: user.prenom, nom: user.nom, plan: user.plan }
  });
}

// ── Login ───────────────────────────────────────────────
async function handleLogin(request, env, secret) {
  // Rate limiting
  const rateLimited = await checkRateLimit(request, env, 'login');
  if (rateLimited) return rateLimited;

  const { email, password } = await request.json();
  if (!email || !password) {
    return jsonResponse({ success: false, error: 'Email et mot de passe requis' }, 400);
  }

  const userKey = `user:${email.toLowerCase()}`;
  const userData = await env.STRATEGE_DB.get(userKey);
  if (!userData) {
    return jsonResponse({ success: false, error: 'Email ou mot de passe incorrect' }, 401);
  }

  const user = JSON.parse(userData);
  const valid = await verifyPassword(password, user.salt, user.hash);
  if (!valid) {
    return jsonResponse({ success: false, error: 'Email ou mot de passe incorrect' }, 401);
  }

  const token = await signJWT(
    { sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY },
    secret
  );

  return jsonResponse({
    success: true,
    token,
    user: { id: user.id, email: user.email, prenom: user.prenom, nom: user.nom, plan: user.plan }
  });
}

// ── Me (get profile) ────────────────────────────────────
async function handleMe(request, env, secret) {
  const token = getToken(request);
  if (!token) return jsonResponse({ success: false, error: 'Non authentifié' }, 401);

  const payload = await verifyJWT(token, secret);
  if (!payload) return jsonResponse({ success: false, error: 'Token invalide ou expiré' }, 401);

  const userKey = `user:${payload.email}`;
  const userData = await env.STRATEGE_DB.get(userKey);
  if (!userData) return jsonResponse({ success: false, error: 'Utilisateur introuvable' }, 404);

  const user = JSON.parse(userData);
  return jsonResponse({
    success: true,
    user: { id: user.id, email: user.email, prenom: user.prenom, nom: user.nom, plan: user.plan }
  });
}

// ── Password reset request ──────────────────────────────
async function handleResetRequest(request, env, secret) {
  const { email } = await request.json();
  if (!email) return jsonResponse({ success: false, error: 'Email requis' }, 400);

  const userKey = `user:${email.toLowerCase()}`;
  const userData = await env.STRATEGE_DB.get(userKey);

  // Always return success (don't leak whether email exists)
  if (userData) {
    const user = JSON.parse(userData);
    const resetToken = await signJWT(
      { sub: user.id, email: user.email, type: 'reset', exp: Math.floor(Date.now() / 1000) + RESET_EXPIRY },
      secret
    );
    const resetLink = `https://stratege-immo.fr/login.html?reset=${resetToken}`;
    try {
      await sendEmail(env, {
        to: user.email,
        subject: 'Réinitialisation de votre mot de passe — Stratège',
        html: resetEmailHTML(user.prenom, resetLink)
      });
    } catch (e) { /* silent */ }
  }

  return jsonResponse({ success: true, message: 'Si un compte existe, un email a été envoyé.' });
}

// ── Password reset ──────────────────────────────────────
async function handleReset(request, env, secret) {
  const { token, password } = await request.json();
  if (!token || !password) return jsonResponse({ success: false, error: 'Paramètres manquants' }, 400);
  if (password.length < 8) return jsonResponse({ success: false, error: 'Mot de passe trop court (min 8)' }, 400);

  const payload = await verifyJWT(token, secret);
  if (!payload || payload.type !== 'reset') {
    return jsonResponse({ success: false, error: 'Lien expiré ou invalide' }, 401);
  }

  const userKey = `user:${payload.email}`;
  const userData = await env.STRATEGE_DB.get(userKey);
  if (!userData) return jsonResponse({ success: false, error: 'Utilisateur introuvable' }, 404);

  const user = JSON.parse(userData);
  const salt = crypto.randomUUID();
  user.salt = salt;
  user.hash = await hashPassword(password, salt);
  await env.STRATEGE_DB.put(userKey, JSON.stringify(user));

  return jsonResponse({ success: true, message: 'Mot de passe modifié avec succès' });
}

// ── Email via Mailchannels ──────────────────────────────
async function sendEmail(env, { to, subject, html }) {
  const payload = {
    personalizations: [{
      to: [{ email: to }],
      ...(env.DKIM_PRIVATE_KEY ? {
        dkim_domain: 'stratege-immo.fr',
        dkim_selector: 'mailchannels',
        dkim_private_key: env.DKIM_PRIVATE_KEY
      } : {})
    }],
    from: { email: 'contact@stratege-immo.fr', name: 'Stratège' },
    subject,
    content: [{ type: 'text/html', value: html }]
  };
  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

// ── Email templates ─────────────────────────────────────
function emailWrapper(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#EBF8F5;font-family:'DM Sans',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EBF8F5;padding:40px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06)">
<tr><td style="background:#1E3040;padding:32px 40px;text-align:center">
<span style="font-size:28px;font-weight:700;color:#3DD9BE;font-family:Georgia,serif">Stratège</span>
</td></tr>
<tr><td style="padding:40px">${content}</td></tr>
<tr><td style="background:#f5f9fb;padding:24px 40px;text-align:center;font-size:12px;color:#7FA3B9;line-height:1.6">
JESPER SAS — 51 bis rue de Miromesnil, 75008 Paris<br>
CPI 7501 2025 000 000 012 — Transaction<br>
<a href="https://stratege-immo.fr/mentions-legales.html" style="color:#3DD9BE">Mentions légales</a> |
<a href="https://stratege-immo.fr/politique-confidentialite.html" style="color:#3DD9BE">Confidentialité</a>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function welcomeEmailHTML(prenom) {
  return emailWrapper(`
<h2 style="color:#1E3040;font-family:Georgia,serif;margin:0 0 16px">Bienvenue ${prenom} !</h2>
<p style="color:#3D566A;font-size:16px;line-height:1.6;margin:0 0 24px">
Votre compte Stratège est maintenant actif. Vous pouvez simuler votre capacité d'investissement,
sauvegarder vos projets et être accompagné par un conseiller dédié.
</p>
<div style="text-align:center;margin:32px 0">
<a href="https://stratege-immo.fr/index.html#simulation" style="background:#3DD9BE;color:#1E3040;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
Lancer ma première simulation
</a>
</div>
<p style="color:#7FA3B9;font-size:14px;margin:0">
Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.
</p>`);
}

function resetEmailHTML(prenom, resetLink) {
  return emailWrapper(`
<h2 style="color:#1E3040;font-family:Georgia,serif;margin:0 0 16px">Réinitialisation du mot de passe</h2>
<p style="color:#3D566A;font-size:16px;line-height:1.6;margin:0 0 24px">
Bonjour ${prenom}, vous avez demandé la réinitialisation de votre mot de passe.
Cliquez sur le bouton ci-dessous (lien valable 1 heure).
</p>
<div style="text-align:center;margin:32px 0">
<a href="${resetLink}" style="background:#3DD9BE;color:#1E3040;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
Réinitialiser mon mot de passe
</a>
</div>
<p style="color:#7FA3B9;font-size:14px;margin:0">
Si vous n'avez pas fait cette demande, ignorez cet email.
</p>`);
}

// ── Helpers ─────────────────────────────────────────────
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}
