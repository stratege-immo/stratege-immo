export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    const {
      nom, email, telephone,
      profil,
      revenu_annuel,
      apport,
      effort_mensuel,
      type_simulation
    } = data;

    const revenu = parseFloat(revenu_annuel) || 0;
    const apportNum = parseFloat(apport) || 0;
    const effortNum = parseFloat(effort_mensuel) || 0;

    // Capacité d'emprunt (taux 3.8%, 25 ans)
    const tauxMensuel = 0.038 / 12;
    const nbrMois = 25 * 12;
    const capaciteEmprunt = effortNum > 0
      ? effortNum * (1 - Math.pow(1 + tauxMensuel, -nbrMois)) / tauxMensuel
      : 0;

    const budgetTotal = apportNum + capaciteEmprunt;
    const financementBancaire = capaciteEmprunt;

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

    const economieFiscale = profil !== 'residence'
      ? budgetTotal * 0.12 / 9
      : 0;

    const mensualite = financementBancaire > 0
      ? financementBancaire * tauxMensuel / (1 - Math.pow(1 + tauxMensuel, -nbrMois))
      : 0;

    const effortReel = Math.max(0, mensualite - loyerMensuel);

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
        dispositif: profil !== 'residence' ? 'Pinel Nu' : 'Résidence Principale'
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
