/* ═══════════════════════════════════════════════════════════
   STRATEGE — Chatbot IA (rule-based, no external API)
   POST /api/chatbot  { message, history, sessionId }
   Returns { response, suggestions }
   ═══════════════════════════════════════════════════════════ */

const BIENS = [
  { id:'bien_001', titre:'Appartement T2 — Toulouse Capitole', ville:'Toulouse', surface:42, pieces:2, prix:189000, loyer:750, rendement:5.8, dispositif:'Jeanbrun Social', effort:248 },
  { id:'bien_002', titre:'Studio meublé — Lyon Part-Dieu', ville:'Lyon', surface:28, pieces:1, prix:145000, loyer:620, rendement:6.1, dispositif:'LMNP', effort:180 },
  { id:'bien_003', titre:'T3 familial — Bordeaux Chartrons', ville:'Bordeaux', surface:68, pieces:3, prix:312000, loyer:1100, rendement:4.9, dispositif:'Résidence principale', effort:1380 },
  { id:'bien_004', titre:'T2 neuf — Montpellier Antigone', ville:'Montpellier', surface:45, pieces:2, prix:198000, loyer:780, rendement:5.6, dispositif:'Jeanbrun Social', effort:290 },
  { id:'bien_005', titre:'Studio — Nantes Centre', ville:'Nantes', surface:25, pieces:1, prix:125000, loyer:550, rendement:6.4, dispositif:'LMNP', effort:155 },
  { id:'bien_006', titre:'T4 standing — Paris 11ème', ville:'Paris', surface:85, pieces:4, prix:890000, loyer:2800, rendement:3.8, dispositif:'Déficit foncier', effort:1500 },
  { id:'bien_007', titre:'T2 neuf — Rennes Beaulieu', ville:'Rennes', surface:40, pieces:2, prix:175000, loyer:680, rendement:5.5, dispositif:'Jeanbrun Social', effort:220 },
  { id:'bien_008', titre:'T3 Denormandie — Marseille Joliette', ville:'Marseille', surface:62, pieces:3, prix:220000, loyer:900, rendement:5.9, dispositif:'Denormandie', effort:280 },
  { id:'bien_009', titre:'Studio meublé — Lille Wazemmes', ville:'Lille', surface:22, pieces:1, prix:112000, loyer:520, rendement:6.7, dispositif:'LMNP', effort:130 },
  { id:'bien_010', titre:'T2 neuf — Strasbourg Neudorf', ville:'Strasbourg', surface:44, pieces:2, prix:205000, loyer:790, rendement:5.4, dispositif:'Jeanbrun Social', effort:300 },
  { id:'bien_011', titre:'T3 résidence seniors — Nice Cimiez', ville:'Nice', surface:58, pieces:3, prix:285000, loyer:1050, rendement:5.2, dispositif:'LMNP', effort:380 },
  { id:'bien_012', titre:'T2 — Villeurbanne Campus', ville:'Villeurbanne', surface:38, pieces:2, prix:168000, loyer:660, rendement:5.7, dispositif:'Jeanbrun Social', effort:210 }
];

const SCPI_DATA = [
  { nom:'Transitions Europe', rendement:8.16, gestionnaire:'Arkea REIM', type:'Diversifiée Europe' },
  { nom:'Remake Live', rendement:7.79, gestionnaire:'Remake', type:'Diversifiée' },
  { nom:'Iroko Zen', rendement:7.12, gestionnaire:'Iroko', type:'Diversifiée sans frais' },
  { nom:'Novaxia Neo', rendement:6.51, gestionnaire:'Novaxia', type:'Bureau transformation' },
  { nom:'Corum Origin', rendement:6.06, gestionnaire:'Corum', type:'Diversifiée Europe' }
];

const TAUX_PRET = [
  { duree:7, taux:2.85 },
  { duree:10, taux:2.95 },
  { duree:15, taux:3.10 },
  { duree:20, taux:3.25 },
  { duree:25, taux:3.40 }
];

