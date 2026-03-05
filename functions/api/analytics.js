/* ═══════════════════════════════════════════════════════════
   STRATÈGE — Self-hosted Analytics API
   POST /api/analytics        → track events (public)
   GET  /api/analytics?action=dashboard&days=7 → admin dashboard
   ═══════════════════════════════════════════════════════════ */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function sha256(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function kvIncrement(kv, key, ttl = 2592000) {
  const current = parseInt(await kv.get(key) || '0', 10);
  await kv.put(key, String(current + 1), { expirationTtl: ttl });
}

async function verifyJWT(token, secret) {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    let sigStr = signature.replace(/-/g, '+').replace(/_/g, '/');
    while (sigStr.length % 4) sigStr += '=';
    const sigBytes = Uint8Array.from(atob(sigStr), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${header}.${body}`));
    if (!valid) return null;
    let bodyStr = body.replace(/-/g, '+').replace(/_/g, '/');
    while (bodyStr.length % 4) bodyStr += '=';
    const payload = JSON.parse(atob(bodyStr));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ── POST: Track event ────────────────────────────────────
async function handleTrack(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { event, props, page, referrer, ts } = body;
  if (!event) return json({ error: 'Missing event' }, 400);

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const sessionHash = (await sha256(ip + date)).slice(0, 16);

  const kv = env.STRATEGE_DB;
  const ttl = 2592000; // 30 days

  // Parse referrer domain
  let refDomain = '';
  if (referrer) {
    try {
      refDomain = new URL(referrer).hostname;
    } catch {
      refDomain = referrer.slice(0, 100);
    }
  }

  // Non-blocking writes via waitUntil if available
  const work = async () => {
    const tasks = [];

    // Pageview counter
    if (page) {
      tasks.push(kvIncrement(kv, `analytics:pv:${date}:${page}`, ttl));
    }

    // Event counter
    tasks.push(kvIncrement(kv, `analytics:ev:${date}:${event}`, ttl));

    // Referrer counter
    if (refDomain) {
      tasks.push(kvIncrement(kv, `analytics:ref:${date}:${refDomain}`, ttl));
    }

    // Unique sessions (JSON array, max 1000)
    tasks.push((async () => {
      const sessKey = `analytics:sessions:${date}`;
      const raw = await kv.get(sessKey);
      let sessions = [];
      try { sessions = JSON.parse(raw) || []; } catch { sessions = []; }
      if (!sessions.includes(sessionHash) && sessions.length < 1000) {
        sessions.push(sessionHash);
        await kv.put(sessKey, JSON.stringify(sessions), { expirationTtl: ttl });
      }
    })());

    await Promise.all(tasks);
  };

  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(work());
  } else {
    await work();
  }

  return json({ success: true });
}

// ── GET: Dashboard aggregation ───────────────────────────
async function handleDashboard(request, env) {
  // Auth check
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Non autorisé' }, 401);

  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return json({ error: 'Token invalide ou expiré' }, 401);

  const url = new URL(request.url);
  const days = Math.min(parseInt(url.searchParams.get('days') || '7', 10), 90);
  const kv = env.STRATEGE_DB;

  const dayList = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dayList.push(d.toISOString().slice(0, 10));
  }

  const result = {
    days: [],
    top_pages: [],
    top_events: [],
    top_referrers: [],
    total_sessions: 0,
    total_pageviews: 0,
  };

  const pageCounts = {};
  const eventCounts = {};
  const refCounts = {};

  for (const date of dayList) {
    let dayPV = 0;
    let daySessions = 0;

    // Pageviews for this date
    const pvKeys = await kv.list({ prefix: `analytics:pv:${date}:` });
    for (const key of pvKeys.keys) {
      const val = parseInt(await kv.get(key.name) || '0', 10);
      dayPV += val;
      const page = key.name.replace(`analytics:pv:${date}:`, '');
      pageCounts[page] = (pageCounts[page] || 0) + val;
    }

    // Events for this date
    const evKeys = await kv.list({ prefix: `analytics:ev:${date}:` });
    for (const key of evKeys.keys) {
      const val = parseInt(await kv.get(key.name) || '0', 10);
      const ev = key.name.replace(`analytics:ev:${date}:`, '');
      eventCounts[ev] = (eventCounts[ev] || 0) + val;
    }

    // Referrers for this date
    const refKeys = await kv.list({ prefix: `analytics:ref:${date}:` });
    for (const key of refKeys.keys) {
      const val = parseInt(await kv.get(key.name) || '0', 10);
      const ref = key.name.replace(`analytics:ref:${date}:`, '');
      refCounts[ref] = (refCounts[ref] || 0) + val;
    }

    // Sessions for this date
    const sessRaw = await kv.get(`analytics:sessions:${date}`);
    let sessions = [];
    try { sessions = JSON.parse(sessRaw) || []; } catch { sessions = []; }
    daySessions = sessions.length;

    result.days.push({ date, pageviews: dayPV, sessions: daySessions });
    result.total_pageviews += dayPV;
    result.total_sessions += daySessions;
  }

  // Sort and take top 20
  result.top_pages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([page, count]) => ({ page, count }));

  result.top_events = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([event, count]) => ({ event, count }));

  result.top_referrers = Object.entries(refCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([referrer, count]) => ({ referrer, count }));

  return json({ success: true, ...result });
}

// ── Main handler ─────────────────────────────────────────
export async function onRequest(context) {
  const { request, env, ctx } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // POST → track event
  if (request.method === 'POST') {
    return handleTrack(request, env, ctx);
  }

  // GET → dashboard
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    if (action === 'dashboard') {
      return handleDashboard(request, env);
    }
    return json({ error: 'Action inconnue. Utilisez ?action=dashboard' }, 400);
  }

  return json({ error: 'Méthode non supportée' }, 405);
}
