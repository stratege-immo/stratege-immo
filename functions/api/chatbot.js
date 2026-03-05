/* ═══════════════════════════════════════════════════════════
   STRATEGE — Chatbot IA powered by AWS Bedrock (Claude Haiku 4.5)
   POST /api/chatbot  { message, history, sessionId }
   Returns { response, suggestions }
   ═══════════════════════════════════════════════════════════ */

const BEDROCK_MODEL = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
const BEDROCK_REGION = 'us-east-1';
const MAX_BEDROCK_PER_SESSION = 5;
const CACHE_TTL = 604800; // 7 jours

// ── FAQ locale — réponses instantanées sans IA (0 coût) ──

const FAQ_LOCAL = {
  "jeanbrun": "La **loi Jeanbrun** remplace Pinel depuis janvier 2025. Reduction d'impot jusqu'a **21% sur 12 ans**. Zones tendues, plafonds de loyers.\n\nSimulez gratuitement votre investissement.",
  "pinel": "Le dispositif Pinel a pris fin au 31/12/2024. Il est remplace par la **loi Jeanbrun Social** avec des taux de reduction similaires.\n\nDecouvrez les biens eligibles dans notre catalogue.",
  "lmnp": "**LMNP** = Location Meublee Non Professionnelle. Amortissement du bien, revenus locatifs peu imposes pendant 15-20 ans. Ideal pour les residences seniors et etudiantes.",
  "scpi": "Top SCPI 2026 :\n1. **Transitions Europe** — 8.16%\n2. **Remake Live** — 7.79%\n3. **Iroko Zen** — 7.12%\n4. **Novaxia Neo** — 6.51%\n5. **Corum Origin** — 6.06%\n\nAccessible des 200EUR.",
  "taux": "**Taux credit immobilier mars 2026** :\n- 7 ans : 2.85%\n- 10 ans : 2.95%\n- 15 ans : 3.10%\n- 20 ans : 3.25%\n- 25 ans : 3.40%",
  "credit": "**Taux credit immobilier mars 2026** :\n- 15 ans : 3.10%\n- 20 ans : 3.25%\n- 25 ans : 3.40%\n\nSimulez votre capacite d'emprunt.",
  "rdv": "Prenez rendez-vous avec un conseiller Stratege. Disponibilites en ligne, visio Jitsi gratuite.",
  "contact": "Contactez-nous : **contact@stratege-immo.fr** ou prenez RDV en ligne.",
  "prix": "Nos simulations sont **100% gratuites**. Plan Approfondi avec accompagnement personnalise : 29EUR/mois.",
  "cpi": "Oui, nous sommes detenteurs de la **CPI N 7501 2025 000 000 012** — Carte Transaction. Societe JESPER SAS.",
  "senioriales": "Nous proposons **38 residences seniors Senioriales** en France. Rendements 5-6%, gestion deleguee, eligible LMNP.",
  "senior": "Les **residences seniors** offrent un rendement stable de 5-6% avec gestion deleguee. Ideal en LMNP. 38 programmes disponibles.",
  "denormandie": "Le **Denormandie** concerne l'ancien renove dans 245 villes moyennes. Travaux >= 25% du cout total. Memes taux de reduction que Jeanbrun (14/17.5/21%).",
  "deficit": "Le **deficit foncier** permet de deduire jusqu'a 10 700EUR/an de travaux de vos revenus fonciers. Ideal pour les biens anciens a renover.",
  "malraux": "La **loi Malraux** offre une reduction d'impot pour la renovation d'immeubles historiques en secteur sauvegarde.",
  "effort": "L'**effort reel d'epargne** = Mensualite credit - Loyer percu - Avantage fiscal. Exemple : T2 Toulouse 189k => effort reel **248EUR/mois** seulement.",
  "stratege": "**Stratege** est un cabinet de gestion de patrimoine (CGP) base a Lyon. Societe JESPER SAS, marque deposee INPI. Specialiste investissement immobilier et SCPI.",
  "qui etes": "**Stratege** est un cabinet de gestion de patrimoine (CGP). Societe JESPER SAS, CPI 7501 2025 000 000 012. Siege : 51 bis rue de Miromesnil, 75008 Paris.",
};

function matchLocal(message) {
  const msg = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, response] of Object.entries(FAQ_LOCAL)) {
    if (msg.includes(key)) return response;
  }
  // Greetings
  if (/^(bonjour|salut|hello|hey|coucou|bonsoir|hi)\b/.test(msg)) {
    return 'Bonjour ! Je suis votre **conseiller IA Stratege**. Comment puis-je vous aider ?\n\nInvestissement immobilier, SCPI, credit, defiscalisation — je suis la pour repondre a vos questions.';
  }
  return null;
}

