// Nurturing email sequences system
// Cloudflare Pages Function — /api/admin/sequences

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

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

async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyJWT(token, env.JWT_SECRET);
}

const SEQUENCES = {
  welcome: {
    name: 'Bienvenue',
    steps: [
      { delay_days: 0, subject: 'Bienvenue chez Stratege !', template: 'welcome_0' },
      { delay_days: 1, subject: 'Comment fonctionne Stratege ?', template: 'welcome_1' },
      { delay_days: 3, subject: 'Lancez votre premiere simulation', template: 'welcome_3' },
      { delay_days: 7, subject: 'Des opportunites vous attendent', template: 'welcome_7' },
    ]
  },
  post_rdv: {
    name: 'Post RDV',
    steps: [
      { delay_days: 0, subject: 'Confirmation de votre rendez-vous', template: 'rdv_confirm' },
      { delay_days: -1, subject: 'Rappel : votre RDV demain', template: 'rdv_rappel' },
      { delay_days: 1, subject: 'Merci pour votre rendez-vous', template: 'rdv_merci' },
    ]
  },
  scpi_subscriber: {
    name: 'Souscripteur SCPI',
    steps: [
      { delay_days: 0, subject: 'Votre souscription SCPI est confirmee', template: 'scpi_confirm' },
      { delay_days: 7, subject: 'Suivi de votre dossier SCPI', template: 'scpi_suivi' },
      { delay_days: 30, subject: 'Premier releve de votre investissement', template: 'scpi_releve' },
    ]
  },
  no_simulation_30d: {
    name: 'Relance inactifs',
    steps: [
      { delay_days: 0, subject: "Decouvrez votre potentiel d'economie", template: 'relance_simu' },
    ]
  },
};

// ===== EMAIL TEMPLATES =====

