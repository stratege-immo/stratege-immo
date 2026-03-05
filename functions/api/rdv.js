// ═══════════════════════════════════════════════════════════
// STRATEGE — Appointment Booking API
// POST ?action=slots   — Get available slots for a date
// POST ?action=book    — Book an appointment
// GET  ?action=my-rdv  — List user's appointments
// POST ?action=cancel  — Cancel an appointment
// ═══════════════════════════════════════════════════════════

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

const VALID_SLOTS = ['9h00', '10h00', '11h00', '14h00', '15h00', '16h00', '17h00'];
const VALID_TYPES = ['bilan', 'scpi', 'credit', 'suivi'];
const VALID_MODES = ['visio', 'telephone', 'agence'];

function isWeekday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  return day !== 0 && day !== 6;
}

function isFutureDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T12:00:00Z');
  return d > today;
}

function generateRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'RDV-';
  for (let i = 0; i < 5; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── POST handler ─────────────────────────────────────
export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'slots') {
      return handleSlots(request, env);
    }
    if (action === 'book') {
      return handleBook(request, env);
    }
    if (action === 'cancel') {
      return handleCancel(request, env);
    }

    return jsonRes({ success: false, error: 'Action inconnue' }, 400);
  } catch (err) {
    return jsonRes({ success: false, error: err.message }, 500);
  }
}

// ─── GET handler ──────────────────────────────────────
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'my-rdv') {
      return handleMyRdv(request, env, url);
    }

    return jsonRes({ success: false, error: 'Action inconnue' }, 400);
  } catch (err) {
    return jsonRes({ success: false, error: err.message }, 500);
  }
}

// ─── CORS preflight ───────────────────────────────────
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// ═══════════════════════════════════════════════════════════
// ACTION: slots — Return available slots for a given date
// ═══════════════════════════════════════════════════════════
async function handleSlots(request, env) {
  const data = await request.json();
  const { date } = data;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonRes({ success: false, error: 'Date invalide (format YYYY-MM-DD)' }, 400);
  }

  if (!isWeekday(date)) {
    return jsonRes({ success: false, error: 'Pas de creneaux le week-end' }, 400);
  }

  const slots = [];
  for (const time of VALID_SLOTS) {
    const slotKey = `rdv:slot:${date}:${time}`;
    const existing = await env.STRATEGE_DB.get(slotKey);
    slots.push({
      date,
      time,
      available: !existing
    });
  }

  return jsonRes({ success: true, slots });
}

// ═══════════════════════════════════════════════════════════
// ACTION: book — Book an appointment
// ═══════════════════════════════════════════════════════════
async function handleBook(request, env) {
  const data = await request.json();
  const { type, date, time, nom, prenom, email, telephone, mode, projet, duration } = data;

  // Validate required fields
  if (!type || !VALID_TYPES.includes(type)) {
    return jsonRes({ success: false, error: 'Type de rendez-vous invalide' }, 400);
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonRes({ success: false, error: 'Date invalide' }, 400);
  }
  if (!isWeekday(date)) {
    return jsonRes({ success: false, error: 'Pas de creneaux le week-end' }, 400);
  }
  if (!isFutureDate(date)) {
    return jsonRes({ success: false, error: 'La date doit etre dans le futur' }, 400);
  }
  if (!time || !VALID_SLOTS.includes(time)) {
    return jsonRes({ success: false, error: 'Creneau horaire invalide' }, 400);
  }
  if (!nom || !prenom || !email || !telephone) {
    return jsonRes({ success: false, error: 'Nom, prenom, email et telephone sont requis' }, 400);
  }
  if (!validateEmail(email)) {
    return jsonRes({ success: false, error: 'Email invalide' }, 400);
  }
  if (mode && !VALID_MODES.includes(mode)) {
    return jsonRes({ success: false, error: 'Mode de rendez-vous invalide' }, 400);
  }

  // Check slot availability (prevent double-booking)
  const slotKey = `rdv:slot:${date}:${time}`;
  const existingSlot = await env.STRATEGE_DB.get(slotKey);
  if (existingSlot) {
    return jsonRes({ success: false, error: 'Ce creneau vient d\'etre reserve. Veuillez en choisir un autre.' }, 409);
  }

  // Generate reference
  const reference = generateRef();

  const TYPE_LABELS = {
    bilan: 'Bilan patrimonial',
    scpi: 'Conseil SCPI',
    credit: 'Simulation credit',
    suivi: 'Suivi client'
  };

  const rdvData = {
    reference,
    type,
    typeName: TYPE_LABELS[type] || type,
    date,
    time,
    duration: duration || 30,
    nom,
    prenom,
    email,
    telephone,
    mode: mode || 'visio',
    projet: projet || '',
    statut: 'confirme',
    created_at: new Date().toISOString()
  };

  // Store the appointment
  await env.STRATEGE_DB.put(
    `rdv:${reference}`,
    JSON.stringify(rdvData),
    { expirationTtl: 60 * 60 * 24 * 90 } // 90 days
  );

  // Mark the slot as taken
  await env.STRATEGE_DB.put(
    slotKey,
    reference,
    { expirationTtl: 60 * 60 * 24 * 90 }
  );

  // Index by email for lookup
  const emailKey = `rdv:email:${email.toLowerCase()}:${reference}`;
  await env.STRATEGE_DB.put(
    emailKey,
    reference,
    { expirationTtl: 60 * 60 * 24 * 90 }
  );

  // Send confirmation email (fire and forget)
  try {
    const emailUrl = new URL(request.url);
    emailUrl.pathname = '/api/email';
    emailUrl.search = '?type=rdv';
    await fetch(emailUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        prenom,
        reference,
        type: TYPE_LABELS[type],
        date,
        time,
        mode: mode || 'visio'
      })
    });
  } catch (e) {
    // Email failure should not block booking
  }

  return jsonRes({
    success: true,
    reference,
    details: {
      type: rdvData.typeName,
      date,
      time,
      mode: rdvData.mode
    }
  });
}