// ── Cache helpers ──

async function sha1(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const BIENS = [
  { id:'bien_001', titre:'Appartement T2 — Toulouse Capitole', ville:'Toulouse', surface:42, pieces:2, prix:189000, loyer:750, rendement:5.8, dispositif:'Jeanbrun Social', effort:248 },
  { id:'bien_002', titre:'Studio meuble — Lyon Part-Dieu', ville:'Lyon', surface:28, pieces:1, prix:145000, loyer:620, rendement:6.1, dispositif:'LMNP', effort:180 },
  { id:'bien_003', titre:'T3 familial — Bordeaux Chartrons', ville:'Bordeaux', surface:68, pieces:3, prix:312000, loyer:1100, rendement:4.9, dispositif:'Residence principale', effort:1380 },
  { id:'bien_004', titre:'T2 neuf — Montpellier Antigone', ville:'Montpellier', surface:45, pieces:2, prix:198000, loyer:780, rendement:5.6, dispositif:'Jeanbrun Social', effort:290 },
  { id:'bien_005', titre:'Studio — Nantes Centre', ville:'Nantes', surface:25, pieces:1, prix:125000, loyer:550, rendement:6.4, dispositif:'LMNP', effort:155 },
  { id:'bien_006', titre:'T4 standing — Paris 11eme', ville:'Paris', surface:85, pieces:4, prix:890000, loyer:2800, rendement:3.8, dispositif:'Deficit foncier', effort:1500 },
  { id:'bien_007', titre:'T2 neuf — Rennes Beaulieu', ville:'Rennes', surface:40, pieces:2, prix:175000, loyer:680, rendement:5.5, dispositif:'Jeanbrun Social', effort:220 },
  { id:'bien_008', titre:'T3 Denormandie — Marseille Joliette', ville:'Marseille', surface:62, pieces:3, prix:220000, loyer:900, rendement:5.9, dispositif:'Denormandie', effort:280 },
  { id:'bien_009', titre:'Studio meuble — Lille Wazemmes', ville:'Lille', surface:22, pieces:1, prix:112000, loyer:520, rendement:6.7, dispositif:'LMNP', effort:130 },
  { id:'bien_010', titre:'T2 neuf — Strasbourg Neudorf', ville:'Strasbourg', surface:44, pieces:2, prix:205000, loyer:790, rendement:5.4, dispositif:'Jeanbrun Social', effort:300 },
  { id:'bien_011', titre:'T3 residence seniors — Nice Cimiez', ville:'Nice', surface:58, pieces:3, prix:285000, loyer:1050, rendement:5.2, dispositif:'LMNP', effort:380 },
  { id:'bien_012', titre:'T2 — Villeurbanne Campus', ville:'Villeurbanne', surface:38, pieces:2, prix:168000, loyer:660, rendement:5.7, dispositif:'Jeanbrun Social', effort:210 }
];

const SCPI_DATA = [
  { nom:'Transitions Europe', rendement:8.16, gestionnaire:'Arkea REIM', type:'Diversifiee Europe' },
  { nom:'Remake Live', rendement:7.79, gestionnaire:'Remake', type:'Diversifiee' },
  { nom:'Iroko Zen', rendement:7.12, gestionnaire:'Iroko', type:'Diversifiee sans frais' },
  { nom:'Novaxia Neo', rendement:6.51, gestionnaire:'Novaxia', type:'Bureau transformation' },
  { nom:'Corum Origin', rendement:6.06, gestionnaire:'Corum', type:'Diversifiee Europe' }
];

const TAUX_PRET = [
  { duree:7, taux:2.85 },
  { duree:10, taux:2.95 },
  { duree:15, taux:3.10 },
  { duree:20, taux:3.25 },
  { duree:25, taux:3.40 }
];

const SYSTEM_PROMPT = `Tu es le conseiller IA de **Stratege**, cabinet de gestion de patrimoine (CGP) base a Lyon.
Societe JESPER SAS — Marque Stratege deposee INPI.
CPI 7501 2025 000 000 012 — Transaction.
Adresse : 51 bis rue de Miromesnil, 75008 Paris.
Site : stratege-immo.fr

Tu reponds en francais, de maniere professionnelle mais accessible. Tu tutoies le client.
Tu es expert en investissement immobilier, SCPI, defiscalisation et credit immobilier.
Reponds en 2-3 phrases MAX. Sois concis et oriente action.
Utilise **gras** pour les points importants. N'utilise pas d'emojis.
Propose toujours un lien : /simulation.html /scpi.html /rdv.html /pret.html /catalogue.html

=== CATALOGUE DE BIENS (${BIENS.length} biens disponibles) ===
${BIENS.map(b => `- ${b.titre} : ${b.prix.toLocaleString('fr-FR')}EUR, ${b.surface}m2, ${b.pieces}p, loyer ${b.loyer}EUR/mois, rendement ${b.rendement}%, dispositif ${b.dispositif}, effort reel ${b.effort}EUR/mois`).join('\n')}

=== TOP SCPI 2026 ===
${SCPI_DATA.map(s => `- ${s.nom} : rendement ${s.rendement}%, gestionnaire ${s.gestionnaire}, type ${s.type}`).join('\n')}

=== TAUX CREDIT IMMOBILIER MARS 2026 ===
${TAUX_PRET.map(t => `- ${t.duree} ans : ${t.taux}%`).join('\n')}

=== DISPOSITIFS FISCAUX EN VIGUEUR 2026 ===
- **Jeanbrun Social** (remplacant Pinel depuis 2025) : Reduction d'impot 14% sur 6 ans, 17.5% sur 9 ans, 21% sur 12 ans. Zones tendues, plafonds de loyers.
- **Denormandie** : Ancien renove, 245 villes moyennes. Travaux >= 25% du cout total. Memes taux que Jeanbrun.
- **LMNP** (Loueur Meuble Non Professionnel) : Amortissement du bien, revenus locatifs peu imposes pendant 15-20 ans.
- **Deficit Foncier** : Deduction jusqu'a 10 700 EUR/an de travaux des revenus fonciers.
- **Loi Malraux** : Reduction pour renovation d'immeubles historiques en secteur sauvegarde.
- Le dispositif Pinel a pris fin au 31/12/2024.

=== EFFORT REEL D'EPARGNE ===
Formule : Mensualite credit - Loyer percu - Avantage fiscal mensualise = Effort reel
Exemple : T2 Toulouse 189k => mensualite 820EUR - loyer 750EUR - avantage Jeanbrun 178EUR = effort reel 248EUR/mois.

=== PARTENARIAT SENIORIALES ===
38 residences seniors non-medicalisees en France. Rendements 5-6%. LMNP. Gestion deleguee.

=== PAGES DU SITE ===
- catalogue.html : Catalogue des biens
- scpi.html : Comparatif SCPI et souscription
- pret.html : Simulateur de credit
- rdv.html / contact.html : Prendre rendez-vous
- souscrire-scpi.html : Souscrire en SCPI
- blog.html : Articles defiscalisation

Ne reponds JAMAIS a des questions sans rapport avec l'immobilier ou la gestion de patrimoine.
Si hors sujet, ramene poliment vers tes domaines d'expertise.`;

// ── AWS SigV4 Signing for Bedrock ────────────────────────

async function hmacSha256(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data)));
}

