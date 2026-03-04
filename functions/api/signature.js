// ═══════════════════════════════════════════════════════════
// STRATÈGE — YouSign API (Signature Électronique)
// POST /api/signature?action=create|webhook|download|list
// ═══════════════════════════════════════════════════════════

const YOUSIGN_BASE = 'https://api-sandbox.yousign.app';

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    if (action === 'create') return await handleCreate(request, env);
    if (action === 'webhook') return await handleWebhook(request, env);
    return jsonRes({ success: false, error: 'Action inconnue' }, 400);
  } catch (err) {
    return jsonRes({ success: false, error: err.message }, 500);
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    if (action === 'download') return await handleDownload(request, env);
    if (action === 'list') return await handleList(request, env);
    return jsonRes({ success: false, error: 'Action inconnue' }, 400);
  } catch (err) {
    return jsonRes({ success: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

// ── Create Signature Request ────────────────────────────
async function handleCreate(request, env) {
  const body = await request.json();
  const { bienNom, bienId, signerEmail, signerName, signerPhone, userId, documentContent } = body;

  if (!signerEmail || !signerName) {
    return jsonRes({ success: false, error: 'Email et nom du signataire requis' }, 400);
  }

  const headers = {
    'Authorization': `Bearer ${env.YOUSIGN_API_KEY}`,
    'Content-Type': 'application/json'
  };

  // 1. Upload document
  const docContent = documentContent || generateReservationPDF(bienNom, bienId, signerName, signerEmail);
  const uploadRes = await fetch(`${YOUSIGN_BASE}/v3/documents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Reservation_${bienId || 'bien'}.pdf`,
      content: docContent,
      content_type: 'application/pdf'
    })
  });
  const doc = await uploadRes.json();
  if (!uploadRes.ok) {
    return jsonRes({ success: false, error: doc.detail || 'Erreur upload document' }, 400);
  }

  // 2. Create signature request
  const sigReqRes = await fetch(`${YOUSIGN_BASE}/v3/signature_requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Réservation ${bienNom || bienId}`,
      delivery_mode: 'email',
      timezone: 'Europe/Paris',
      documents: [doc.id],
      external_id: `${bienId}:${userId || 'unknown'}`
    })
  });
  const sigReq = await sigReqRes.json();
  if (!sigReqRes.ok) {
    return jsonRes({ success: false, error: sigReq.detail || 'Erreur signature request' }, 400);
  }

  // 3. Add signer
  const signerRes = await fetch(`${YOUSIGN_BASE}/v3/signature_requests/${sigReq.id}/signers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      info: {
        first_name: signerName.split(' ')[0] || signerName,
        last_name: signerName.split(' ').slice(1).join(' ') || 'Client',
        email: signerEmail,
        phone_number: signerPhone || undefined,
        locale: 'fr'
      },
      signature_level: 'electronic_signature',
      signature_authentication_mode: 'no_otp',
      fields: [{
        document_id: doc.id,
        type: 'signature',
        page: 1,
        x: 100,
        y: 600,
        width: 200,
        height: 60
      }]
    })
  });
  const signer = await signerRes.json();
  if (!signerRes.ok) {
    return jsonRes({ success: false, error: signer.detail || 'Erreur ajout signataire' }, 400);
  }

  // 4. Activate signature request
  const activateRes = await fetch(`${YOUSIGN_BASE}/v3/signature_requests/${sigReq.id}/activate`, {
    method: 'POST',
    headers
  });
  const activated = await activateRes.json();
  if (!activateRes.ok) {
    return jsonRes({ success: false, error: activated.detail || 'Erreur activation' }, 400);
  }

  // Store in KV
  await env.STRATEGE_DB.put(`signature:${sigReq.id}`, JSON.stringify({
    status: 'pending',
    bien_id: bienId,
    user_id: userId,
    signer_email: signerEmail,
    document_id: doc.id,
    created_at: new Date().toISOString()
  }));

  return jsonRes({
    success: true,
    signatureRequestId: sigReq.id,
    documentId: doc.id,
    status: activated.status
  });
}

// ── Webhook (signature completed) ──────────────────────
async function handleWebhook(request, env) {
  const event = await request.json();

  if (event.event_name === 'signature_request.done' || event.event_name === 'signer.done') {
    const sigReqId = event.data?.signature_request?.id || event.data?.id;

    if (sigReqId) {
      const existing = await env.STRATEGE_DB.get(`signature:${sigReqId}`);
      if (existing) {
        const sig = JSON.parse(existing);
        sig.status = 'signed';
        sig.signed_at = new Date().toISOString();
        await env.STRATEGE_DB.put(`signature:${sigReqId}`, JSON.stringify(sig));

        // Update reservation status
        if (sig.bien_id && sig.user_id) {
          const resKey = `reservation:${sig.bien_id}:${sig.user_id}`;
          const resData = await env.STRATEGE_DB.get(resKey);
          if (resData) {
            const reservation = JSON.parse(resData);
            reservation.signature_status = 'signed';
            reservation.signature_id = sigReqId;
            await env.STRATEGE_DB.put(resKey, JSON.stringify(reservation));
          }
        }
      }
    }
  }

  return new Response('OK', { status: 200 });
}

// ── Download signed document ───────────────────────────
async function handleDownload(request, env) {
  const url = new URL(request.url);
  const sigReqId = url.searchParams.get('id');
  const docId = url.searchParams.get('docId');

  if (!sigReqId) return jsonRes({ success: false, error: 'ID requis' }, 400);

  // Get doc ID from KV if not provided
  let documentId = docId;
  if (!documentId) {
    const sigData = await env.STRATEGE_DB.get(`signature:${sigReqId}`);
    if (sigData) {
      documentId = JSON.parse(sigData).document_id;
    }
  }
  if (!documentId) return jsonRes({ success: false, error: 'Document introuvable' }, 404);

  const res = await fetch(`${YOUSIGN_BASE}/v3/signature_requests/${sigReqId}/documents/${documentId}/download`, {
    headers: { 'Authorization': `Bearer ${env.YOUSIGN_API_KEY}` }
  });

  if (!res.ok) return jsonRes({ success: false, error: 'Erreur téléchargement' }, 400);

  return new Response(res.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="document_signe_${sigReqId}.pdf"`,
      ...corsHeaders()
    }
  });
}

