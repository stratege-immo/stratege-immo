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
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

function generateReference() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SCPI-2026-${code}`;
}

async function sendEmail(to, toName, subject, htmlBody) {
  const payload = {
    personalizations: [
      {
        to: [{ email: to, name: toName || to }],
      },
    ],
    from: { email: 'noreply@stratege-immo.fr', name: 'Stratege' },
    subject,
    content: [{ type: 'text/html', value: htmlBody }],
  };

  try {
    await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('Email send error:', e);
  }
}

async function verifyJWT(token, secret) {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const signature = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return payload;
  } catch (e) {
    return null;
  }
}

export async function onRequestPost({ request, env, params }) {
  const path = (params.path || []).join('/');

  if (path === 'subscribe') {
    try {
      const body = await request.json();

      const prenom = body.souscripteur?.prenom || '';
      const nom = body.souscripteur?.nom || '';
      const email = body.souscripteur?.email || '';
      const tel = body.souscripteur?.tel || '';
      const montant = body.montant || 0;
      const mode = body.mode || 'comptant';
      const scpiList = body.scpi || [];

      if (!prenom || !nom || !email || scpiList.length === 0 || montant <= 0) {
        return jsonResponse({ success: false, message: 'Champs obligatoires manquants.' }, 400);
      }

      const reference = generateReference();
      const timestamp = Date.now();
      const scpiNames = Array.isArray(scpiList) ? scpiList.join(', ') : String(scpiList);
      const modeLabel = mode === 'credit' ? 'A credit' : 'Au comptant';

      const souscription = {
        reference,
        ...body,
        status: 'En attente',
        created_at: new Date(timestamp).toISOString(),
      };

      // Store in KV
      await env.STRATEGE_DB.put(
        `souscriptions:${timestamp}`,
        JSON.stringify(souscription)
      );

      // Email to advisor
      const advisorHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#3ECFB4;">Nouvelle souscription SCPI</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Reference</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${reference}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Client</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${prenom} ${nom}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${email}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Telephone</td><td style="padding:8px;border-bottom:1px solid #eee;">${tel}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">SCPI</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${scpiNames}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Montant</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${Number(montant).toLocaleString('fr-FR')} EUR</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Mode</td><td style="padding:8px;border-bottom:1px solid #eee;">${modeLabel}</td></tr>
          </table>
          <p style="margin-top:20px;color:#666;font-size:13px;">Connectez-vous au <a href="https://stratege-immo.fr/admin.html">dashboard admin</a> pour gerer cette souscription.</p>
        </div>`;

      await sendEmail(
        'contact@stratege-immo.fr',
        'Stratege Conseil',
        `Nouvelle souscription SCPI — ${prenom} ${nom}`,
        advisorHtml
      );

      // Confirmation email to client
      const clientHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="text-align:center;padding:30px 0;">
            <h1 style="color:#3ECFB4;margin-bottom:8px;">Stratege</h1>
            <p style="color:#666;">Votre souscription SCPI est enregistree</p>
          </div>
          <div style="background:#f8f9fa;border-radius:12px;padding:24px;margin:20px 0;">
            <h3 style="margin-top:0;">Recapitulatif</h3>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#666;">Reference</td><td style="padding:6px 0;font-weight:600;font-family:monospace;">${reference}</td></tr>
              <tr><td style="padding:6px 0;color:#666;">SCPI</td><td style="padding:6px 0;font-weight:600;">${scpiNames}</td></tr>
              <tr><td style="padding:6px 0;color:#666;">Montant</td><td style="padding:6px 0;font-weight:600;">${Number(montant).toLocaleString('fr-FR')} EUR</td></tr>
              <tr><td style="padding:6px 0;color:#666;">Mode</td><td style="padding:6px 0;">${modeLabel}</td></tr>
            </table>
          </div>
          <p style="color:#333;line-height:1.6;">Bonjour ${prenom},</p>
          <p style="color:#333;line-height:1.6;">Nous avons bien recu votre demande de souscription SCPI. Un conseiller Stratege vous contactera sous <strong>48 heures</strong> pour finaliser votre dossier.</p>
          <p style="color:#333;line-height:1.6;">Conservez votre reference <strong style="font-family:monospace;">${reference}</strong> pour le suivi de votre dossier.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="color:#999;font-size:12px;text-align:center;">Stratege — JESPER SAS — Lyon<br/>contact@stratege-immo.fr | stratege-immo.fr</p>
        </div>`;

      await sendEmail(
        email,
        `${prenom} ${nom}`,
        `Votre souscription ${scpiNames} est enregistree — Stratege`,
        clientHtml
      );

      return jsonResponse({
        success: true,
        reference,
        message: 'Souscription enregistree. Un conseiller vous contactera sous 48h.',
      });
    } catch (e) {
      return jsonResponse({ success: false, message: 'Erreur serveur: ' + e.message }, 500);
    }
  }

  return jsonResponse({ error: 'Route non trouvee' }, 404);
}

export async function onRequestGet({ request, env, params }) {
  const path = (params.path || []).join('/');

  if (path === 'souscriptions') {
    // JWT auth required
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return jsonResponse({ error: 'Non autorise' }, 401);
    }

    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) {
      return jsonResponse({ error: 'Token invalide ou expire' }, 401);
    }

    // List all souscriptions from KV
    const list = await env.STRATEGE_DB.list({ prefix: 'souscriptions:' });
    const souscriptions = [];

    for (const key of list.keys) {
      const data = await env.STRATEGE_DB.get(key.name, 'json');
      if (data) {
        souscriptions.push(data);
      }
    }

    // Sort by most recent first
    souscriptions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return jsonResponse({ success: true, souscriptions });
  }

  return jsonResponse({ error: 'Route non trouvee' }, 404);
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: corsHeaders(),
  });
}