async function sha256(data) {
  const encoded = new TextEncoder().encode(data);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoded)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key, dateStamp, region, service) {
  const kDate = await hmacSha256('AWS4' + key, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return await hmacSha256(kService, 'aws4_request');
}

function uriEncode(str, encodeSlash) {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch === '_' || ch === '-' || ch === '~' || ch === '.') {
      result += ch;
    } else if (ch === '/' && !encodeSlash) {
      result += ch;
    } else {
      const hex = ch.charCodeAt(0).toString(16).toUpperCase();
      result += '%' + (hex.length === 1 ? '0' + hex : hex);
    }
  }
  return result;
}

async function signBedrockRequest(accessKey, secretKey, region, model, body) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  const requestPath = `/model/${encodeURIComponent(model)}/invoke`;
  // SigV4: canonical URI = URI-encode the already-encoded path (double-encode special chars)
  const canonicalURI = uriEncode(requestPath, false);
  const service = 'bedrock';

  const payloadHash = await sha256(body);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = `POST\n${canonicalURI}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(signatureBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    url: `https://${host}${requestPath}`,
    headers: {
      'Content-Type': 'application/json',
      'X-Amz-Date': amzDate,
      'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    }
  };
}

// ── Call Bedrock ─────────────────────────────────────────

async function callBedrock(env, messages) {
  const accessKey = env.AWS_ACCESS_KEY_ID;
  const secretKey = env.AWS_SECRET_ACCESS_KEY;
  const region = env.AWS_REGION || BEDROCK_REGION;

  if (!accessKey || !secretKey) {
    throw new Error('AWS credentials not configured');
  }

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: messages,
  });

  const signed = await signBedrockRequest(accessKey, secretKey, region, BEDROCK_MODEL, body);

  const response = await fetch(signed.url, {
    method: 'POST',
    headers: signed.headers,
    body: body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Bedrock ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ── Generate suggestions from response ──────────────────

function generateSuggestions(responseText) {
  const lower = responseText.toLowerCase();
  const suggestions = [];

  if (lower.includes('scpi') || lower.includes('pierre papier')) {
    suggestions.push({ label: 'Voir les SCPI', action: 'link', url: 'scpi.html' });
  }
  if (lower.includes('credit') || lower.includes('pret') || lower.includes('emprunt') || lower.includes('mensualit')) {
    suggestions.push({ label: 'Simuler un credit', action: 'link', url: 'pret.html' });
  }
  if (lower.includes('catalogue') || lower.includes('bien') || lower.includes('appartement') || lower.includes('programme')) {
    suggestions.push({ label: 'Voir le catalogue', action: 'link', url: 'catalogue.html' });
  }
  if (lower.includes('rdv') || lower.includes('rendez-vous') || lower.includes('conseiller') || lower.includes('contact')) {
    suggestions.push({ label: 'Prendre RDV', action: 'link', url: 'rdv.html' });
  }
  if (lower.includes('simul') || lower.includes('effort')) {
    suggestions.push({ label: 'Lancer une simulation', action: 'link', url: 'index.html#simulation' });
  }
  if (lower.includes('souscri')) {
    suggestions.push({ label: 'Souscrire SCPI', action: 'link', url: 'souscrire-scpi.html' });
  }
  if (lower.includes('senior') || lower.includes('senioriales')) {
    suggestions.push({ label: 'Residences seniors', action: 'link', url: 'catalogue.html' });
  }
  if (lower.includes('defiscal') || lower.includes('jeanbrun') || lower.includes('lmnp')) {
    suggestions.push({ label: 'Biens defiscalisation', action: 'link', url: 'catalogue.html' });
  }

  // Deduplicate
  const seen = new Set();
  const unique = suggestions.filter(s => { if (seen.has(s.label)) return false; seen.add(s.label); return true; });

  if (unique.length === 0) {
    unique.push(
      { label: 'Voir le catalogue', action: 'link', url: 'catalogue.html' },
      { label: 'Prendre RDV', action: 'link', url: 'rdv.html' }
    );
  }

  return unique.slice(0, 4);
}

// ── Fallback rule-based ─────────────────────────────────

function fallbackResponse(message) {
  const msg = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (/bonjour|salut|hello|hey|coucou/.test(msg)) {
    return { response: 'Bonjour ! Je suis votre conseiller IA Stratege. Comment puis-je vous aider ? Investissement immobilier, SCPI, credit, defiscalisation — je suis la pour vous.', suggestions: [{ label: 'Catalogue', action: 'link', url: 'catalogue.html' }, { label: 'SCPI', action: 'link', url: 'scpi.html' }, { label: 'Credit', action: 'link', url: 'pret.html' }, { label: 'RDV', action: 'link', url: 'rdv.html' }] };
  }
  if (/scpi|pierre papier/.test(msg)) {
    return { response: 'Top 5 SCPI 2026 :\n\n' + SCPI_DATA.map((s,i) => `${i+1}. **${s.nom}** — ${s.rendement}% (${s.type})`).join('\n'), suggestions: [{ label: 'Comparer', action: 'link', url: 'scpi.html' }] };
  }
  if (/credit|pret|taux|emprunt/.test(msg)) {
    return { response: 'Taux mars 2026 :\n\n' + TAUX_PRET.map(t => `- **${t.duree} ans** : ${t.taux}%`).join('\n'), suggestions: [{ label: 'Simuler', action: 'link', url: 'pret.html' }] };
  }
  return { response: 'Je suis specialise en investissement immobilier, SCPI, credit et defiscalisation. Comment puis-je vous aider ?', suggestions: [{ label: 'Catalogue', action: 'link', url: 'catalogue.html' }, { label: 'SCPI', action: 'link', url: 'scpi.html' }, { label: 'Credit', action: 'link', url: 'pret.html' }, { label: 'RDV', action: 'link', url: 'rdv.html' }] };
}

// ── Main handler ────────────────────────────────────────

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

    const trimmed = message.trim();
    let result;
    let source = 'bedrock';

    // ═══ ÉTAPE 1 : Réponse locale (0 coût) ═══
    const localResponse = matchLocal(trimmed);
    if (localResponse) {
      result = { response: localResponse, suggestions: generateSuggestions(localResponse) };
      source = 'local';
    }

    // ═══ ÉTAPE 2 : Cache KV (0 coût) ═══
    if (!result && env.STRATEGE_DB) {
      try {
        const msgHash = await sha1(trimmed.toLowerCase().trim());
        const cached = await env.STRATEGE_DB.get(`chat_cache:${msgHash}`);
        if (cached) {
          result = { response: cached, suggestions: generateSuggestions(cached) };
          source = 'cache';
        }
      } catch (e) { /* non-fatal */ }
    }

    // ═══ ÉTAPE 3 : Rate limit — max 5 appels Bedrock/session ═══
    if (!result && env.STRATEGE_DB && sessionId) {
      try {
        const rlKey = `chat_rl:${sessionId}`;
        const rlCount = parseInt(await env.STRATEGE_DB.get(rlKey) || '0', 10);
        if (rlCount >= MAX_BEDROCK_PER_SESSION) {
          result = {
            response: 'Vous avez atteint la limite de questions pour cette session. Pour aller plus loin, **prenez rendez-vous** avec un conseiller Stratege — c\'est gratuit et sans engagement.',
            suggestions: [{ label: 'Prendre RDV', action: 'link', url: 'rdv.html' }, { label: 'Nous contacter', action: 'link', url: 'contact.html' }]
          };
          source = 'rate_limit';
        }
      } catch (e) { /* non-fatal */ }
    }

    // ═══ ÉTAPE 4 : Bedrock (coût minimal) ═══
    if (!result) {
      // Build conversation — seulement 4 derniers échanges
      const messages = [];
      if (history && Array.isArray(history)) {
        for (const h of history.slice(-4)) {
          if (h.role === 'user' && h.text) messages.push({ role: 'user', content: h.text });
          else if (h.role === 'bot' && h.text) messages.push({ role: 'assistant', content: h.text });
        }
      }
      messages.push({ role: 'user', content: trimmed });

      try {
        const aiResponse = await callBedrock(env, messages);
        result = { response: aiResponse, suggestions: generateSuggestions(aiResponse) };
        source = 'bedrock';

        // Cache la réponse Bedrock en KV (7 jours)
        if (env.STRATEGE_DB) {
          try {
            const msgHash = await sha1(trimmed.toLowerCase().trim());
            await env.STRATEGE_DB.put(`chat_cache:${msgHash}`, aiResponse, { expirationTtl: CACHE_TTL });
          } catch (e) { /* non-fatal */ }
        }

        // Incrémenter le compteur rate limit
        if (env.STRATEGE_DB && sessionId) {
          try {
            const rlKey = `chat_rl:${sessionId}`;
            const rlCount = parseInt(await env.STRATEGE_DB.get(rlKey) || '0', 10);
            await env.STRATEGE_DB.put(rlKey, String(rlCount + 1), { expirationTtl: 86400 }); // reset 24h
          } catch (e) { /* non-fatal */ }
        }
      } catch (aiErr) {
        console.error('Bedrock error:', aiErr.message);
        result = fallbackResponse(trimmed);
        source = 'fallback';
      }
    }

    // Store conversation in KV (non-blocking)
    if (env.STRATEGE_DB && sessionId) {
      try {
        const key = `chat:${sessionId}`;
        const existing = await env.STRATEGE_DB.get(key, 'json');
        const conversation = existing || { messages: [], created_at: new Date().toISOString() };
        conversation.messages.push({ message: trimmed, response: result.response, timestamp: new Date().toISOString(), source });
        conversation.updated_at = new Date().toISOString();
        if (conversation.messages.length > 50) conversation.messages = conversation.messages.slice(-50);
        await env.STRATEGE_DB.put(key, JSON.stringify(conversation), { expirationTtl: CACHE_TTL });
      } catch (kvErr) { /* non-fatal */ }
    }

    result.source = source;
    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({
      response: 'Desole, une erreur technique est survenue. Veuillez reessayer.',
      suggestions: [{ label: 'Contacter Stratege', action: 'link', url: 'contact.html' }]
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
