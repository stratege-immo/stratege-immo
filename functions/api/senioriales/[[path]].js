// ============================================================
// SENIORIALES SCRAPER — Cloudflare Workers
// Site: www.senioriales.com (Drupal, derriere Cloudflare)
// Anti-ban : delais humains, headers realistes, cache KV 6h
// Route: /api/senioriales/*
// ============================================================

const SENIORIALES_BASE = "https://www.senioriales.com";
const CACHE_TTL = 21600; // 6h
const DELAY_MIN = 2000;
const DELAY_MAX = 4000;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Connection": "keep-alive",
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const humanDelay = () => sleep(DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN));

async function fetchPage(url, referer = null) {
  const headers = { ...BROWSER_HEADERS };
  if (referer) {
    headers["Referer"] = referer;
    headers["Sec-Fetch-Site"] = "same-origin";
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      redirect: "follow",
    });

    if (response.status === 429) {
      await sleep(10000);
      return { ok: false, status: 429, error: "Rate limited" };
    }

    if (response.status === 403) {
      return { ok: false, status: 403, error: "Acces refuse" };
    }

    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    return { ok: true, status: 200, html, url };

  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function extractJsonLd(html) {
  const results = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      results.push(JSON.parse(match[1].trim()));
    } catch (e) {}
  }
  return results;
}

function extractMeta(html) {
  const meta = {};
  const regex = /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    meta[match[1]] = match[2];
  }
  return meta;
}