function normalize(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchKeywords(text, keywords) {
  const n = normalize(text);
  return keywords.some(k => n.includes(k));
}

function formatPrice(n) {
  return n.toLocaleString('fr-FR') + ' \u20AC';
}

function processMessage(message, history) {
  const msg = normalize(message);

  // ── Greeting ──
  if (matchKeywords(message, ['bonjour','bonsoir','salut','hello','coucou','hey','yo','bj','bjr'])) {
    return {
      response: 'Bonjour ! Ravi de vous accueillir chez Stratege. Je peux vous aider sur l\'investissement immobilier, les SCPI, le credit, ou vous presenter notre catalogue de biens. Que souhaitez-vous explorer ?',
      suggestions: [
        { label: 'Voir le catalogue', action: 'catalogue' },
        { label: 'Top SCPI 2026', action: 'scpi' },
        { label: 'Simuler un credit', action: 'pret' },
        { label: 'Prendre RDV', action: 'rdv' }
      ]
    };
  }

  // ── SCPI ──
  if (matchKeywords(message, ['scpi','pierre papier','epargne immobiliere','placement immobilier','rendement scpi'])) {
    const top = SCPI_DATA.map((s, i) => `${i + 1}. **${s.nom}** — ${s.rendement}% (${s.type})`).join('\n');
    return {
      response: `Voici le **Top 5 SCPI 2026** par rendement :\n\n${top}\n\nLes SCPI permettent d'investir dans l'immobilier des 1 000 \u20AC, sans gestion locative. Le rendement moyen du marche est autour de 4.5%, nos selections surperforment nettement.\n\nSouhaitez-vous en savoir plus sur une SCPI en particulier ?`,
      suggestions: [
        { label: 'Comparer les SCPI', action: 'link', url: 'scpi.html' },
        { label: 'Investir en SCPI', action: 'rdv' },
        { label: 'Voir le catalogue immobilier', action: 'catalogue' }
      ]
    };
  }

  // ── Specific SCPI names ──
  for (const scpi of SCPI_DATA) {
    if (normalize(message).includes(normalize(scpi.nom))) {
      return {
        response: `**${scpi.nom}** — Rendement 2025 : ${scpi.rendement}%\n\nGestionnaire : ${scpi.gestionnaire}\nType : ${scpi.type}\n\nC'est ${scpi.rendement >= 7 ? 'une SCPI particulierement performante, bien au-dessus de la moyenne du marche' : 'une SCPI solide avec un track-record reconnu'}. Je vous recommande de diversifier sur 2-3 SCPI pour lisser le risque.`,
        suggestions: [
          { label: 'Voir toutes les SCPI', action: 'link', url: 'scpi.html' },
          { label: 'Prendre RDV avec un conseiller', action: 'rdv' }
        ]
      };
    }
  }

  // ── Credit / Pret immobilier ──
  if (matchKeywords(message, ['credit','pret','taux','emprunt','emprunter','mensualite','banque','financement','simuler','simulation credit'])) {
    const tauxStr = TAUX_PRET.map(t => `- **${t.duree} ans** : ${t.taux}%`).join('\n');

    // Try to extract an amount
    const montantMatch = message.match(/(\d[\d\s]*\d)\s*(euros?|€|eur|k)?/i) || message.match(/(\d+)/);
    let simText = '';
    if (montantMatch) {
      let montant = parseInt(montantMatch[1].replace(/\s/g, ''));
      if (montantMatch[2] && montantMatch[2].toLowerCase() === 'k') montant *= 1000;
      if (montant >= 10000 && montant <= 2000000) {
        const taux20 = 3.25 / 100 / 12;
        const n = 20 * 12;
        const mensualite = Math.round(montant * taux20 / (1 - Math.pow(1 + taux20, -n)));
        simText = `\n\n**Simulation rapide** pour ${formatPrice(montant)} sur 20 ans a 3.25% :\nMensualite estimee : **${formatPrice(mensualite)}/mois**\nCout total du credit : ${formatPrice(mensualite * n - montant)}`;
      }
    }

    return {
      response: `Voici les **taux immobiliers de mars 2026** (moyens constates) :\n\n${tauxStr}${simText}\n\nCes taux sont indicatifs et dependent de votre profil (apport, revenus, endettement). Nous travaillons avec 30+ banques partenaires pour obtenir les meilleures conditions.`,
      suggestions: [
        { label: 'Simuler mon pret', action: 'link', url: 'pret.html' },
        { label: 'Contacter un courtier', action: 'rdv' },
        { label: 'Voir les biens disponibles', action: 'catalogue' }
      ]
    };
  }

  // ── Catalogue / Biens / Investir ──
  if (matchKeywords(message, ['catalogue','bien','biens','appartement','studio','investir','immobilier','acheter','achat','logement','maison'])) {
    // Check for city filter
    const villes = [...new Set(BIENS.map(b => b.ville.toLowerCase()))];
    const villeMatch = villes.find(v => normalize(message).includes(normalize(v)));

    // Check for budget
    const budgetMatch = message.match(/(\d[\d\s]*\d)\s*(euros?|€|k)?/i) || message.match(/(\d{3,})/);
    let budget = null;
    if (budgetMatch) {
      budget = parseInt(budgetMatch[1].replace(/\s/g, ''));
      if (budgetMatch[2] && budgetMatch[2].toLowerCase() === 'k') budget *= 1000;
    }

    let filtered = BIENS.filter(b => b.id !== 'bien_005' || b.disponible !== false); // exclude sold
    if (villeMatch) filtered = filtered.filter(b => b.ville.toLowerCase() === villeMatch);
    if (budget && budget >= 50000) filtered = filtered.filter(b => b.prix <= budget);

    if (filtered.length === 0) {
      return {
        response: 'Je n\'ai pas trouve de bien correspondant exactement a vos criteres dans notre catalogue actuel. Nos conseillers ont acces a des biens hors-marche — je vous invite a prendre rendez-vous pour une recherche personnalisee.',
        suggestions: [
          { label: 'Voir tout le catalogue', action: 'catalogue' },
          { label: 'Prendre RDV', action: 'rdv' },
          { label: 'Investir en SCPI', action: 'link', url: 'scpi.html' }
        ]
      };
    }

    const selection = filtered.slice(0, 3);
    const biensText = selection.map(b =>
      `- **${b.titre}** — ${formatPrice(b.prix)} | ${b.rendement}% | Effort reel: ${formatPrice(b.effort)}/mois (${b.dispositif})`
    ).join('\n');

    const intro = villeMatch
      ? `Voici nos biens disponibles a **${villeMatch.charAt(0).toUpperCase() + villeMatch.slice(1)}** :`
      : budget
        ? `Voici nos biens dans votre budget (< ${formatPrice(budget)}) :`
        : `Nous avons **${filtered.length} biens** disponibles dans notre catalogue. En voici une selection :`;

    return {
      response: `${intro}\n\n${biensText}\n\n${filtered.length > 3 ? `Et ${filtered.length - 3} autres biens disponibles sur notre catalogue complet.` : ''}\n\nL'**effort reel** represente ce que vous payez reellement chaque mois apres loyers et avantages fiscaux.`,
      suggestions: [
        { label: 'Voir le catalogue complet', action: 'link', url: 'catalogue.html' },
        { label: 'Filtrer par ville', action: 'ask_ville' },
        { label: 'Simuler un financement', action: 'pret' }
      ]
    };
  }

  // ── Specific city search ──
  for (const ville of [...new Set(BIENS.map(b => b.ville))]) {
    if (normalize(message).includes(normalize(ville))) {
      const found = BIENS.filter(b => b.ville === ville);
      if (found.length > 0) {
        const biensText = found.map(b =>
          `- **${b.titre}** — ${formatPrice(b.prix)} | ${b.rendement}% | ${b.dispositif}`
        ).join('\n');
        return {
          response: `Nos biens disponibles a **${ville}** :\n\n${biensText}`,
          suggestions: [
            { label: 'Voir le catalogue', action: 'link', url: 'catalogue.html' },
            { label: 'Prendre RDV', action: 'rdv' }
          ]
        };
      }
    }
  }

  // ── Defiscalisation ──
  if (matchKeywords(message, ['defiscal','fiscal','impot','impots','pinel','denormandie','lmnp','deficit foncier','jeanbrun','reduction','avantage fiscal','dispositif'])) {
    return {
      response: `Voici les principaux **dispositifs de defiscalisation immobiliere** en 2026 :\n\n- **Jeanbrun Social** (remplacant Pinel depuis 2025) : Reduction d'impot jusqu'a 14% sur 6 ans, 17.5% sur 9 ans, 21% sur 12 ans. Reserve aux zones tendues, plafonds de loyers.\n\n- **Denormandie** : Comme le Pinel mais pour l'ancien renove. Fonctionne dans 245 villes moyennes. Travaux ≥ 25% du cout total.\n\n- **LMNP** (Loueur Meuble Non Professionnel) : Amortissement du bien, peu ou pas d'impots sur les revenus locatifs pendant 15-20 ans. Ideal pour les studios etudiants ou residences seniors.\n\n- **Deficit Foncier** : Deduisez jusqu'a 10 700 \u20AC/an de travaux de vos revenus fonciers. Pour l'ancien a renover.\n\n*Note : Le dispositif Pinel a pris fin au 31/12/2024.*`,
      suggestions: [
        { label: 'Biens Jeanbrun', action: 'link', url: 'catalogue.html?dispositif=jeanbrun' },
        { label: 'Biens LMNP', action: 'link', url: 'catalogue.html?dispositif=lmnp' },
        { label: 'Prendre RDV fiscal', action: 'rdv' }
      ]
    };
  }

  // ── Seniors / Senioriales ──
  if (matchKeywords(message, ['senior','seniors','senioriales','retraite','residence senior','ehpad','domitys','silver'])) {
    return {
      response: `Stratege est partenaire des **Senioriales**, leader francais des residences seniors non-medicalisees avec **38 residences** en France.\n\n**Pourquoi investir en residence seniors ?**\n- Marche en forte croissance (papy-boom)\n- Rendements attractifs (5-6%)\n- Dispositif LMNP optimise\n- Gestion locative deléguee\n- Bail commercial securise\n\nNous avons par exemple le **T3 residence seniors a Nice Cimiez** : ${formatPrice(285000)}, rendement 5.2%, effort reel ${formatPrice(380)}/mois.`,
      suggestions: [
        { label: 'Voir ce bien seniors', action: 'link', url: 'bien-detail.html?id=bien_011' },
        { label: 'Decouvrir les Senioriales', action: 'link', url: 'catalogue.html' },
        { label: 'Prendre RDV', action: 'rdv' }
      ]
    };
  }

  // ── RDV / Contact ──
  if (matchKeywords(message, ['rdv','rendez-vous','rendezvous','contact','contacter','appeler','telephoner','conseiller','humain','parler'])) {
    return {
      response: `Je serais ravi de vous mettre en relation avec un **conseiller Stratege** !\n\nVous pouvez :\n- **Prendre rendez-vous** directement sur notre page dediee\n- **Nous contacter** par formulaire\n- **Nous appeler** du lundi au vendredi, 9h-19h\n\nNos conseillers sont bases a **Lyon** et interviennent sur toute la France. La premiere consultation est **gratuite et sans engagement**.`,
      suggestions: [
        { label: 'Prendre RDV', action: 'link', url: 'contact.html' },
        { label: 'Formulaire de contact', action: 'link', url: 'contact.html' },
        { label: 'En savoir plus sur nous', action: 'link', url: 'a-propos.html' }
      ]
    };
  }

  // ── About / Stratege / Qui ──
  if (matchKeywords(message, ['stratege','qui etes','presentation','equipe','a propos','cabinet','cgp','gestion patrimoine'])) {
    return {
      response: `**Stratege** est un cabinet de **gestion de patrimoine** (CGP) base a **Lyon**.\n\nNous accompagnons nos clients dans :\n- L'investissement immobilier (neuf et ancien)\n- L'optimisation fiscale\n- Le placement en SCPI\n- Le financement (courtage credit)\n\nNotre approche : un immobilier **malin et durable**, avec des investissements a fort rendement et faible effort d'epargne grace aux dispositifs fiscaux.\n\nMarque deposee INPI — JESPER SAS.`,
      suggestions: [
        { label: 'Qui sommes-nous', action: 'link', url: 'a-propos.html' },
        { label: 'Voir le catalogue', action: 'catalogue' },
        { label: 'Prendre RDV', action: 'rdv' }
      ]
    };
  }

  // ── Effort reel / comment ca marche ──
  if (matchKeywords(message, ['effort reel','effort','comment ca marche','comment fonctionne','expliquer','explication','comprendre','fonctionnement'])) {
    return {
      response: `L'**effort reel d'epargne**, c'est ce que vous payez vraiment chaque mois pour votre investissement immobilier.\n\n**Calcul simple :**\nMensualite credit - Loyer percu - Avantage fiscal mensualise = **Effort reel**\n\n**Exemple concret** avec notre T2 a Toulouse (189 000 \u20AC) :\n- Mensualite credit : 820 \u20AC/mois\n- Loyer percu : 750 \u20AC/mois\n- Avantage Jeanbrun : ~178 \u20AC/mois\n- **Effort reel : 248 \u20AC/mois** seulement !\n\nVous construisez un patrimoine de 189 000 \u20AC pour moins de 250 \u20AC par mois.`,
      suggestions: [
        { label: 'Voir ce bien', action: 'link', url: 'bien-detail.html?id=bien_001' },
        { label: 'Simuler mon investissement', action: 'link', url: 'index.html#simulation' },
        { label: 'Tout le catalogue', action: 'catalogue' }
      ]
    };
  }

  // ── Rendement / Performance ──
  if (matchKeywords(message, ['rendement','performance','rentabilite','meilleur','top','classement','comparatif'])) {
    const topBiens = [...BIENS].sort((a, b) => b.rendement - a.rendement).slice(0, 3);
    const biensText = topBiens.map(b =>
      `- **${b.titre}** — ${b.rendement}% (${formatPrice(b.prix)})`
    ).join('\n');

    return {
      response: `Voici les **meilleurs rendements** de notre catalogue :\n\n${biensText}\n\nEt en SCPI, le top rendement est **Transitions Europe a 8.16%**.\n\nAttention : le rendement n'est pas le seul critere ! La localisation, la qualite du bien et le dispositif fiscal comptent aussi.`,
      suggestions: [
        { label: 'Top SCPI 2026', action: 'scpi' },
        { label: 'Catalogue complet', action: 'catalogue' },
        { label: 'Conseil personnalise', action: 'rdv' }
      ]
    };
  }

  // ── Budget / small amount ──
  if (matchKeywords(message, ['budget','combien','minimum','petit budget','pas cher','accessible','petit'])) {
    const cheapest = [...BIENS].sort((a, b) => a.effort - b.effort).slice(0, 3);
    const text = cheapest.map(b =>
      `- **${b.titre}** — Effort reel: **${formatPrice(b.effort)}/mois** (prix: ${formatPrice(b.prix)})`
    ).join('\n');

    return {
      response: `Bonne nouvelle, l'investissement immobilier est accessible ! Voici nos biens avec le plus **faible effort d'epargne** :\n\n${text}\n\nAvec le dispositif LMNP ou Jeanbrun, votre effort mensuel peut etre inferieur a 200 \u20AC. Et en SCPI, vous pouvez commencer des **1 000 \u20AC**.`,
      suggestions: [
        { label: 'Biens petit budget', action: 'link', url: 'catalogue.html' },
        { label: 'Investir en SCPI', action: 'link', url: 'scpi.html' },
        { label: 'Simuler', action: 'link', url: 'index.html#simulation' }
      ]
    };
  }

  // ── Thank you ──
  if (matchKeywords(message, ['merci','remercie','parfait','genial','super','excellent','top','bravo'])) {
    return {
      response: 'Avec plaisir ! N\'hesitez pas si vous avez d\'autres questions. Je suis la pour vous accompagner dans votre projet immobilier. Bonne journee !',
      suggestions: [
        { label: 'Autre question', action: 'reset' },
        { label: 'Prendre RDV', action: 'rdv' }
      ]
    };
  }

  // ── Goodbye ──
  if (matchKeywords(message, ['au revoir','bye','a bientot','bonne journee','bonne soiree','a plus','ciao'])) {
    return {
      response: 'A bientot ! N\'hesitez pas a revenir quand vous le souhaitez. Toute l\'equipe Stratege est a votre disposition. Bonne continuation !',
      suggestions: [
        { label: 'Nouvelle conversation', action: 'reset' }
      ]
    };
  }

  // ── Fallback (no match) ──
  return {
    response: `Je ne suis pas sur de comprendre votre demande. Je suis specialise dans :\n\n- **L'investissement immobilier** (catalogue de 12 biens)\n- **Les SCPI** (Top 5 rendements 2026)\n- **Le credit immobilier** (taux et simulation)\n- **La defiscalisation** (Jeanbrun, LMNP, Denormandie...)\n- **Les residences seniors** (partenariat Senioriales)\n\nPourriez-vous reformuler ou choisir un sujet ci-dessous ?`,
    suggestions: [
      { label: 'Voir le catalogue', action: 'catalogue' },
      { label: 'Top SCPI 2026', action: 'scpi' },
      { label: 'Simuler un credit', action: 'pret' },
      { label: 'Parler a un conseiller', action: 'rdv' }
    ]
  };
}

export async function onRequestPost({ request, env }) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const { message, history, sessionId } = await request.json();

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({
        response: 'Veuillez entrer un message.',
        suggestions: []
      }), { status: 400, headers: corsHeaders });
    }

    // Process the message
    const result = processMessage(message.trim(), history || []);

    // Store in KV if available (non-blocking)
    if (env.STRATEGE_DB && sessionId) {
      const key = `chat:${sessionId}`;
      const conversationEntry = {
        message: message.trim(),
        response: result.response,
        timestamp: new Date().toISOString()
      };

      try {
        const existing = await env.STRATEGE_DB.get(key, 'json');
        const conversation = existing || { messages: [], created_at: new Date().toISOString() };
        conversation.messages.push(conversationEntry);
        conversation.updated_at = new Date().toISOString();

        // Keep only last 50 messages per session
        if (conversation.messages.length > 50) {
          conversation.messages = conversation.messages.slice(-50);
        }

        await env.STRATEGE_DB.put(key, JSON.stringify(conversation), {
          expirationTtl: 60 * 60 * 24 * 7 // 7 days
        });
      } catch (kvErr) {
        // KV errors are non-fatal
      }
    }

    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({
      response: 'Desole, une erreur technique est survenue. Veuillez reessayer ou contacter notre equipe directement.',
      suggestions: [
        { label: 'Contacter Stratege', action: 'link', url: 'contact.html' }
      ]
    }), { status: 500, headers: corsHeaders });
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
