// ============================================================
// SENIORIALES SCRAPER — Cloudflare Workers
// Recupere les programmes et lots via le site public
// Anti-ban : delais humains, headers realistes, cache KV 6h
// Route: /api/senioriales/*
// ============================================================

const SENIORIALES_BASE = "https://www.les-senioriales.com";
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

function extractBetween(html, start, end) {
  const idx = html.indexOf(start);
  if (idx === -1) return null;
  const from = idx + start.length;
  const to = html.indexOf(end, from);
  if (to === -1) return null;
  return html.slice(from, to).trim()
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseProgrammesList(html) {
  const programmes = [];

  const cardPatterns = [
    /class="[^"]*(?:residence|programme|bien|property)[^"]*"[^>]*>([\s\S]{100,2000}?)<\/(?:div|article|section)/gi,
    /class="[^"]*(?:card|listing|item)[^"]*"[^>]*>([\s\S]{100,1500}?)<\/(?:div|article)/gi,
  ];

  for (const pattern of cardPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const prog = parseOneProgramme(match[1]);
      if (prog && prog.titre) programmes.push(prog);
    }
    if (programmes.length > 0) break;
  }

  const dataPattern = /data-(?:programme|residence|property)=['"]({[^'"]+})['"]/gi;
  let match;
  while ((match = dataPattern.exec(html)) !== null) {
    try {
      programmes.push(mapRawToProgramme(JSON.parse(match[1].replace(/&quot;/g, '"'))));
    } catch (e) {}
  }

  const seen = new Set();
  return programmes.filter(p => {
    if (!p.titre || seen.has(p.titre)) return false;
    seen.add(p.titre);
    return true;
  });
}

