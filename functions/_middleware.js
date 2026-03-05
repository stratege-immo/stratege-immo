// ═══════════════════════════════════════════════════════════
// STRATÈGE — Middleware: Basic Auth + Cache Headers
// ═══════════════════════════════════════════════════════════

const VALID_CREDENTIALS = btoa('rajaa:rajaavitrine');

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Skip auth for API routes (they have their own auth)
  if (!path.startsWith('/api/')) {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new Response(getLoginPage(), {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Stratège — Accès restreint", charset="UTF-8"',
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache',
        },
      });
    }

    const credentials = authHeader.replace('Basic ', '');
    if (credentials !== VALID_CREDENTIALS) {
      return new Response(getLoginPage('Identifiants incorrects. Réessayez.'), {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Stratège — Accès restreint", charset="UTF-8"',
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache',
        },
      });
    }
  }

  // Auth OK → continue with cache headers
  const response = await next();

  // Assets: aggressive caching (versioned with ?v=)
  if (path.startsWith('/assets/') || path.endsWith('.css') || path.endsWith('.js')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // API: no caching
  else if (path.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store');
  }
  // HTML pages: revalidate
  else if (path.endsWith('.html') || path === '/') {
    response.headers.set('Cache-Control', 'no-cache');
  }

  return response;
}

function getLoginPage(error = '') {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stratège — Accès restreint</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #E8F4F1;
      font-family: 'DM Sans', -apple-system, sans-serif;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 400px;
      width: 90%;
      text-align: center;
      box-shadow: 0 4px 40px rgba(27, 46, 61, 0.1);
    }
    .logo-text {
      font-size: 28px;
      font-weight: 700;
      color: #1B2E3D;
      margin-bottom: 8px;
    }
    .logo-text span { color: #3ECFB4; }
    .tagline {
      font-size: 13px;
      color: #4A6278;
      margin-bottom: 32px;
    }
    h2 {
      font-size: 20px;
      color: #1B2E3D;
      margin-bottom: 8px;
    }
    p { font-size: 14px; color: #4A6278; margin-bottom: 24px; }
    .badge {
      display: inline-block;
      background: #E8F4F1;
      color: #1A9E96;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 12px;
      margin-bottom: 24px;
    }
    ${error ? '.error { color: #E84545; font-size: 13px; margin-bottom: 16px; }' : ''}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-text">Strat<span>è</span>ge</div>
    <div class="tagline">L'immobilier malin et durable</div>
    <div class="badge">🔒 Site en version bêta</div>
    <h2>Accès restreint</h2>
    <p>Veuillez vous authentifier pour accéder au site.</p>
    ${error ? `<p class="error">⚠️ ${error}</p>` : ''}
    <p style="font-size:12px;color:#8BADB8;">Votre navigateur va afficher une fenêtre de connexion.</p>
  </div>
</body>
</html>`;
}
