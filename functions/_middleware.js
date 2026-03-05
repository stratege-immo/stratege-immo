export async function onRequest(context) {
  const response = await context.next();
  const url = new URL(context.request.url);
  const path = url.pathname;

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