// ═══════════════════════════════════════════════════════════
// ACTION: my-rdv — List user's appointments by email
// ═══════════════════════════════════════════════════════════
async function handleMyRdv(request, env, url) {
  const email = url.searchParams.get('email');
  if (!email || !validateEmail(email)) {
    return jsonRes({ success: false, error: 'Email invalide' }, 400);
  }

  const prefix = `rdv:email:${email.toLowerCase()}:`;
  const list = await env.STRATEGE_DB.list({ prefix });

  const appointments = [];
  for (const key of list.keys) {
    const ref = await env.STRATEGE_DB.get(key.name);
    if (ref) {
      const rdvData = await env.STRATEGE_DB.get(`rdv:${ref}`);
      if (rdvData) {
        const parsed = JSON.parse(rdvData);
        appointments.push({
          reference: parsed.reference,
          type: parsed.typeName,
          date: parsed.date,
          time: parsed.time,
          mode: parsed.mode,
          statut: parsed.statut
        });
      }
    }
  }

  // Sort by date descending
  appointments.sort((a, b) => b.date.localeCompare(a.date));

  return jsonRes({ success: true, appointments });
}

// ═══════════════════════════════════════════════════════════
// ACTION: cancel — Cancel an appointment
// ═══════════════════════════════════════════════════════════
async function handleCancel(request, env) {
  const data = await request.json();
  const { reference, email } = data;

  if (!reference || !email) {
    return jsonRes({ success: false, error: 'Reference et email requis' }, 400);
  }

  const rdvData = await env.STRATEGE_DB.get(`rdv:${reference}`);
  if (!rdvData) {
    return jsonRes({ success: false, error: 'Rendez-vous introuvable' }, 404);
  }

  const rdv = JSON.parse(rdvData);

  // Verify email matches
  if (rdv.email.toLowerCase() !== email.toLowerCase()) {
    return jsonRes({ success: false, error: 'Email ne correspond pas' }, 403);
  }

  // Update status
  rdv.statut = 'annule';
  rdv.cancelled_at = new Date().toISOString();
  await env.STRATEGE_DB.put(
    `rdv:${reference}`,
    JSON.stringify(rdv),
    { expirationTtl: 60 * 60 * 24 * 90 }
  );

  // Free the slot
  const slotKey = `rdv:slot:${rdv.date}:${rdv.time}`;
  await env.STRATEGE_DB.delete(slotKey);

  return jsonRes({
    success: true,
    message: 'Rendez-vous annule avec succes'
  });
}
