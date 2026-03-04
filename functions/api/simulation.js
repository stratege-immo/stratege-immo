// ═══════════════════════════════════════════════════════════
// STRATÈGE — Simulation API (Mars 2026)
// Taux CAFPI mars 2026 | Dispositif Jeanbrun
// ═══════════════════════════════════════════════════════════

const TAUX_CREDIT = {
  10: 0.0302,
  15: 0.0313,
  20: 0.0326,
  25: 0.0341
};

const JEANBRUN = {
  base_amortissable: 0.80,
  neuf: {
    intermediaire: { taux: 0.035, plafond: 8000 },
    social:        { taux: 0.045, plafond: 10000 },
    tres_social:   { taux: 0.055, plafond: 12000 }
  },
  ancien: {
    intermediaire: { taux: 0.03,  plafond: 10700 },
    social:        { taux: 0.035, plafond: 10700 },
    tres_social:   { taux: 0.04,  plafond: 10700 }
  }
};

const DENORMANDIE = {
  taux: { 6: 0.12, 9: 0.18, 12: 0.21 },
  base_max: 300000
};

function calculerJeanbrun(budget, niveau, type_bien) {
  const config = type_bien === 'ancien' ? JEANBRUN.ancien : JEANBRUN.neuf;
  const niv = config[niveau] || config.social;
  const baseAmort = budget * JEANBRUN.base_amortissable;
  const amortAnnuel = Math.min(baseAmort * niv.taux, niv.plafond);
  return amortAnnuel;
}

function calculerDenormandie(budget, duree_engagement) {
  const base = Math.min(budget, DENORMANDIE.base_max);
  const taux = DENORMANDIE.taux[duree_engagement] || DENORMANDIE.taux[9];
  return (base * taux) / duree_engagement;
}

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    const {
      nom, email, telephone,
      profil,
      revenu_annuel,
      apport,
      effort_mensuel,
      type_simulation,
      dispositif,
      duree_credit,
      niveau_jeanbrun,
      type_bien,
      duree_engagement
    } = data;

    const revenu = parseFloat(revenu_annuel) || 0;
    const apportNum = parseFloat(apport) || 0;
    const effortNum = parseFloat(effort_mensuel) || 0;
    const duree = parseInt(duree_credit) || 20;

    // Taux crédit mars 2026 (CAFPI)
    const tauxAnnuel = TAUX_CREDIT[duree] || TAUX_CREDIT[20];
    const tauxMensuel = tauxAnnuel / 12;
    const nbrMois = duree * 12;

    // Capacité d'emprunt
    const capaciteEmprunt = effortNum > 0
      ? effortNum * (1 - Math.pow(1 + tauxMensuel, -nbrMois)) / tauxMensuel
      : 0;

    const budgetTotal = apportNum + capaciteEmprunt;
    const financementBancaire = capaciteEmprunt;

    // Rendements estimés par profil
    const rendements = {
      jeune_actif: 5.8,
      couple: 4.9,
      retraite: 4.2,
      residence: 0
    };
    const rendement = rendements[profil] || 5.0;

    const loyerMensuel = profil !== 'residence'
      ? (budgetTotal * (rendement / 100)) / 12
      : 0;

    // Mensualité réelle
    const mensualite = financementBancaire > 0
      ? financementBancaire * tauxMensuel / (1 - Math.pow(1 + tauxMensuel, -nbrMois))
      : 0;

    const effortReel = Math.max(0, mensualite - loyerMensuel);

    // Taux d'endettement
    const revenuMensuel = revenu / 12;
    const tauxEndettement = revenuMensuel > 0 ? (mensualite / revenuMensuel) * 100 : 0;

    // Économie fiscale selon dispositif
    let economieFiscale = 0;
    let dispositifNom = 'Résidence Principale';
    const tmi = 0.30; // TMI par défaut

    if (profil !== 'residence') {
      const disp = dispositif || 'jeanbrun_social';

      if (disp.startsWith('jeanbrun')) {
        const niveau = disp.replace('jeanbrun_', '') || 'social';
        const bien = type_bien || 'neuf';
        const amortAnnuel = calculerJeanbrun(budgetTotal, niveau, bien);
        economieFiscale = Math.round(amortAnnuel * tmi);
        const niveauLabel = { intermediaire: 'Intermédiaire', social: 'Social', tres_social: 'Très Social' };
        dispositifNom = `Jeanbrun ${niveauLabel[niveau] || 'Social'}`;
      } else if (disp === 'denormandie') {
        const eng = parseInt(duree_engagement) || 9;
        economieFiscale = Math.round(calculerDenormandie(budgetTotal, eng));
        dispositifNom = `Denormandie ${eng} ans`;
      } else if (disp === 'lmnp') {
        // LMNP régime réel : amortissement 3.3%/an sur 80% du bien
        const amortBien = budgetTotal * 0.80 * 0.033;
        economieFiscale = Math.round(amortBien * tmi);
        dispositifNom = 'LMNP Réel';
      } else {
        // Défaut Jeanbrun Social
        const amortAnnuel = calculerJeanbrun(budgetTotal, 'social', 'neuf');
        economieFiscale = Math.round(amortAnnuel * tmi);
        dispositifNom = 'Jeanbrun Social';
      }
    }

    const resultat = {
      simulation_id: `sim_${Date.now()}`,
      profil,
      type_simulation,
      inputs: { revenu_annuel: revenu, apport: apportNum, effort_mensuel: effortNum },
      resultats: {
        budget_total: Math.round(budgetTotal),
        financement_bancaire: Math.round(financementBancaire),
        mensualite: Math.round(mensualite),
        loyer_mensuel_estime: Math.round(loyerMensuel),
        effort_reel: Math.round(effortReel),
        rendement_estime: rendement,
        economie_fiscale_annuelle: Math.round(economieFiscale),
        dispositif: dispositifNom,
        taux_credit: (tauxAnnuel * 100).toFixed(2),
        duree_credit: duree,
        taux_endettement: Math.round(tauxEndettement * 10) / 10
      }
    };

    const key = `simulation:${Date.now()}:${email}`;
    await env.STRATEGE_DB.put(key, JSON.stringify({
      nom, email, telephone,
      ...resultat,
      created_at: new Date().toISOString()
    }), { expirationTtl: 60 * 60 * 24 * 365 });

    return new Response(JSON.stringify({
      success: true,
      ...resultat
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
