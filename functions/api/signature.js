// ═══════════════════════════════════════════════════════════
// STRATEGE — Signature Electronique (Self-Hosted)
// POST /api/signature?action=sign
// GET  /api/signature?action=verify|download|list|certificate
// ═══════════════════════════════════════════════════════════

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    if (action === 'sign') return await handleSign(request, env);
    return jsonRes({ success: false, error: 'Action inconnue' }, 400);
  } catch (err) {
    return jsonRes({ success: false, error: err.message }, 500);
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    if (action === 'verify') return await handleVerify(request, env);
    if (action === 'download') return await handleDownload(request, env);
    if (action === 'list') return await handleList(request, env);
    if (action === 'certificate') return await handleCertificate(request, env);
    return jsonRes({ success: false, error: 'Action inconnue' }, 400);
  } catch (err) {
    return jsonRes({ success: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

// ── Sign Document ───────────────────────────────────────
async function handleSign(request, env) {
  const body = await request.json();
  const { doc_type, signer_name, signer_email, signer_phone, signature_png, pdf_base64, hash } = body;

  if (!signer_name || !signer_email || !hash || !pdf_base64) {
    return jsonRes({ success: false, error: 'Champs requis : signer_name, signer_email, hash, pdf_base64' }, 400);
  }

  // Generate unique reference
  const ts = Date.now();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  const reference = `SIG-${ts}-${rand}`;

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const user_agent = request.headers.get('User-Agent') || 'unknown';
  const now = new Date().toISOString();

  // Store signature proof in KV
  const proof = {
    reference,
    hash,
    doc_type: doc_type || 'document',
    signer: {
      name: signer_name,
      email: signer_email,
      phone: signer_phone || null,
      ip,
      user_agent
    },
    signed_pdf_base64: pdf_base64,
    signature_png: signature_png || null,
    timestamp: now,
    created_at: now
  };

  await env.STRATEGE_DB.put(`signature:${reference}`, JSON.stringify(proof));
  await env.STRATEGE_DB.put(`sig_hash:${hash}`, reference);

  // Send confirmation email (fire and forget)
  const docTypeLabel = getDocTypeLabel(doc_type);
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const verifyUrl = `https://stratege-immo.fr/verifier-signature.html?ref=${reference}`;

  const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f5f7">
  <div style="max-width:600px;margin:0 auto;background:#fff">
    <div style="background:#1B2A4A;padding:32px;text-align:center">
      <h1 style="margin:0;color:#4ECDC4;font-size:24px;letter-spacing:1px">STRATEGE</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:13px">Signature electronique</p>
    </div>
    <div style="padding:32px">
      <h2 style="color:#1B2A4A;margin-top:0">Votre document a ete signe avec succes</h2>
      <p style="color:#555;line-height:1.6">Bonjour ${signer_name},</p>
      <p style="color:#555;line-height:1.6">Votre signature electronique a bien ete enregistree. Voici les details :</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0">
        <tr><td style="padding:10px 12px;background:#f8f9fa;border:1px solid #e9ecef;font-weight:bold;color:#1B2A4A;width:40%">Reference</td><td style="padding:10px 12px;border:1px solid #e9ecef;font-family:monospace;color:#333">${reference}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8f9fa;border:1px solid #e9ecef;font-weight:bold;color:#1B2A4A">Type de document</td><td style="padding:10px 12px;border:1px solid #e9ecef;color:#333">${docTypeLabel}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8f9fa;border:1px solid #e9ecef;font-weight:bold;color:#1B2A4A">Date</td><td style="padding:10px 12px;border:1px solid #e9ecef;color:#333">${dateStr}</td></tr>
        <tr><td style="padding:10px 12px;background:#f8f9fa;border:1px solid #e9ecef;font-weight:bold;color:#1B2A4A">Hash SHA-256</td><td style="padding:10px 12px;border:1px solid #e9ecef;font-family:monospace;font-size:11px;color:#333;word-break:break-all">${hash}</td></tr>
      </table>
      <div style="text-align:center;margin:32px 0">
        <a href="${verifyUrl}" style="display:inline-block;background:#4ECDC4;color:#1B2A4A;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px">Verifier l'authenticite</a>
      </div>
      <p style="color:#999;font-size:12px;line-height:1.6">Ce document est horodate et son integrite peut etre verifiee a tout moment via le lien ci-dessus ou en saisissant la reference sur notre plateforme.</p>
    </div>
    <div style="background:#f8f9fa;padding:24px;text-align:center;border-top:1px solid #e9ecef">
      <p style="margin:0;color:#999;font-size:11px;line-height:1.6">JESPER SAS — Marque Stratege<br/>Carte professionnelle CPI — Lyon<br/>contact@stratege-immo.fr | stratege-immo.fr</p>
    </div>
  </div>
</body></html>`;

  sendEmail(env, {
    to: signer_email,
    subject: `Document signe — Stratege (Ref: ${reference})`,
    html: emailHtml
  }).catch(() => {});

  return jsonRes({
    success: true,
    reference,
    hash,
    verify_url: `/verifier-signature.html?ref=${reference}`
  });
}

// ── Verify Signature ────────────────────────────────────
async function handleVerify(request, env) {
  const url = new URL(request.url);
  const ref = url.searchParams.get('ref');
  const hash = url.searchParams.get('hash');

  let reference = ref;

  if (!reference && hash) {
    reference = await env.STRATEGE_DB.get(`sig_hash:${hash}`);
  }

  if (!reference) {
    return jsonRes({ success: true, valid: false });
  }

  const data = await env.STRATEGE_DB.get(`signature:${reference}`);
  if (!data) {
    return jsonRes({ success: true, valid: false });
  }

  const sig = JSON.parse(data);
  return jsonRes({
    success: true,
    valid: true,
    reference: sig.reference,
    signer_name: sig.signer.name,
    doc_type: sig.doc_type,
    doc_type_label: getDocTypeLabel(sig.doc_type),
    timestamp: sig.timestamp,
    hash: sig.hash
  });
}

// ── Download Signed PDF ─────────────────────────────────
async function handleDownload(request, env) {
  const url = new URL(request.url);
  const ref = url.searchParams.get('ref');

  if (!ref) return jsonRes({ success: false, error: 'Reference requise' }, 400);

  const data = await env.STRATEGE_DB.get(`signature:${ref}`);
  if (!data) return jsonRes({ success: false, error: 'Document introuvable' }, 404);

  const sig = JSON.parse(data);
  if (!sig.signed_pdf_base64) return jsonRes({ success: false, error: 'PDF non disponible' }, 404);

  // Decode base64 to binary
  const binaryStr = atob(sig.signed_pdf_base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="document_signe_${ref}.pdf"`,
      ...corsHeaders()
    }
  });
}

