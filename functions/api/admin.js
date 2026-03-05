// Admin API — leads, souscriptions, stats
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const H = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  try {
    const body = await request.json();

    if (action === 'save-lead') {
      const id = 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      body.id = id;
      body.created_at = new Date().toISOString();
      await env.STRATEGE_DB.put('lead:' + id, JSON.stringify(body), { expirationTtl: 31536000 });

      // Update leads index
      const indexRaw = await env.STRATEGE_DB.get('leads:index');
      const index = indexRaw ? JSON.parse(indexRaw) : [];
      index.unshift(id);
      await env.STRATEGE_DB.put('leads:index', JSON.stringify(index.slice(0, 500)));

      return new Response(JSON.stringify({ success: true, id }), { headers: H });
    }

    if (action === 'save-souscription') {
      const id = body.reference || ('SCPI-' + Date.now());
      body.created_at = new Date().toISOString();
      await env.STRATEGE_DB.put('souscription:' + id, JSON.stringify(body), { expirationTtl: 31536000 });

      const indexRaw = await env.STRATEGE_DB.get('souscriptions:index');
      const index = indexRaw ? JSON.parse(indexRaw) : [];
      index.unshift(id);
      await env.STRATEGE_DB.put('souscriptions:index', JSON.stringify(index.slice(0, 500)));

      return new Response(JSON.stringify({ success: true, reference: id }), { headers: H });
    }

    return new Response(JSON.stringify({ error: 'Action inconnue' }), { status: 400, headers: H });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: H });
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const H = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (action === 'leads') {
    const indexRaw = await env.STRATEGE_DB.get('leads:index');
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    const leads = [];
    for (const id of index.slice(0, 50)) {
      const raw = await env.STRATEGE_DB.get('lead:' + id);
      if (raw) leads.push(JSON.parse(raw));
    }
    return new Response(JSON.stringify({ success: true, leads }), { headers: H });
  }

  if (action === 'souscriptions') {
    const indexRaw = await env.STRATEGE_DB.get('souscriptions:index');
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    const souscriptions = [];
    for (const id of index.slice(0, 50)) {
      const raw = await env.STRATEGE_DB.get('souscription:' + id);
      if (raw) souscriptions.push(JSON.parse(raw));
    }
    return new Response(JSON.stringify({ success: true, souscriptions }), { headers: H });
  }

  if (action === 'stats') {
    const leadsRaw = await env.STRATEGE_DB.get('leads:index');
    const sousRaw = await env.STRATEGE_DB.get('souscriptions:index');
    return new Response(JSON.stringify({
      success: true,
      total_leads: leadsRaw ? JSON.parse(leadsRaw).length : 0,
      total_souscriptions: sousRaw ? JSON.parse(sousRaw).length : 0,
    }), { headers: H });
  }

  return new Response(JSON.stringify({ error: 'Action inconnue' }), { status: 400, headers: H });
}