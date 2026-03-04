// ═══════════════════════════════════════════════════════════
// STRATÈGE — Powens Banking Aggregation API
// POST /api/banque?action=connect|callback|accounts|transactions|analysis
// ═══════════════════════════════════════════════════════════

const POWENS_BASE = 'https://demo.biapi.pro/2.0';

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    if (action === 'connect') return await handleConnect(request, env);
    if (action === 'callback') return await handleCallback(request, env);
    if (action === 'accounts') return await handleAccounts(request, env);
    if (action === 'transactions') return await handleTransactions(request, env);
    if (action === 'analysis') return await handleAnalysis(request, env);
    return jsonRes({ success: false, error: 'Action inconnue' }, 400);
  } catch (err) {
    return jsonRes({ success: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

// ── Get app token ──────────────────────────────────────
async function getAppToken(env) {
  const res = await fetch(`${POWENS_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.POWENS_CLIENT_ID,
      client_secret: env.POWENS_CLIENT_SECRET
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur token Powens');
  return data.access_token;
}

// ── Connect (generate webview URL) ─────────────────────
async function handleConnect(request, env) {
  const body = await request.json();
  const { userId } = body;
  if (!userId) return jsonRes({ success: false, error: 'User ID requis' }, 400);

  const appToken = await getAppToken(env);

  // Create temporary code for webview
  const codeRes = await fetch(`${POWENS_BASE}/auth/token/code`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  const codeData = await codeRes.json();

  if (!codeRes.ok) {
    return jsonRes({ success: false, error: codeData.error || 'Erreur génération code' }, 400);
  }

  const webviewUrl = `${POWENS_BASE}/auth/webview/connect?client_id=${env.POWENS_CLIENT_ID}&code=${codeData.code}&redirect_uri=${encodeURIComponent('https://stratege-immo.fr/api/banque?action=callback')}&state=${userId}`;

  return jsonRes({ success: true, url: webviewUrl, code: codeData.code });
}

// ── Callback (exchange code for user token) ────────────
async function handleCallback(request, env) {
  let code, userId;

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('json')) {
    const body = await request.json();
    code = body.code;
    userId = body.userId;
  } else {
    const url = new URL(request.url);
    code = url.searchParams.get('code');
    userId = url.searchParams.get('state');
  }

  if (!code) return jsonRes({ success: false, error: 'Code requis' }, 400);

  const res = await fetch(`${POWENS_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.POWENS_CLIENT_ID,
      client_secret: env.POWENS_CLIENT_SECRET,
      code: code
    })
  });
  const data = await res.json();

  if (!res.ok) {
    return jsonRes({ success: false, error: data.error || 'Erreur échange token' }, 400);
  }

  // Store user token in KV (short TTL for security)
  if (userId) {
    await env.STRATEGE_DB.put(`powens:${userId}`, JSON.stringify({
      access_token: data.access_token,
      token_type: data.token_type,
      connected_at: new Date().toISOString()
    }), { expirationTtl: 3600 }); // 1 hour TTL
  }

  // If this is a redirect (GET with query params), redirect to dashboard
  if (request.method === 'GET' || !contentType.includes('json')) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': 'https://stratege-immo.fr/dashboard.html#banque' }
    });
  }

  return jsonRes({ success: true, message: 'Banque connectée' });
}