// ── List Signatures by Email ────────────────────────────
async function handleList(request, env) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');

  if (!email) return jsonRes({ success: false, error: 'Email requis' }, 400);

  const signatures = [];
  let cursor = null;
  let done = false;

  while (!done) {
    const listOpts = { prefix: 'signature:' };
    if (cursor) listOpts.cursor = cursor;
    const keys = await env.STRATEGE_DB.list(listOpts);

    for (const key of keys.keys) {
      const data = await env.STRATEGE_DB.get(key.name);
      if (data) {
        const sig = JSON.parse(data);
        if (sig.signer && sig.signer.email === email) {
          // Exclude heavy fields
          signatures.push({
            reference: sig.reference,
            doc_type: sig.doc_type,
            doc_type_label: getDocTypeLabel(sig.doc_type),
            signer_name: sig.signer.name,
            timestamp: sig.timestamp,
            hash: sig.hash
          });
        }
      }
    }

    cursor = keys.cursor;
    done = keys.list_complete || !cursor;
  }

  return jsonRes({ success: true, signatures });
}

// ── Certificate of Authenticity ─────────────────────────
async function handleCertificate(request, env) {
  const url = new URL(request.url);
  const ref = url.searchParams.get('ref');

  if (!ref) return jsonRes({ success: false, error: 'Reference requise' }, 400);

  const data = await env.STRATEGE_DB.get(`signature:${ref}`);
  if (!data) return jsonRes({ success: false, error: 'Signature introuvable' }, 404);

  const sig = JSON.parse(data);
  const dateStr = new Date(sig.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const docTypeLabel = getDocTypeLabel(sig.doc_type);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Certificat d'authenticite — ${sig.reference}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #f4f5f7; padding: 40px 20px; }
    .cert { max-width: 700px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .cert-header { background: #1B2A4A; color: white; padding: 40px; text-align: center; }
    .cert-header h1 { font-family: 'Playfair Display', serif; font-size: 28px; margin-bottom: 8px; }
    .cert-header .subtitle { color: #4ECDC4; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; }
    .cert-body { padding: 40px; }
    .cert-body h2 { font-family: 'Playfair Display', serif; color: #1B2A4A; font-size: 22px; margin-bottom: 24px; text-align: center; }
    .valid-badge { display: inline-flex; align-items: center; gap: 8px; background: #d4edda; color: #155724; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 0 auto 32px; }
    .valid-badge svg { width: 20px; height: 20px; }
    .field { display: flex; border-bottom: 1px solid #e9ecef; padding: 14px 0; }
    .field:last-child { border-bottom: none; }
    .field-label { width: 200px; font-weight: 600; color: #1B2A4A; font-size: 14px; flex-shrink: 0; }
    .field-value { color: #333; font-size: 14px; word-break: break-all; }
    .field-value.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .cert-footer { background: #f8f9fa; padding: 24px 40px; border-top: 1px solid #e9ecef; text-align: center; }
    .cert-footer p { color: #999; font-size: 11px; line-height: 1.8; }
    .legal { margin-top: 24px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 12px; color: #888; line-height: 1.7; }
    @media print {
      body { background: white; padding: 0; }
      .cert { box-shadow: none; border-radius: 0; }
    }
    @media (max-width: 600px) {
      .field { flex-direction: column; gap: 4px; }
      .field-label { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="cert">
    <div class="cert-header">
      <div class="subtitle">Stratege — JESPER SAS</div>
      <h1>Certificat d'Authenticite</h1>
    </div>
    <div class="cert-body">
      <div style="text-align:center">
        <div class="valid-badge">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
          Document authentique et integre
        </div>
      </div>
      <h2>Details de la signature</h2>
      <div class="field"><div class="field-label">Reference</div><div class="field-value mono">${sig.reference}</div></div>
      <div class="field"><div class="field-label">Type de document</div><div class="field-value">${docTypeLabel}</div></div>
      <div class="field"><div class="field-label">Signataire</div><div class="field-value">${sig.signer.name}</div></div>
      <div class="field"><div class="field-label">Email</div><div class="field-value">${sig.signer.email}</div></div>
      <div class="field"><div class="field-label">Date de signature</div><div class="field-value">${dateStr}</div></div>
      <div class="field"><div class="field-label">Adresse IP</div><div class="field-value mono">${sig.signer.ip}</div></div>
      <div class="field"><div class="field-label">Hash SHA-256</div><div class="field-value mono">${sig.hash}</div></div>
      <div class="legal">
        <strong>Mentions legales :</strong> Ce certificat atteste que le document identifie par le hash SHA-256 ci-dessus
        a ete signe electroniquement par le signataire mentionne, a la date indiquee. L'integrite du document peut etre
        verifiee en comparant le hash SHA-256 du fichier avec celui enregistre. Cette signature electronique est conforme
        aux dispositions du Reglement (UE) n&deg; 910/2014 (eIDAS) pour les signatures electroniques simples.
        <br/><br/>
        JESPER SAS — Marque Stratege — Carte professionnelle CPI — Lyon — SIREN enregistre au RCS de Lyon.
      </div>
    </div>
    <div class="cert-footer">
      <p>Certificat genere le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}<br/>
      Verifiable sur <a href="https://stratege-immo.fr/verifier-signature.html?ref=${sig.reference}" style="color:#4ECDC4">stratege-immo.fr/verifier-signature</a></p>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...corsHeaders()
    }
  });
}

// ── Email via Mailchannels ──────────────────────────────
async function sendEmail(env, { to, subject, html }) {
  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
    })
  });
}

// ── Helpers ─────────────────────────────────────────────
function getDocTypeLabel(docType) {
  const labels = {
    'bon_reservation': 'Bon de reservation',
    'bulletin_scpi': 'Bulletin de souscription SCPI',
    'mandat_recherche': 'Mandat de recherche',
    'lettre_mission': 'Lettre de mission CGP',
    'conditions_generales': 'Conditions generales',
    'reservation': 'Contrat de reservation',
    'mandat': 'Mandat de recherche',
    'compromis': 'Compromis de vente',
    'scpi': 'Bulletin de souscription SCPI',
    'bilan': 'Bilan patrimonial',
    'cgv': 'Conditions generales de vente',
    'contrat': 'Contrat',
  };
  return labels[docType] || docType || 'Document';
}

function jsonRes(d, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
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