function stripHtml(str) {
  return (str || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Parser adapte a la structure reelle de senioriales.com
// Structure: <div class="search-card"> contenant h3, list-picto, img, description
function parseSearchCards(html) {
  const programmes = [];
  const cardRegex = /<div class="search-card">([\s\S]*?)<\/div>\s*<\/div>/gi;
  let cardMatch;

  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const bloc = cardMatch[1];
    const prog = parseOneCard(bloc);
    if (prog) programmes.push(prog);
  }

  // Dedupliquer
  const seen = new Set();
  return programmes.filter(p => {
    if (seen.has(p.titre)) return false;
    seen.add(p.titre);
    return true;
  });
}

function parseOneCard(bloc) {
  // Titre + lien depuis <h3><a href="...">Nom</a></h3>
  const titleMatch = bloc.match(/<h3><a href="([^"]+)">([^<]+)<\/a><\/h3>/);
  if (!titleMatch) return null;

  const url_path = titleMatch[1];
  const titre = titleMatch[2].trim();

  // Sous-titre (localisation) depuis <p><strong>...</strong></p>
  const subtitleMatch = bloc.match(/<p><strong>\s*([\s\S]*?)\s*<\/strong><\/p>/);
  const localisation = subtitleMatch ? stripHtml(subtitleMatch[1]) : "";

  // Departement depuis <div class="region" title="...">
  const deptMatch = bloc.match(/<div class="region" title="([^"]+)">/);
  const departement = deptMatch ? deptMatch[1] : "";

  // Code postal depuis <span class="postal-code">
  const cpMatch = bloc.match(/<span class="postal-code">([^<]+)<\/span>/);
  const code_postal = cpMatch ? cpMatch[1].trim() : "";

  // Type depuis <li class="types">
  const typesMatch = bloc.match(/<li class="types">([^<]+)<\/li>/);
  const types = typesMatch ? typesMatch[1].trim() : "";

  // Livraison depuis <li class="delivery">
  const deliveryMatch = bloc.match(/<li class="delivery">[\s\S]*?<strong>([^<]+)<\/strong>/);
  const livraison = deliveryMatch ? deliveryMatch[1].trim() : "";

  // Prix depuis <li class="price">
  const prixMatch = bloc.match(/<li class="price">[^<]*?(\d[\d\s]*)\s*\u20ac/);
  const prix = prixMatch ? parseInt(prixMatch[1].replace(/\s/g, "")) : null;

  // Image
  const imgMatch = bloc.match(/<img src="([^"]+)"/);
  const image = imgMatch ? imgMatch[1] : "";

  // Description
  const descMatch = bloc.match(/<\/figure>\s*<p>\s*([\s\S]*?)\s*<\/p>/);
  const description = descMatch ? stripHtml(descMatch[1]) : "";

  // Determiner si c'est achat ou investissement depuis l'URL
  const isInvest = url_path.startsWith("/investir");

  // Extraire la ville du titre ("Senioriales de X" ou "Senioriales du X")
  const villeFromTitle = titre.match(/Senioriales (?:de |du |d'|des )(.+)/i);
  const ville = villeFromTitle ? villeFromTitle[1].trim() : localisation.split(",")[0] || "";

  // Determiner la region depuis l'URL
  const regionMatch = url_path.match(/\/(acheter|investir)\/([^/]+)\//);
  const region = regionMatch ? regionMatch[2].replace(/-/g, " ") : "";

  return {
    id: `SEN-${url_path.replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-")}`,
    source: "senioriales",
    titre,
    ville,
    localisation,
    departement,
    code_postal,
    region,
    types,
    livraison,
    prix_min: prix,
    description,
    url_detail: SENIORIALES_BASE + url_path,
    image: image.startsWith("http") ? image : (image ? SENIORIALES_BASE + image : ""),
    dispositif: isInvest ? "investissement-senior" : "residence-senior",
    promoteur: "Senioriales",
    badge: "Partenaire",
    type: "residence senior",
    categorie: isInvest ? "investir" : "acheter",
    lots: [],
    lots_disponibles: 0,
  };
}

// Parser page detail d'un programme
function parseProgrammeDetail(html, programmeId) {
  const lots = [];

  // JSON-LD
  const jsonLd = extractJsonLd(html);
  for (const ld of jsonLd) {
    if (ld["@type"] === "Offer" || ld["@type"] === "Product") {
      lots.push({
        id: `SEN-LOT-${ld.sku || Date.now()}`,
        programme_id: programmeId,
        source: "senioriales",
        reference: ld.sku || ld.identifier || "",
        type: ld.name || "",
        surface: parseFloat(ld.additionalProperty?.find(p => p.name === "surface")?.value || 0),
        prix: parseInt(ld.offers?.price || ld.price || 0),
        disponible: ld.offers?.availability !== "OutOfStock",
      });
    }
  }

  if (lots.length > 0) return lots;

  // Chercher les informations de lots dans le HTML
  // Structure Senioriales: souvent des blocs avec prix/surface/type
  const lotBlocks = html.match(/<(?:div|li)[^>]*class="[^"]*(?:lot|typology|offer|product)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|li)>/gi) || [];
  for (const lotBlock of lotBlocks) {
    const prixMatch = lotBlock.match(/(\d[\d\s]*)\s*\u20ac/);
    const surfMatch = lotBlock.match(/(\d+(?:[.,]\d+)?)\s*m\u00b2/);
    const typeMatch = lotBlock.match(/T[1-5]/i);
    if (prixMatch || surfMatch) {
      lots.push({
        id: `SEN-LOT-${programmeId}-${lots.length + 1}`,
        programme_id: programmeId,
        source: "senioriales",
        reference: `Lot ${lots.length + 1}`,
        type: typeMatch ? typeMatch[0].toUpperCase() : "",
        surface: surfMatch ? parseFloat(surfMatch[1].replace(",", ".")) : 0,
        prix: prixMatch ? parseInt(prixMatch[1].replace(/\s/g, "")) : 0,
        disponible: !lotBlock.toLowerCase().includes("vendu") && !lotBlock.toLowerCase().includes("reserve"),
      });
    }
  }

  // Table de lots
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (tableMatch && lots.length === 0) {
    const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const row of rows.slice(1)) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      const texts = cells.map(c => stripHtml(c));
      if (texts.length >= 2) {
        const prixCell = texts.find(t => t.match(/\d[\d\s]*\s*\u20ac/));
        const surfCell = texts.find(t => t.match(/\d+\s*m\u00b2/));
        lots.push({
          id: `SEN-LOT-${programmeId}-${lots.length + 1}`,
          programme_id: programmeId,
          source: "senioriales",
          reference: texts[0] || `Lot ${lots.length + 1}`,
          type: texts.find(t => t.match(/T[1-5]/i)) || "",
          surface: surfCell ? parseFloat(surfCell.replace(/[^\d.,]/g, "").replace(",", ".")) : 0,
          prix: prixCell ? parseInt(prixCell.replace(/[^\d]/g, "")) : 0,
          disponible: !row.toLowerCase().includes("vendu") && !row.toLowerCase().includes("reserve"),
        });
      }
    }
  }

  return lots;
}

