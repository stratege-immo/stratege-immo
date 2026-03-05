export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const key = 'error_log:' + Date.now();
    await env.STRATEGE_DB.put(key, JSON.stringify({
      ...body,
      ip: request.headers.get('CF-Connecting-IP'),
      ua: request.headers.get('User-Agent'),
      received_at: new Date().toISOString()
    }), { expirationTtl: 604800 }); // 7 days
    return new Response('{"ok":true}', {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch {
    return new Response('{"ok":false}', { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
