// ═══════════════════════════════════════════════════════════
// STRATEGE — Admin Seed Endpoint
// GET /api/admin/seed → creates initial admin account
// ═══════════════════════════════════════════════════════════

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

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

async function adminExists(env) {
  const list = await env.STRATEGE_DB.list({ prefix: 'admin:' });
  return list.keys.length > 0;
}

export async function onRequestGet({ env }) {
  try {
    const exists = await adminExists(env);
    if (exists) {
      return jsonResponse({
        success: false,
        message: 'Un compte admin existe deja. Seeding non necessaire.',
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
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
