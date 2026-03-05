// POST — create shared simulation link
// GET ?hash=xxx — get shared simulation data

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const hash = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const key = 'shared_sim:' + hash;

    await env.STRATEGE_DB.put(key, JSON.stringify({
      ...body,
      shared_at: new Date().toISOString()
    }), { expirationTtl: 2592000 }); // 30 days

    const url = 'https://stratege-immo.fr/simulation.html?shared=' + hash;

    return new Response(JSON.stringify({
      success: true,
      hash: hash,
      url: url
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Erreur serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const hash = url.searchParams.get('hash');

    if (!hash) {
      return new Response(JSON.stringify({ success: false, error: 'Hash manquant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const key = 'shared_sim:' + hash;
    const data = await env.STRATEGE_DB.get(key);

    if (!data) {
      return new Response(JSON.stringify({ success: false, error: 'Simulation non trouvee ou expiree' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      simulation: JSON.parse(data)
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Erreur serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