function parseOneProgramme(bloc) {
  let titre = null;
  for (const tag of ["h1", "h2", "h3", "h4"]) {
    const t = extractBetween(bloc, `<${tag}`, `</${tag}>`);
    if (t && t.length > 3 && t.length < 100) { titre = t.replace(/^[^>]+>/, ''); break; }
  }

  const prixMatch = bloc.match(/(\d[\d\s]*)\s*\u20ac/) || bloc.match(/price.*?(\d[\d\s]+)/i);
  const prix = prixMatch ? parseInt(prixMatch[1].replace(/\s/g, "")) : null;

  const villeMatch = bloc.match(/(?:a|Ville|Commune|Location)[:\s]*([A-Z\u00c0-\u00dc][a-z\u00e0-\u00fc\s-]{2,30})/);
  const ville = villeMatch ? villeMatch[1].trim() : null;

  const surfMatch = bloc.match(/(\d+(?:[.,]\d+)?)\s*m\u00b2/);
  const surface = surfMatch ? parseFloat(surfMatch[1].replace(",", ".")) : null;

  const linkMatch = bloc.match(/href="([^"]+(?:residence|programme|bien|lot)[^"]+)"/i);
  const url = linkMatch ? linkMatch[1] : null;

  const imgMatch = bloc.match(/src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
  const image = imgMatch ? imgMatch[1] : null;

  if (!titre && !prix && !ville) return null;

  return {
    id: `SEN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    source: "senioriales",
    titre: titre || "Residence Senioriales",
    ville: ville || "",
    prix_min: prix, prix_max: prix, surface,
    url_detail: url ? (url.startsWith("http") ? url : SENIORIALES_BASE + url) : null,
    image: image ? (image.startsWith("http") ? image : SENIORIALES_BASE + image) : null,
    dispositif: "residence-senior",
    promoteur: "Senioriales",
    badge: "Partenaire",
    type: "residence senior",
  };
}

function mapRawToProgramme(raw) {
  return {
    id: `SEN-${raw.id || raw.programme_id || Date.now()}`,
    source: "senioriales",
    titre: raw.nom || raw.name || raw.titre || raw.title || "",
    ville: raw.ville || raw.city || raw.commune || "",
    code_postal: raw.cp || raw.code_postal || raw.zip || "",
    departement: raw.departement || raw.dept || "",
    prix_min: parseInt(raw.prix_min || raw.price_min || raw.prix || 0),
    prix_max: parseInt(raw.prix_max || raw.price_max || raw.prix || 0),
    surface: parseFloat(raw.surface || raw.superficie || 0),
    lots_disponibles: parseInt(raw.nb_lots || raw.lots_count || 0),
    dispositif: "residence-senior",
    promoteur: "Senioriales",
    image: raw.photo || raw.image || raw.img || "",
    url_detail: raw.url || raw.lien || "",
    badge: "Partenaire",
    type: "residence senior",
  };
}

function parseProgrammeDetail(html, programmeId) {
  const lots = [];

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

  const tableMatch = html.match(/<table[^>]*class="[^"]*lot[^"]*"[^>]*>([\s\S]*?)<\/table>/i) ||
                     html.match(/<(?:div|ul)[^>]*class="[^"]*(?:lot|listing|disponib)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|ul)>/i);

  if (tableMatch) {
    const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    for (const row of rows.slice(1)) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      const texts = cells.map(c => c.replace(/<[^>]+>/g, "").trim());
      if (texts.length >= 2) {
        lots.push({
          id: `SEN-LOT-${programmeId}-${lots.length + 1}`,
          programme_id: programmeId,
          source: "senioriales",
          reference: texts[0] || `Lot ${lots.length + 1}`,
          type: texts[1] || "",
          surface: parseFloat((texts.find(t => t.match(/\d+\s*m\u00b2/)) || "").replace(/[^\d.]/g, "")) || 0,
          prix: parseInt((texts.find(t => t.match(/\d[\d\s]*\s*\u20ac/)) || "").replace(/[^\d]/g, "")) || 0,
          disponible: !row.toLowerCase().includes("vendu") && !row.toLowerCase().includes("reserve"),
        });
      }
    }
  }

  return lots;
}

async function scrapeProgrammes(env) {
  const log = [];
  const startTime = Date.now();
  const SCRAP_KEY = "senioriales:scraping_in_progress";

  const inProgress = await env.STRATEGE_DB.get(SCRAP_KEY);
  if (inProgress) {
    return { ok: false, error: "Scraping deja en cours", log };
  }
  await env.STRATEGE_DB.put(SCRAP_KEY, "1", { expirationTtl: 300 });

  try {
    log.push(`[${new Date().toISOString()}] Debut scraping Senioriales`);

    await humanDelay();
    const home = await fetchPage(SENIORIALES_BASE);
    if (!home.ok) {
      await env.STRATEGE_DB.delete(SCRAP_KEY);
      return { ok: false, error: `Page d'accueil bloquee (${home.status})`, log };
    }
    log.push(`OK Page d'accueil`);

    const listUrls = [
      `${SENIORIALES_BASE}/nos-residences`,
      `${SENIORIALES_BASE}/residences`,
      `${SENIORIALES_BASE}/programme-immobilier`,
      `${SENIORIALES_BASE}/residence-senior`,
    ];

    let listHtml = null;
    let listUrl = null;

    for (const url of listUrls) {
      await humanDelay();
      log.push(`Tentative: ${url}`);
      const result = await fetchPage(url, SENIORIALES_BASE + "/");
      if (result.ok) {
        listHtml = result.html;
        listUrl = url;
        log.push(`OK Liste trouvee: ${url}`);
        break;
      }
      log.push(`  -> ${result.status || result.error}`);
    }

    if (!listHtml) {
      await env.STRATEGE_DB.delete(SCRAP_KEY);
      return { ok: false, error: "Aucune page liste accessible", log };
    }

    const jsonLd = extractJsonLd(listHtml);
    let programmes = parseProgrammesList(listHtml);

    for (const ld of jsonLd) {
      if (ld["@type"] === "ItemList" && ld.itemListElement) {
        const items = Array.isArray(ld.itemListElement) ? ld.itemListElement : [ld.itemListElement];
        for (const item of items) {
          programmes.push(mapRawToProgramme(item.item || item));
        }
      }
    }

    log.push(`-> ${programmes.length} programmes parses`);

    // Pagination
    const pageLinks = [];
    const pageRegex = /href="([^"]+(?:page|p)=(\d+)[^"]*)"/gi;
    let pageMatch;
    while ((pageMatch = pageRegex.exec(listHtml)) !== null) {
      const pageNum = parseInt(pageMatch[2]);
      if (pageNum > 1 && pageNum <= 10) {
        pageLinks.push({ url: pageMatch[1].startsWith("http") ? pageMatch[1] : SENIORIALES_BASE + pageMatch[1], page: pageNum });
      }
    }

    const uniquePages = [...new Map(pageLinks.map(p => [p.page, p])).values()]
      .sort((a, b) => a.page - b.page)
      .slice(0, 5);

    for (const { url, page } of uniquePages) {
      await humanDelay();
      log.push(`Pagination page ${page}: ${url}`);
      const result = await fetchPage(url, listUrl);
      if (!result.ok) { log.push(`  -> Bloque (${result.status})`); break; }
      const moreProg = parseProgrammesList(result.html);
      programmes.push(...moreProg);
      log.push(`  -> +${moreProg.length} programmes`);
    }

    const seen = new Set();
    programmes = programmes.filter(p => {
      const key = p.titre + p.ville;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    log.push(`-> ${programmes.length} programmes uniques`);

    let totalLots = 0;
    const programmesComplets = [];

    for (let i = 0; i < programmes.length; i++) {
      const prog = programmes[i];

      if (prog.url_detail) {
        await humanDelay();
        log.push(`Programme ${i + 1}/${programmes.length}: ${prog.titre}`);

        const detail = await fetchPage(prog.url_detail, listUrl);
        if (detail.ok) {
          const lots = parseProgrammeDetail(detail.html, prog.id);
          const meta = extractMeta(detail.html);
          const detailLd = extractJsonLd(detail.html);

          if (meta["og:title"]) prog.titre = meta["og:title"];
          if (meta["og:description"]) prog.description = meta["og:description"];
          if (meta["og:image"]) prog.image = meta["og:image"];

          for (const ld of detailLd) {
            if (ld["@type"] === "RealEstateListing" || ld["@type"] === "Apartment" || ld["@type"] === "Product") {
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
          }

          prog.lots = lots;
          prog.lots_disponibles = lots.filter(l => l.disponible).length;
          totalLots += prog.lots_disponibles;
          log.push(`  OK ${prog.lots_disponibles} lots disponibles`);

          await env.STRATEGE_DB.put(
            `senioriales:prog:${prog.id}`,
            JSON.stringify({ ...prog, scraped_at: new Date().toISOString() }),
            { expirationTtl: CACHE_TTL }
          );
        } else {
          log.push(`  WARN Detail inaccessible (${detail.error})`);
          prog.lots = [];
          prog.lots_disponibles = 0;
        }
      } else {
        prog.lots = [];
        prog.lots_disponibles = 0;
      }

      programmesComplets.push(prog);

      if ((i + 1) % 5 === 0) {
        log.push(`  Pause 8s (anti-ban)...`);
        await sleep(8000);
      }
    }

    const index = {
      programmes: programmesComplets,
      total_programmes: programmesComplets.length,
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

    log.push(`DONE Sync terminee en ${index.duration_ms}ms`);
    log.push(`DONE ${index.total_programmes} programmes, ${index.total_lots} lots disponibles`);

    await env.STRATEGE_DB.delete(SCRAP_KEY);
    return { ok: true, ...index, log };

  } catch (err) {
    await env.STRATEGE_DB.delete(SCRAP_KEY);
    return { ok: false, error: err.message, log };
  }
}

// --- ROUTEUR ---
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
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
      html_preview: result.html?.substring(0, 200),
    }), { headers: JSON_HEADERS });
  }

  // /api/senioriales/sync (POST)
  if (subPath === "sync" && request.method === "POST") {
    context.waitUntil(scrapeProgrammes(env));
    return new Response(JSON.stringify({
      ok: true,
      message: "Scraping lance en arriere-plan. Resultats disponibles dans ~5 minutes sur /api/senioriales/programmes",
      check: "/api/senioriales/programmes",
    }), { headers: JSON_HEADERS });
  }

  // /api/senioriales/programmes
  if (subPath === "programmes") {
    const cached = await env.STRATEGE_DB.get("senioriales:index");
    if (cached) {
      return new Response(cached, { headers: JSON_HEADERS });
    }
    context.waitUntil(scrapeProgrammes(env));
    return new Response(JSON.stringify({
      ok: false,
      message: "Donnees en cours de recuperation. Reessayez dans 5 minutes.",
      status: "syncing",
    }), { status: 202, headers: JSON_HEADERS });
  }

  // /api/senioriales/programme/<id>
  if (pathParts[0] === "programme" && pathParts[1]) {
    const progId = pathParts[1];
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

  return new Response(JSON.stringify({ error: "Not found", routes: ["test", "sync", "programmes", "programme/:id", "status"] }), {
    status: 404, headers: JSON_HEADERS
  });
}