// --- SCRAPER PRINCIPAL ---
async function scrapeProgrammes(env) {
  const log = [];
  const startTime = Date.now();
  const SCRAP_KEY = "senioriales:scraping_in_progress";

  const inProgress = await env.STRATEGE_DB.get(SCRAP_KEY);
  if (inProgress) {
    return { ok: false, error: "Scraping deja en cours", log };
  }
  await env.STRATEGE_DB.put(SCRAP_KEY, "1", { expirationTtl: 600 });

  try {
    log.push(`[${new Date().toISOString()}] Debut scraping Senioriales`);

    // ETAPE 1 : Page d'accueil (etablir la session)
    await humanDelay();
    const home = await fetchPage(SENIORIALES_BASE);
    if (!home.ok) {
      await env.STRATEGE_DB.delete(SCRAP_KEY);
      return { ok: false, error: `Page d'accueil bloquee (${home.status || home.error})`, log };
    }
    log.push(`OK Page d'accueil (${home.html.length} bytes)`);

    // ETAPE 2 : Scraper les 2 pages de listings
    let allProgrammes = [];

    const listPages = [
      { url: `${SENIORIALES_BASE}/acheter/recherche-residence`, type: "acheter" },
      { url: `${SENIORIALES_BASE}/investir/recherche-programme`, type: "investir" },
    ];

    for (const { url, type } of listPages) {
      await humanDelay();
      log.push(`Scraping ${type}: ${url}`);
      const result = await fetchPage(url, SENIORIALES_BASE + "/");

      if (!result.ok) {
        log.push(`  -> Echec ${type}: ${result.status || result.error}`);
        continue;
      }

      log.push(`  OK ${type} (${result.html.length} bytes)`);
      const programmes = parseSearchCards(result.html);
      log.push(`  -> ${programmes.length} programmes trouves`);
      allProgrammes.push(...programmes);

      // Pagination - chercher ?page=1, ?page=2, etc.
      const pageMatches = result.html.match(/href="\?page=(\d+)"/g) || [];
      const pageNums = [...new Set(pageMatches.map(m => parseInt(m.match(/page=(\d+)/)[1])))].filter(n => n > 0).sort();

      for (const pageNum of pageNums.slice(0, 5)) {
        await humanDelay();
        const pageUrl = `${url}?page=${pageNum}`;
        log.push(`  Pagination ${type} page ${pageNum + 1}: ${pageUrl}`);
        const pageResult = await fetchPage(pageUrl, url);
        if (!pageResult.ok) {
          log.push(`    -> Bloque (${pageResult.status || pageResult.error})`);
          break;
        }
        const moreProg = parseSearchCards(pageResult.html);
        log.push(`    -> +${moreProg.length} programmes`);
        allProgrammes.push(...moreProg);
      }

      // Pause anti-ban entre les 2 sections
      log.push(`  Pause 5s (anti-ban)...`);
      await sleep(5000);
    }

    // Dedupliquer par URL
    const seen = new Set();
    allProgrammes = allProgrammes.filter(p => {
      if (seen.has(p.url_detail)) return false;
      seen.add(p.url_detail);
      return true;
    });

    log.push(`-> ${allProgrammes.length} programmes uniques au total`);

    // ETAPE 3 : Recuperer les details de chaque programme
    let totalLots = 0;

    for (let i = 0; i < allProgrammes.length; i++) {
      const prog = allProgrammes[i];

      await humanDelay();
      log.push(`Detail ${i + 1}/${allProgrammes.length}: ${prog.titre}`);

      const detail = await fetchPage(prog.url_detail, SENIORIALES_BASE + "/");
      if (detail.ok) {
        const lots = parseProgrammeDetail(detail.html, prog.id);
        const meta = extractMeta(detail.html);
        const detailLd = extractJsonLd(detail.html);

        if (meta["og:title"]) prog.titre = meta["og:title"];
        if (meta["og:description"]) prog.description = meta["og:description"];
        if (meta["og:image"]) prog.image = meta["og:image"];

        for (const ld of detailLd) {
          if (ld.address) {
            prog.adresse = ld.address.streetAddress || prog.adresse;
            prog.ville = ld.address.addressLocality || prog.ville;
            prog.code_postal = ld.address.postalCode || prog.code_postal;
          }
          if (ld.geo) {
            prog.lat = ld.geo.latitude;
            prog.lng = ld.geo.longitude;
          }
        }

        prog.lots = lots;
        prog.lots_disponibles = lots.filter(l => l.disponible).length;
        totalLots += prog.lots_disponibles;
        log.push(`  OK ${lots.length} lots (${prog.lots_disponibles} dispo)`);

        await env.STRATEGE_DB.put(
          `senioriales:prog:${prog.id}`,
          JSON.stringify({ ...prog, scraped_at: new Date().toISOString() }),
          { expirationTtl: CACHE_TTL }
        );
      } else {
        log.push(`  WARN Detail inaccessible (${detail.error})`);
      }

      // Pause longue tous les 5 programmes
      if ((i + 1) % 5 === 0 && i < allProgrammes.length - 1) {
        log.push(`  Pause 8s (anti-ban)...`);
        await sleep(8000);
      }
    }

    // ETAPE 4 : Stocker l'index global
    const index = {
      programmes: allProgrammes,
      total_programmes: allProgrammes.length,
      total_lots: totalLots,
      scraped_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      next_refresh: new Date(Date.now() + CACHE_TTL * 1000).toISOString(),
    };

    await env.STRATEGE_DB.put(
      "senioriales:index",
      JSON.stringify(index),
      { expirationTtl: CACHE_TTL }
    );

    log.push(`DONE Sync terminee en ${Math.round(index.duration_ms / 1000)}s`);
    log.push(`DONE ${index.total_programmes} programmes, ${index.total_lots} lots disponibles`);

    await env.STRATEGE_DB.delete(SCRAP_KEY);
    return { ok: true, ...index, log };

  } catch (err) {
    await env.STRATEGE_DB.delete(SCRAP_KEY);
    log.push(`ERREUR: ${err.message}`);
    return { ok: false, error: err.message, log };
  }
}