function generateEmailHtml(template, subject, recipientEmail) {
  const prenom = recipientEmail.split('@')[0].split('.')[0];
  const prenomCap = prenom.charAt(0).toUpperCase() + prenom.slice(1);

  const templates = {
    welcome_0: `
      <p>Bonjour ${prenomCap},</p>
      <p>Bienvenue chez <strong>Stratege</strong>, votre partenaire en gestion de patrimoine.</p>
      <p>Nous sommes ravis de vous compter parmi nos clients. Notre equipe d'experts est a votre disposition pour vous accompagner dans vos projets d'investissement immobilier et financier.</p>
      <p>Decouvrez nos outils et services :</p>
      <a href="https://stratege-immo.fr/catalogue.html" style="display:inline-block;background:#3ECFB4;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Decouvrir nos programmes</a>
    `,
    welcome_1: `
      <p>Bonjour ${prenomCap},</p>
      <p>Vous vous demandez comment fonctionne Stratege ? Voici les 3 etapes simples :</p>
      <ol style="color:#3F4E66;line-height:1.8">
        <li><strong>Simulez</strong> votre investissement avec nos outils gratuits</li>
        <li><strong>Echangez</strong> avec un conseiller dedie lors d'un rendez-vous personnalise</li>
        <li><strong>Investissez</strong> sereinement avec notre accompagnement complet</li>
      </ol>
      <a href="https://stratege-immo.fr/simulateur-pret.html" style="display:inline-block;background:#3ECFB4;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Lancer une simulation</a>
    `,
    welcome_3: `
      <p>Bonjour ${prenomCap},</p>
      <p>Avez-vous deja lance votre premiere simulation d'investissement ?</p>
      <p>En quelques clics, decouvrez votre capacite d'emprunt et les economies d'impots possibles grace a nos simulateurs gratuits.</p>
      <a href="https://stratege-immo.fr/simulateur-pret.html" style="display:inline-block;background:#3ECFB4;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Simuler maintenant</a>
    `,
    welcome_7: `
      <p>Bonjour ${prenomCap},</p>
      <p>De nouvelles opportunites d'investissement vous attendent sur Stratege !</p>
      <p>Explorez notre catalogue de programmes immobiliers neufs et nos SCPI selectionnees pour leur rendement et leur solidite.</p>
      <a href="https://stratege-immo.fr/catalogue.html" style="display:inline-block;background:#3ECFB4;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Voir les opportunites</a>
      <p style="margin-top:16px">Vous souhaitez en discuter ? <a href="https://stratege-immo.fr/rdv.html" style="color:#3ECFB4;font-weight:600">Prenez rendez-vous</a> avec un conseiller.</p>
    `,
    rdv_confirm: `
      <p>Bonjour ${prenomCap},</p>
      <p>Votre rendez-vous avec un conseiller Stratege est bien confirme.</p>
      <p>Vous recevrez un rappel la veille. En attendant, n'hesitez pas a preparer vos questions.</p>
      <a href="https://stratege-immo.fr" style="display:inline-block;background:#3ECFB4;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Preparer mon rendez-vous</a>
    `,
    rdv_rappel: `
      <p>Bonjour ${prenomCap},</p>
      <p><strong>Rappel :</strong> votre rendez-vous avec un conseiller Stratege est prevu demain.</p>
      <p>Pensez a preparer vos documents (avis d'imposition, bulletins de salaire) pour profiter au mieux de cet echange.</p>
      <p>A demain !</p>
    `,
    rdv_merci: `
      <p>Bonjour ${prenomCap},</p>
      <p>Merci pour votre rendez-vous avec notre equipe !</p>
      <p>Nous esperons que cet echange a repondu a vos attentes. Si vous avez des questions supplementaires, n'hesitez pas a nous contacter.</p>
      <a href="https://stratege-immo.fr/rdv.html" style="display:inline-block;background:#3ECFB4;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Reprendre rendez-vous</a>
    `,
    scpi_confirm: `
      <p>Bonjour ${prenomCap},</p>
      <p>Votre souscription SCPI est bien confirmee. Notre equipe traite votre dossier.</p>
      <p>Vous recevrez un suivi regulier de l'avancement de votre investissement.</p>
      <a href="https://stratege-immo.fr/scpi.html" style="display:inline-block;background:#3ECFB4;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">En savoir plus sur les SCPI</a>
    `,
    scpi_suivi: `
      <p>Bonjour ${prenomCap},</p>
      <p>Votre dossier SCPI avance bien. Voici un point sur les prochaines etapes :</p>
      <ul style="color:#3F4E66;line-height:1.8">
        <li>Validation de votre dossier par la societe de gestion</li>
        <li>Confirmation de la souscription sous 2 a 4 semaines</li>
        <li>Premiers dividendes selon le calendrier de la SCPI</li>
      </ul>
      <p>Des questions ? <a href="https://stratege-immo.fr/rdv.html" style="color:#3ECFB4;font-weight:600">Contactez votre conseiller</a>.</p>
    `,
    scpi_releve: `
      <p>Bonjour ${prenomCap},</p>
      <p>Un mois deja depuis votre souscription SCPI ! Votre investissement est desormais actif.</p>
      <p>Vous pouvez suivre l'evolution de vos parts et consulter les rapports trimestriels de la societe de gestion.</p>
      <a href="https://stratege-immo.fr/scpi.html" style="display:inline-block;background:#3ECFB4;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Consulter mes investissements</a>
    `,
    relance_simu: `
      <p>Bonjour ${prenomCap},</p>
      <p>Saviez-vous que vous pourriez economiser jusqu'a <strong>plusieurs milliers d'euros d'impots</strong> par an grace a l'investissement immobilier ?</p>
      <p>Lancez une simulation gratuite et sans engagement pour decouvrir votre potentiel d'economie.</p>
      <a href="https://stratege-immo.fr/simulateur-pret.html" style="display:inline-block;background:#3ECFB4;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Simuler mon economie</a>
      <p style="margin-top:16px">Besoin d'aide ? <a href="https://stratege-immo.fr/rdv.html" style="color:#3ECFB4;font-weight:600">Prenez rendez-vous</a> avec un conseiller.</p>
    `,
  };

  const body = templates[template] || `<p>Bonjour,</p><p>${subject}</p>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:100%">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1B2E3D,#2d4a7a);padding:32px 40px;text-align:center">
          <h1 style="color:#3ECFB4;font-size:28px;margin:0;font-weight:700;letter-spacing:1px">STRATEGE</h1>
          <p style="color:rgba(255,255,255,.7);font-size:13px;margin:8px 0 0">Gestion de patrimoine</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;color:#3F4E66;font-size:16px;line-height:1.6">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 40px;background:#f8f9fa;text-align:center;border-top:1px solid #e5e7eb">
          <p style="color:#9ca3af;font-size:12px;margin:0">JESPER SAS — Marque Stratege — Lyon</p>
          <p style="color:#9ca3af;font-size:11px;margin:8px 0 0">
            <a href="https://stratege-immo.fr" style="color:#3ECFB4;text-decoration:none">stratege-immo.fr</a> |
            Pour vous desinscrire, repondez "STOP" a cet email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ===== EMAIL SENDING =====

async function sendEmail(recipientEmail, subject, template) {
  const htmlBody = generateEmailHtml(template, subject, recipientEmail);
  try {
    await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipientEmail }] }],
        from: { email: 'noreply@stratege-immo.fr', name: 'Stratege' },
        subject: subject,
        content: [{ type: 'text/html', value: htmlBody }],
      })
    });
    return true;
  } catch (e) {
    console.error('Email send error:', e);
    return false;
  }
}

// ===== HELPER: find target users =====

async function findTargetUsers(env, target) {
  const users = [];
  const prefixes = ['user:', 'lead:'];

  for (const prefix of prefixes) {
    let cursor = null;
    do {
      const listOpts = { prefix, limit: 100 };
      if (cursor) listOpts.cursor = cursor;
      const result = await env.STRATEGE_DB.list(listOpts);
      for (const key of result.keys) {
        try {
          const data = await env.STRATEGE_DB.get(key.name, 'json');
          if (data && data.email) {
            users.push(data);
          }
        } catch {}
      }
      cursor = result.list_complete ? null : result.cursor;
    } while (cursor);
  }

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  if (target === 'recent_7d') {
    return users.filter(u => {
      const created = u.created_at ? new Date(u.created_at).getTime() : 0;
      return (now - created) < sevenDays;
    });
  }
  if (target === 'inactive_30d') {
    return users.filter(u => {
      const lastActivity = u.last_activity ? new Date(u.last_activity).getTime() : (u.created_at ? new Date(u.created_at).getTime() : 0);
      return (now - lastActivity) > thirtyDays;
    });
  }
  if (target === 'all') {
    return users;
  }
  // target is a specific email
  if (target && target.includes('@')) {
    return users.filter(u => u.email === target);
  }
  return users;
}

// ===== HANDLERS =====

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await authenticate(request, env);
  if (!user) return jsonResponse({ success: false, error: 'Non autorise' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'Corps JSON invalide' }, 400);
  }

  const { action } = body;

  // ===== LAUNCH a sequence =====
  if (action === 'launch') {
    const { sequence, target } = body;
    if (!sequence || !SEQUENCES[sequence]) {
      return jsonResponse({ success: false, error: 'Sequence inconnue: ' + sequence }, 400);
    }

    const seqDef = SEQUENCES[sequence];
    const users = await findTargetUsers(env, target || 'all');

    if (users.length === 0) {
      return jsonResponse({ success: true, message: 'Aucun utilisateur trouve pour ce segment', launched: 0 });
    }

    let launched = 0;
    let emailsSent = 0;
    const now = new Date();

    for (const u of users) {
      const email = u.email;
      const kvKey = `sequence:${email}:${sequence}`;

      // Check if sequence already active for this user
      const existing = await env.STRATEGE_DB.get(kvKey, 'json');
      if (existing && existing.step < seqDef.steps.length) continue;

      const firstStep = seqDef.steps[0];
      const nextAt = new Date(now.getTime() + firstStep.delay_days * 24 * 60 * 60 * 1000);

      const seqData = {
        step: 0,
        started_at: now.toISOString(),
        next_at: nextAt.toISOString(),
        sequence_name: sequence,
        email: email,
      };

      await env.STRATEGE_DB.put(kvKey, JSON.stringify(seqData));
      launched++;

      // Send immediately if delay_days is 0
      if (firstStep.delay_days === 0) {
        const sent = await sendEmail(email, firstStep.subject, firstStep.template);
        if (sent) emailsSent++;

        // Advance to next step
        if (seqDef.steps.length > 1) {
          const nextStep = seqDef.steps[1];
          const nextNextAt = new Date(now.getTime() + nextStep.delay_days * 24 * 60 * 60 * 1000);
          seqData.step = 1;
          seqData.next_at = nextNextAt.toISOString();
          seqData.last_sent_at = now.toISOString();
          await env.STRATEGE_DB.put(kvKey, JSON.stringify(seqData));
        } else {
          // Single step sequence, remove it
          await env.STRATEGE_DB.delete(kvKey);
        }
      }
    }

    return jsonResponse({
      success: true,
      sequence: seqDef.name,
      launched,
      emails_sent: emailsSent,
      target_count: users.length,
    });
  }

  // ===== PROCESS pending sequences =====
  if (action === 'process') {
    const now = new Date();
    let processed = 0;
    let emailsSent = 0;
    let completed = 0;
    let errors = 0;

    // Scan all sequence keys
    let cursor = null;
    const pendingKeys = [];
    do {
      const listOpts = { prefix: 'sequence:', limit: 100 };
      if (cursor) listOpts.cursor = cursor;
      const result = await env.STRATEGE_DB.list(listOpts);
      for (const key of result.keys) {
        pendingKeys.push(key.name);
      }
      cursor = result.list_complete ? null : result.cursor;
    } while (cursor);

    for (const kvKey of pendingKeys) {
      try {
        const seqData = await env.STRATEGE_DB.get(kvKey, 'json');
        if (!seqData) continue;

        const nextAt = new Date(seqData.next_at);
        if (nextAt > now) continue; // Not due yet

        const seqDef = SEQUENCES[seqData.sequence_name];
        if (!seqDef) {
          await env.STRATEGE_DB.delete(kvKey);
          continue;
        }

        const currentStep = seqDef.steps[seqData.step];
        if (!currentStep) {
          await env.STRATEGE_DB.delete(kvKey);
          completed++;
          continue;
        }

        // Send the email
        const sent = await sendEmail(seqData.email, currentStep.subject, currentStep.template);
        if (sent) emailsSent++;
        else errors++;

        processed++;

        // Advance to next step
        const nextStepIndex = seqData.step + 1;
        if (nextStepIndex < seqDef.steps.length) {
          const nextStep = seqDef.steps[nextStepIndex];
          const nextNextAt = new Date(now.getTime() + nextStep.delay_days * 24 * 60 * 60 * 1000);
          seqData.step = nextStepIndex;
          seqData.next_at = nextNextAt.toISOString();
          seqData.last_sent_at = now.toISOString();
          await env.STRATEGE_DB.put(kvKey, JSON.stringify(seqData));
        } else {
          // All steps done
          await env.STRATEGE_DB.delete(kvKey);
          completed++;
        }
      } catch (e) {
        console.error('Process sequence error:', kvKey, e);
        errors++;
      }
    }

    return jsonResponse({
      success: true,
      processed,
      emails_sent: emailsSent,
      completed,
      errors,
    });
  }

  return jsonResponse({ success: false, error: 'Action inconnue: ' + action }, 400);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await authenticate(request, env);
  if (!user) return jsonResponse({ success: false, error: 'Non autorise' }, 401);

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'list';

  // Scan all sequence keys
  let cursor = null;
  const allSequences = [];
  do {
    const listOpts = { prefix: 'sequence:', limit: 100 };
    if (cursor) listOpts.cursor = cursor;
    const result = await env.STRATEGE_DB.list(listOpts);
    for (const key of result.keys) {
      try {
        const data = await env.STRATEGE_DB.get(key.name, 'json');
        if (data) allSequences.push(data);
      } catch {}
    }
    cursor = result.list_complete ? null : result.cursor;
  } while (cursor);

  if (action === 'pending') {
    const now = new Date();
    const pending = allSequences.filter(s => new Date(s.next_at) <= now);
    return jsonResponse({ success: true, pending, count: pending.length });
  }

  if (action === 'list') {
    // Group by sequence type
    const grouped = {};
    for (const seq of allSequences) {
      const name = seq.sequence_name;
      if (!grouped[name]) {
        grouped[name] = {
          sequence: name,
          label: SEQUENCES[name] ? SEQUENCES[name].name : name,
          total_steps: SEQUENCES[name] ? SEQUENCES[name].steps.length : 0,
          active_count: 0,
          entries: [],
        };
      }
      grouped[name].active_count++;
      grouped[name].entries.push({
        email: seq.email,
        step: seq.step,
        next_at: seq.next_at,
        started_at: seq.started_at,
      });
    }

    return jsonResponse({
      success: true,
      sequences: Object.values(grouped),
      total_active: allSequences.length,
    });
  }

  return jsonResponse({ success: false, error: 'Action inconnue' }, 400);
}
