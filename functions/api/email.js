// ═══════════════════════════════════════════════════════════
// STRATÈGE — Email API (Mailchannels)
// POST /api/email?type=welcome|simulation|contact|reset
// ═══════════════════════════════════════════════════════════

export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const data = await request.json();

    let subject = '';
    let html = '';

    switch (type) {
      case 'welcome':
        subject = 'Bienvenue sur Stratège !';
        html = welcomeEmail(data.prenom);
        break;
      case 'simulation':
        subject = 'Votre simulation Stratège';
        html = simulationEmail(data.prenom, data.resultats);
        break;
      case 'contact':
        subject = 'Confirmation de votre demande — Stratège';
        html = contactEmail(data.prenom, data.reference);
        break;
      case 'reset':
        subject = 'Réinitialisation de votre mot de passe — Stratège';
        html = resetEmail(data.prenom, data.resetLink);
        break;
      default:
        return jsonRes({ success: false, error: 'Type email inconnu' }, 400);
    }

    await sendMail(env, data.to, subject, html);
    return jsonRes({ success: true, message: 'Email envoyé' });
  } catch (err) {
    return jsonRes({ success: false, error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

async function sendMail(env, to, subject, html) {
  const payload = {
    personalizations: [{
      to: [{ email: to }],
      ...(env.DKIM_PRIVATE_KEY ? {
        dkim_domain: 'stratege-immo.fr',
        dkim_selector: 'mailchannels',
        dkim_private_key: env.DKIM_PRIVATE_KEY
      } : {})
    }],
    from: { email: 'contact@stratege-immo.fr', name: 'Stratège' },
    subject,
    content: [{ type: 'text/html', value: html }]
  };
  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function wrap(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:'Inter',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA;padding:40px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06)">
<tr><td style="background:#1B2A4A;padding:32px 40px;text-align:center">
<span style="font-size:28px;font-weight:700;color:#4ECDC4;font-family:Georgia,serif">Stratège</span>
</td></tr>
<tr><td style="padding:40px">${content}</td></tr>
<tr><td style="background:#f5f9fb;padding:24px 40px;text-align:center;font-size:12px;color:#6B7F99;line-height:1.6">
JESPER SAS — 51 bis rue de Miromesnil, 75008 Paris<br>
CPI 7501 2025 000 000 012 — Transaction<br>
<a href="https://stratege-immo.fr/mentions-legales.html" style="color:#4ECDC4">Mentions légales</a> |
<a href="https://stratege-immo.fr/politique-confidentialite.html" style="color:#4ECDC4">Confidentialité</a>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function welcomeEmail(prenom) {
  return wrap(`
<h2 style="color:#1B2A4A;font-family:Georgia,serif;margin:0 0 16px">Bienvenue ${prenom} !</h2>
<p style="color:#3F4E66;font-size:16px;line-height:1.6;margin:0 0 24px">
Votre compte Stratège est maintenant actif. Simulez votre capacité d'investissement,
sauvegardez vos projets et bénéficiez d'un accompagnement personnalisé.
</p>
<div style="text-align:center;margin:32px 0">
<a href="https://stratege-immo.fr/index.html#simulation"
   style="background:#4ECDC4;color:#1B2A4A;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
Lancer ma première simulation</a></div>`);
}

function simulationEmail(prenom, r) {
  return wrap(`
<h2 style="color:#1B2A4A;font-family:Georgia,serif;margin:0 0 16px">Votre simulation, ${prenom}</h2>
<p style="color:#3F4E66;font-size:16px;line-height:1.6;margin:0 0 24px">
Voici le récapitulatif de votre simulation d'investissement immobilier.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
<tr><td style="padding:12px 16px;background:#f5f9fb;border-radius:8px 8px 0 0;font-size:14px;color:#6B7F99">Budget total</td>
<td style="padding:12px 16px;background:#f5f9fb;text-align:right;font-weight:700;color:#1B2A4A;font-size:18px">${fmt(r.budget_total)} €</td></tr>
<tr><td style="padding:12px 16px;font-size:14px;color:#6B7F99">Mensualité</td>
<td style="padding:12px 16px;text-align:right;font-weight:600;color:#1B2A4A">${fmt(r.mensualite)} €/mois</td></tr>
<tr><td style="padding:12px 16px;background:#f5f9fb;font-size:14px;color:#6B7F99">Loyer estimé</td>
<td style="padding:12px 16px;background:#f5f9fb;text-align:right;font-weight:600;color:#1B2A4A">${fmt(r.loyer_mensuel_estime)} €/mois</td></tr>
<tr><td style="padding:12px 16px;font-size:14px;color:#6B7F99">Effort réel</td>
<td style="padding:12px 16px;text-align:right;font-weight:700;color:#3DD9BE;font-size:18px">${fmt(r.effort_reel)} €/mois</td></tr>
<tr><td style="padding:12px 16px;background:#f5f9fb;font-size:14px;color:#6B7F99">Économie fiscale</td>
<td style="padding:12px 16px;background:#f5f9fb;text-align:right;font-weight:600;color:#1B2A4A">${fmt(r.economie_fiscale_annuelle)} €/an</td></tr>
<tr><td style="padding:12px 16px;font-size:14px;color:#6B7F99;border-radius:0 0 8px 8px">Dispositif</td>
<td style="padding:12px 16px;text-align:right;font-weight:600;color:#1B2A4A;border-radius:0 0 8px 8px">${r.dispositif}</td></tr>
</table>
<div style="text-align:center;margin:24px 0">
<a href="https://stratege-immo.fr/dashboard.html"
   style="background:#4ECDC4;color:#1B2A4A;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
Voir dans mon espace</a></div>
<p style="color:#6B7F99;font-size:13px;margin:24px 0 0;font-style:italic">
Les résultats sont des estimations indicatives et ne constituent pas un conseil en investissement.</p>`);
}

function contactEmail(prenom, reference) {
  return wrap(`
<h2 style="color:#1B2A4A;font-family:Georgia,serif;margin:0 0 16px">Demande enregistrée !</h2>
<p style="color:#3F4E66;font-size:16px;line-height:1.6;margin:0 0 24px">
Bonjour ${prenom}, votre demande a bien été prise en compte. Un conseiller vous contactera sous 24 heures.
</p>
<div style="background:#f5f9fb;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
<div style="font-size:13px;color:#6B7F99;margin-bottom:4px">Référence dossier</div>
<div style="font-size:28px;font-weight:700;color:#1B2A4A;font-family:Georgia,serif">${reference}</div>
</div>`);
}

function resetEmail(prenom, resetLink) {
  return wrap(`
<h2 style="color:#1B2A4A;font-family:Georgia,serif;margin:0 0 16px">Réinitialisation du mot de passe</h2>
<p style="color:#3F4E66;font-size:16px;line-height:1.6;margin:0 0 24px">
Bonjour ${prenom}, cliquez ci-dessous pour réinitialiser votre mot de passe (lien valable 1 heure).
</p>
<div style="text-align:center;margin:32px 0">
<a href="${resetLink}"
   style="background:#4ECDC4;color:#1B2A4A;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
Réinitialiser</a></div>
<p style="color:#6B7F99;font-size:14px;margin:0">Si vous n'avez pas fait cette demande, ignorez cet email.</p>`);
}

function fmt(n) { return Number(n).toLocaleString('fr-FR'); }
function jsonRes(d, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