// --- ROUTEUR ---
export async function onRequest(context) {
  const { request, env } = context;
  const pathParts = (context.params?.path || []);
  const subPath = pathParts.join("/");

  const JSON_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  // /api/senioriales/test
  if (subPath === "test") {
    await humanDelay();
    const result = await fetchPage(SENIORIALES_BASE);
    return new Response(JSON.stringify({
      accessible: result.ok,
      status: result.status,
      message: result.ok
        ? "Site Senioriales accessible depuis Cloudflare Workers"
        : `Bloque (${result.status || result.error})`,
      html_preview: result.html?.substring(0, 300),
    }), { headers: JSON_HEADERS });
  }

  // /api/senioriales/sync (POST)
  if (subPath === "sync" && request.method === "POST") {
    context.waitUntil(scrapeProgrammes(env));
    return new Response(JSON.stringify({
      ok: true,
      message: "Scraping lance en arriere-plan (~5 min). Verifiez /api/senioriales/status",
      check: "/api/senioriales/status",
    }), { headers: JSON_HEADERS });
  }

  // /api/senioriales/programmes
  if (subPath === "programmes") {
    const cached = await env.STRATEGE_DB.get("senioriales:index");
    if (cached) {
      return new Response(cached, { headers: JSON_HEADERS });
    }
    return new Response(JSON.stringify({
      ok: false,
      message: "Aucune donnee. POST /api/senioriales/sync pour lancer le scraping.",
      status: "empty",
    }), { status: 404, headers: JSON_HEADERS });
  }

  // /api/senioriales/programme/<id>
  if (pathParts[0] === "programme" && pathParts[1]) {
    const progId = pathParts.slice(1).join("/");
    const cached = await env.STRATEGE_DB.get(`senioriales:prog:${progId}`);
    if (cached) {
      return new Response(cached, { headers: JSON_HEADERS });
    }
    return new Response(JSON.stringify({ error: "Programme non trouve" }), {
      status: 404, headers: JSON_HEADERS
    });
  }

  // /api/senioriales/status
  if (subPath === "status") {
    const cached = await env.STRATEGE_DB.get("senioriales:index");
    const inProgress = await env.STRATEGE_DB.get("senioriales:scraping_in_progress");

    if (cached) {
      const data = JSON.parse(cached);
      return new Response(JSON.stringify({
        has_data: true,
        total_programmes: data.total_programmes,
        total_lots: data.total_lots,
        scraped_at: data.scraped_at,
        next_refresh: data.next_refresh,
        syncing: !!inProgress,
      }), { headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({
      has_data: false,
      syncing: !!inProgress,
      message: inProgress ? "Scraping en cours..." : "Aucune donnee - POST /api/senioriales/sync pour lancer",
    }), { headers: JSON_HEADERS });
  }

  return new Response(JSON.stringify({
    error: "Not found",
    routes: [
      "GET  /api/senioriales/test",
      "POST /api/senioriales/sync",
      "GET  /api/senioriales/status",
      "GET  /api/senioriales/programmes",
      "GET  /api/senioriales/programme/:id",
    ]
  }), { status: 404, headers: JSON_HEADERS });
}