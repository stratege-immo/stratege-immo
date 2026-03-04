export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return new Response(JSON.stringify({ success: false, error: 'Email requis' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const key = `favoris:${email}`;
  const data = await env.STRATEGE_DB.get(key);
  const favoris = data ? JSON.parse(data) : [];

  return new Response(JSON.stringify({ success: true, favoris }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const { email, bien } = await request.json();
    if (!email || !bien) {
      return new Response(JSON.stringify({ success: false, error: 'Email et bien requis' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const key = `favoris:${email}`;
    const data = await env.STRATEGE_DB.get(key);
    const favoris = data ? JSON.parse(data) : [];

    if (!favoris.find(f => f.id === bien.id)) {
      favoris.push({ ...bien, added_at: new Date().toISOString() });
      await env.STRATEGE_DB.put(key, JSON.stringify(favoris));
    }

    return new Response(JSON.stringify({ success: true, favoris }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const { email, bien_id } = await request.json();
    const key = `favoris:${email}`;
    const data = await env.STRATEGE_DB.get(key);
    let favoris = data ? JSON.parse(data) : [];
    favoris = favoris.filter(f => f.id !== bien_id);
    await env.STRATEGE_DB.put(key, JSON.stringify(favoris));

    return new Response(JSON.stringify({ success: true, favoris }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
