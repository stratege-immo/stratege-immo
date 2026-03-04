export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    const { nom, email, telephone, message, simulation_id } = data;

    if (!nom || !email || !telephone) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Nom, email et téléphone sont requis'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const reference = `STR-${Date.now().toString(36).toUpperCase()}`;
    const key = `contact:${Date.now()}:${email}`;

    await env.STRATEGE_DB.put(key, JSON.stringify({
      reference,
      nom,
      email,
      telephone,
      message: message || '',
      simulation_id: simulation_id || null,
      statut: 'nouveau',
      created_at: new Date().toISOString()
    }), { expirationTtl: 60 * 60 * 24 * 365 });

    return new Response(JSON.stringify({
      success: true,
      message: 'Demande enregistrée. Un conseiller vous contactera sous 24h.',
      reference
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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
