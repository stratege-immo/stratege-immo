// Cloudflare Pages Functions
// GET /api/notifs — get user notifications
// PUT /api/notifs — mark all as read
// POST /api/notifs — create notification (admin only)

async function verifyJWT(token, secret) {
  try {
    const [header, body, signature] = token.split('.');
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(signature.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(header + '.' + body));
    if (!valid) return null;
    const payload = JSON.parse(atob(body.replace(/-/g,'+').replace(/_/g,'/')));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

// GET — get user notifications
export async function onRequestGet(ctx) {
  const auth = ctx.request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Non autorise' }), { status: 401, headers: CORS });
  }

  const payload = await verifyJWT(auth.slice(7), ctx.env.JWT_SECRET);
  if (!payload) {
    return new Response(JSON.stringify({ success: false, error: 'Token invalide' }), { status: 401, headers: CORS });
  }

  const email = payload.sub;
  const raw = await ctx.env.STRATEGE_DB.get('notifs:' + email);
  const notifications = raw ? JSON.parse(raw) : [];
  const unread = notifications.filter(n => !n.read).length;

  return new Response(JSON.stringify({ success: true, unread, notifications }), { headers: CORS });
}

// PUT — mark all as read
export async function onRequestPut(ctx) {
  const auth = ctx.request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Non autorise' }), { status: 401, headers: CORS });
  }

  const payload = await verifyJWT(auth.slice(7), ctx.env.JWT_SECRET);
  if (!payload) {
    return new Response(JSON.stringify({ success: false, error: 'Token invalide' }), { status: 401, headers: CORS });
  }

  const email = payload.sub;
  const raw = await ctx.env.STRATEGE_DB.get('notifs:' + email);
  const notifications = raw ? JSON.parse(raw) : [];

  notifications.forEach(n => { n.read = true; });
  await ctx.env.STRATEGE_DB.put('notifs:' + email, JSON.stringify(notifications));

  return new Response(JSON.stringify({ success: true }), { headers: CORS });
}

// POST — create notification (admin only)
export async function onRequestPost(ctx) {
  const auth = ctx.request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Non autorise' }), { status: 401, headers: CORS });
  }

  const payload = await verifyJWT(auth.slice(7), ctx.env.JWT_SECRET);
  if (!payload || payload.role !== 'admin') {
    return new Response(JSON.stringify({ success: false, error: 'Admin requis' }), { status: 403, headers: CORS });
  }

  let body;
  try {
    body = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Body invalide' }), { status: 400, headers: CORS });
  }

  const { email, type, message } = body;
  if (!email || !type || !message) {
    return new Response(JSON.stringify({ success: false, error: 'email, type et message requis' }), { status: 400, headers: CORS });
  }

  const raw = await ctx.env.STRATEGE_DB.get('notifs:' + email);
  const notifications = raw ? JSON.parse(raw) : [];

  const notif = {
    id: crypto.randomUUID(),
    type,
    message,
    read: false,
    created_at: new Date().toISOString()
  };

  notifications.unshift(notif);
  // Keep max 20 notifications (FIFO)
  if (notifications.length > 20) notifications.length = 20;

  await ctx.env.STRATEGE_DB.put('notifs:' + email, JSON.stringify(notifications));

  return new Response(JSON.stringify({ success: true, notif }), { headers: CORS });
}