// ── List accounts ──────────────────────────────────────
async function handleAccounts(request, env) {
  const body = await request.json();
  const { userId } = body;
  if (!userId) return jsonRes({ success: false, error: 'User ID requis' }, 400);

  const tokenData = await env.STRATEGE_DB.get(`powens:${userId}`);
  if (!tokenData) return jsonRes({ success: false, error: 'Banque non connectée' }, 401);

  const { access_token } = JSON.parse(tokenData);

  const res = await fetch(`${POWENS_BASE}/users/me/accounts`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  const data = await res.json();

  if (!res.ok) {
    return jsonRes({ success: false, error: 'Erreur récupération comptes' }, 400);
  }

  const accounts = (data.accounts || []).map(function(a) {
    return {
      id: a.id,
      name: a.name,
      balance: a.balance,
      currency: a.currency?.id || 'EUR',
      type: a.type,
      iban: a.iban,
      last_update: a.last_update
    };
  });

  return jsonRes({ success: true, accounts });
}

// ── List transactions ──────────────────────────────────
async function handleTransactions(request, env) {
  const body = await request.json();
  const { userId, minDate, maxDate, accountId } = body;
  if (!userId) return jsonRes({ success: false, error: 'User ID requis' }, 400);

  const tokenData = await env.STRATEGE_DB.get(`powens:${userId}`);
  if (!tokenData) return jsonRes({ success: false, error: 'Banque non connectée' }, 401);

  const { access_token } = JSON.parse(tokenData);

  let url = `${POWENS_BASE}/users/me/transactions?limit=100`;
  if (minDate) url += `&min_date=${minDate}`;
  if (maxDate) url += `&max_date=${maxDate}`;
  if (accountId) url += `&id_account=${accountId}`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  const data = await res.json();

  if (!res.ok) {
    return jsonRes({ success: false, error: 'Erreur récupération transactions' }, 400);
  }

  const transactions = (data.transactions || []).map(function(t) {
    return {
      id: t.id,
      date: t.date,
      value: t.value,
      label: t.original_wording || t.simplified_wording,
      category: t.id_category,
      type: t.type
    };
  });

  return jsonRes({ success: true, transactions });
}

// ── Financial Analysis ─────────────────────────────────
async function handleAnalysis(request, env) {
  const body = await request.json();
  const { userId } = body;
  if (!userId) return jsonRes({ success: false, error: 'User ID requis' }, 400);

  const tokenData = await env.STRATEGE_DB.get(`powens:${userId}`);
  if (!tokenData) return jsonRes({ success: false, error: 'Banque non connectée' }, 401);

  const { access_token } = JSON.parse(tokenData);

  // Fetch accounts
  const accRes = await fetch(`${POWENS_BASE}/users/me/accounts`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  const accData = await accRes.json();

  // Fetch recent transactions (last 3 months)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const minDate = threeMonthsAgo.toISOString().split('T')[0];

  const txRes = await fetch(`${POWENS_BASE}/users/me/transactions?min_date=${minDate}&limit=500`, {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  const txData = await txRes.json();

  // Compute analysis
  const accounts = accData.accounts || [];
  const transactions = txData.transactions || [];

  let totalBalance = 0;
  accounts.forEach(function(a) { totalBalance += a.balance || 0; });

  let totalRevenu = 0;
  let totalDepenses = 0;
  let chargesFixes = 0;

  transactions.forEach(function(t) {
    if (t.value > 0) totalRevenu += t.value;
    else totalDepenses += Math.abs(t.value);

    // Categorize fixed charges (rent, insurance, subscriptions)
    if (t.id_category && [9, 10, 11, 12, 21].includes(t.id_category)) {
      chargesFixes += Math.abs(t.value);
    }
  });

  const months = 3;
  const revenuMensuel = totalRevenu / months;
  const depensesMensuelles = totalDepenses / months;
  const tauxEpargne = revenuMensuel > 0 ? ((revenuMensuel - depensesMensuelles) / revenuMensuel * 100) : 0;
  const capaciteInvestissement = Math.max(0, (revenuMensuel * 0.33) - (chargesFixes / months));

  return jsonRes({
    success: true,
    analysis: {
      solde_total: Math.round(totalBalance),
      revenu_mensuel: Math.round(revenuMensuel),
      depenses_mensuelles: Math.round(depensesMensuelles),
      charges_fixes_mensuelles: Math.round(chargesFixes / months),
      taux_epargne: Math.round(tauxEpargne * 10) / 10,
      capacite_investissement: Math.round(capaciteInvestissement),
      nb_comptes: accounts.length,
      periode_analyse: `${minDate} — ${new Date().toISOString().split('T')[0]}`
    }
  });
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}