// ── List signatures for user ───────────────────────────
async function handleList(request, env) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return jsonRes({ success: false, error: 'User ID requis' }, 400);

  // List from KV (prefix scan not available, use known pattern)
  const signatures = [];
  const keys = await env.STRATEGE_DB.list({ prefix: 'signature:' });

  for (const key of keys.keys) {
    const data = await env.STRATEGE_DB.get(key.name);
    if (data) {
      const sig = JSON.parse(data);
      if (sig.user_id === userId) {
        signatures.push({ id: key.name.replace('signature:', ''), ...sig });
      }
    }
  }

  return jsonRes({ success: true, signatures });
}

// ── Generate basic reservation document (base64) ───────
function generateReservationPDF(bienNom, bienId, clientName, clientEmail) {
  // Simple HTML-based content encoded as base64 for YouSign
  const html = `
CONTRAT DE RÉSERVATION

Bien : ${bienNom || bienId || 'N/A'}
Référence : ${bienId || 'N/A'}

Client : ${clientName}
Email : ${clientEmail}
Date : ${new Date().toLocaleDateString('fr-FR')}

Le client déclare réserver le bien ci-dessus décrit selon les conditions
générales de vente de Stratège (JESPER SAS).

Signature du client :



_________________________________
${clientName}
`;
  return btoa(unescape(encodeURIComponent(html)));
}

// ── Helpers ─────────────────────────────────────────────
function jsonRes(d, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}
