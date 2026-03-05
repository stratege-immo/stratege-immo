// ═══════════════════════════════════════════════════════════
// STRATEGE — Marketing Campaigns API (JWT-protected)
// POST /api/admin/marketing?action=send
// GET  /api/admin/marketing?action=history
// ═══════════════════════════════════════════════════════════

const JWT_EXPIRY = 24 * 60 * 60;

// ── CORS ────────────────────────────────────────────────
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

// ── JWT helpers (copied from auth.js — Workers can't import across files) ──
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
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
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

// ── Auth guard ──────────────────────────────────────────
async function requireAuth(request, env) {
  const JWT_SECRET = env.JWT_SECRET || 'stratege-admin-jwt-secret-2026';
  const token = getToken(request);
  if (!token) return { error: 'Token manquant', status: 401 };
  const payload = await verifyJWT(token, JWT_SECRET);
  if (!payload) return { error: 'Token invalide ou expire', status: 401 };
  if (payload.role !== 'admin' && payload.role !== 'advisor') {
    return { error: 'Acces refuse', status: 403 };
  }
  return { user: payload };
}

// ── Send email via Mailchannels ─────────────────────────
async function sendMail(env, to, subject, html) {
  const payload = {
    personalizations: [{
      to: [{ email: to }],
      ...(env.DKIM_PRIVATE_KEY ? {
        dkim_domain: 'stratege-immo.fr',
        dkim_selector: 'mailchannels',
        dkim_private_key: env.DKIM_PRIVATE_KEY
      } : {})
    }],
    from: { email: 'contact@stratege-immo.fr', name: 'Stratege' },
    subject,
    content: [{ type: 'text/html', value: html }]
  };
  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.ok || res.status === 202;
}

// ── Email template wrapper ──────────────────────────────
function wrapEmail(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:'Inter',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA;padding:40px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06)">
<tr><td style="background:#1B2E3D;padding:32px 40px;text-align:center">
<span style="font-size:28px;font-weight:700;color:#3ECFB4;font-family:Georgia,serif">Stratege</span>
</td></tr>
<tr><td style="padding:40px">${content}</td></tr>
<tr><td style="background:#f5f9fb;padding:24px 40px;text-align:center;font-size:12px;color:#6B7F99;line-height:1.6">
JESPER SAS - 51 bis rue de Miromesnil, 75008 Paris<br>
<a href="https://stratege-immo.fr/mentions-legales.html" style="color:#3ECFB4">Mentions legales</a> |
<a href="https://stratege-immo.fr/politique-confidentialite.html" style="color:#3ECFB4">Confidentialite</a><br>
<a href="https://stratege-immo.fr" style="color:#6B7F99;font-size:11px">Se desinscrire</a>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

// ── Segment leads from KV ───────────────────────────────
async function getLeadsBySegment(env, segment) {
  const indexRaw = await env.STRATEGE_DB.get('leads:index');
  if (!indexRaw) return [];
  const index = JSON.parse(indexRaw);
  const leads = [];
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  for (const id of index.slice(0, 200)) {
    const raw = await env.STRATEGE_DB.get('lead:' + id);
    if (!raw) continue;
    const lead = JSON.parse(raw);
    if (!lead.email) continue;

    switch (segment) {
      case 'all':
        leads.push(lead);
        break;
      case 'new':
        if (lead.created_at && (now - new Date(lead.created_at).getTime()) < SEVEN_DAYS) {
          leads.push(lead);
        }
        break;
      case 'no_simulation':
        if (lead.created_at && (now - new Date(lead.created_at).getTime()) < THIRTY_DAYS && !lead.simulation_done) {
          leads.push(lead);
        }
        break;
      case 'scpi':
        if (lead.interet && lead.interet.toLowerCase().includes('scpi')) {
          leads.push(lead);
        }
        break;
      default:
        leads.push(lead);
    }
  }
  return leads;
}

// ── POST handler ────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth.error) return jsonResponse({ success: false, error: auth.error }, auth.status);

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'send') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, error: 'JSON invalide' }, 400);
    }

    const { segment, subject, bodyHtml } = body;
    if (!segment || !subject || !bodyHtml) {
      return jsonResponse({ success: false, error: 'segment, subject et bodyHtml requis' }, 400);
    }

    const leads = await getLeadsBySegment(env, segment);
    if (leads.length === 0) {
      return jsonResponse({ success: false, error: 'Aucun lead dans ce segment' }, 404);
    }

    let sent_count = 0;
    let errors = 0;

    // Send emails (max 50 per campaign to stay within CPU limits)
    const batch = leads.slice(0, 50);
    for (const lead of batch) {
      try {
        // Replace variables in the body
        let personalizedBody = bodyHtml
          .replace(/\{\{prenom\}\}/g, lead.prenom || '')
          .replace(/\{\{nom\}\}/g, lead.nom || '')
          .replace(/\{\{email\}\}/g, lead.email || '');

        const htmlContent = wrapEmail(personalizedBody);
        const ok = await sendMail(env, lead.email, subject, htmlContent);
        if (ok) sent_count++;
        else errors++;
      } catch {
        errors++;
      }
    }

    // Log campaign to KV
    const campaignId = 'campaign_' + Date.now();
    const campaign = {
      id: campaignId,
      subject,
      segment,
      sent_count,
      errors,
      total_leads: leads.length,
      sent_by: auth.user.email,
      sent_at: new Date().toISOString(),
    };
    await env.STRATEGE_DB.put('marketing:campaign:' + campaignId, JSON.stringify(campaign), { expirationTtl: 31536000 });

    // Update campaigns index
    const idxRaw = await env.STRATEGE_DB.get('marketing:campaigns:index');
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    idx.unshift(campaignId);
    await env.STRATEGE_DB.put('marketing:campaigns:index', JSON.stringify(idx.slice(0, 100)));

    return jsonResponse({ success: true, sent_count, errors, total_leads: leads.length });
  }

  return jsonResponse({ success: false, error: 'Action inconnue' }, 400);
}

// ── GET handler ─────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth.error) return jsonResponse({ success: false, error: auth.error }, auth.status);

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'history') {
    const idxRaw = await env.STRATEGE_DB.get('marketing:campaigns:index');
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    const campaigns = [];
    for (const id of idx.slice(0, 20)) {
      const raw = await env.STRATEGE_DB.get('marketing:campaign:' + id);
      if (raw) campaigns.push(JSON.parse(raw));
    }
    return jsonResponse({ success: true, campaigns });
  }

  return jsonResponse({ success: false, error: 'Action inconnue' }, 400);
}

// ── OPTIONS (CORS preflight) ────────────────────────────
export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}
