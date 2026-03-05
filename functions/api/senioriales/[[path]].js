// ============================================================
// SENIORIALES SCRAPER INCREMENTAL — Cloudflare Workers
// Chaque requete fait UNE SEULE chose (<5s CPU)
// L'orchestration se fait cote client (curl/bash)
// ============================================================

const BASE = "https://www.senioriales.com";
const CACHE_TTL = 21600;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
};

async function fetchHtml(url) {
  try {
    const r = await fetch(url, { headers: HEADERS, redirect: "follow" });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, html: await r.text() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function stripHtml(s) {
  return (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Parse les search-card depuis les pages liste acheter/investir
function extractProgrammeUrls(html) {
  const urls = new Set();
  // Liens vers des residences individuelles: /acheter/{region}/senioriales-xxx ou /investir/{region}/senioriales-xxx
  const re = /href="(\/(acheter|investir)\/[^/]+\/senioriales[^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!m[1].includes("#") && !m[1].includes("?")) {
      urls.add(BASE + m[1]);
    }
  }
  return [...urls];
}

// Parse UNE search-card depuis la page liste
function parseSearchCards(html) {
  const programmes = [];
  // Regex pour chaque search-card
  const cardRegex = /<div class="search-card">([\s\S]*?)<a[^>]*class="cta"[^>]*>[^<]*<\/a>\s*<\/div>/gi;
  let cardMatch;
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const bloc = cardMatch[1];
    const prog = parseOneCard(bloc);
    if (prog) programmes.push(prog);
  }
  return programmes;
}

function parseOneCard(bloc) {
  const titleMatch = bloc.match(/<h3><a href="([^"]+)">([^<]+)<\/a><\/h3>/);
  if (!titleMatch) return null;

  const url_path = titleMatch[1];
  const titre = titleMatch[2].trim();

  const subtitleMatch = bloc.match(/<p><strong>\s*([\s\S]*?)\s*<\/strong><\/p>/);
  const localisation = subtitleMatch ? stripHtml(subtitleMatch[1]) : "";

  const deptMatch = bloc.match(/<div class="region" title="([^"]+)">/);
  const departement = deptMatch ? deptMatch[1] : "";

  const cpMatch = bloc.match(/<span class="postal-code">([^<]+)<\/span>/);
  const code_postal = cpMatch ? cpMatch[1].trim() : "";

  const typesMatch = bloc.match(/<li class="types">([^<]+)<\/li>/);
  const types = typesMatch ? typesMatch[1].trim() : "";

  const deliveryMatch = bloc.match(/<li class="delivery">[\s\S]*?<strong>([^<]+)<\/strong>/);
  const livraison = deliveryMatch ? deliveryMatch[1].trim() : "";

  const prixMatch = bloc.match(/<li class="price">[^<]*?(\d[\d\s]*)\s*\u20ac/);
  const prix = prixMatch ? parseInt(prixMatch[1].replace(/\s/g, "")) : null;

  const imgMatch = bloc.match(/<img src="([^"]+)"/);
  const image = imgMatch ? imgMatch[1] : "";

  const descMatch = bloc.match(/<\/figure>\s*<p>\s*([\s\S]*?)\s*<\/p>/);
  const description = descMatch ? stripHtml(descMatch[1]) : "";

  const isInvest = url_path.startsWith("/investir");
  const villeFromTitle = titre.match(/Senioriales (?:de |du |d'|des )(.+)/i);
  const ville = villeFromTitle ? villeFromTitle[1].trim() : localisation.split(",")[0] || "";

  const regionMatch = url_path.match(/\/(acheter|investir)\/([^/]+)\//);
  const region = regionMatch ? regionMatch[2].replace(/-/g, " ") : "";

  return {
    id: "SEN-" + url_path.split("/").pop().replace(/[^a-z0-9]/gi, "-"),
    source: "senioriales",
    titre, ville, localisation, departement, code_postal, region,
    types, livraison, prix_min: prix, description,
    url_detail: BASE + url_path,
    image: image.startsWith("http") ? image : (image ? BASE + image : ""),
    dispositif: isInvest ? "investissement-senior" : "residence-senior",
    promoteur: "Senioriales",
    badge: "Partenaire",
    type: "residence senior",
    categorie: isInvest ? "investir" : "acheter",
    scraped_at: new Date().toISOString(),
  };
}

// Parse page detail d'un programme
function parseProgrammeDetail(html, url) {
  const meta = {};
  const metaRe = /<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
  let mm;
  while ((mm = metaRe.exec(html)) !== null) meta[mm[1]] = mm[2];

  // JSON-LD
  const ldMatch = html.match(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/i);
  let ld = {};
  if (ldMatch) {
    try { ld = JSON.parse(ldMatch[1]); } catch (e) {}
  }

  const titre = meta["og:title"] || ld.name || (html.match(/<h1[^>]*>([^<]+)<\/h1>/) || [])[1]?.trim() || "";
  const description = meta["og:description"] || ld.description || "";
  const image = meta["og:image"] || ld.image || "";

  return {
    titre, description, image,
    ville: ld.address?.addressLocality || "",
    code_postal: ld.address?.postalCode || "",
    adresse: ld.address?.streetAddress || "",
    lat: ld.geo?.latitude || 0,
    lng: ld.geo?.longitude || 0,
  };
}

const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

export async function onRequest({ request, env, params }) {
  const subPath = (params?.path || []).join("/");

  // -- Test connectivite --
  if (subPath === "test") {
    const r = await fetchHtml(BASE);
    return Response.json({
      accessible: r.ok,
      status: r.status,
      message: r.ok ? "Senioriales accessible" : `Bloque (${r.status || r.error})`,
      preview: r.html?.slice(0, 150),
    }, { headers: H });
  }

  // -- Clear lock --
  if (subPath === "clear-lock") {
    await env.STRATEGE_DB.delete("senioriales:syncing");
    await env.STRATEGE_DB.delete("senioriales:queue");
    await env.STRATEGE_DB.delete("senioriales:cursor");
    await env.STRATEGE_DB.delete("senioriales:scraping_in_progress");
    return Response.json({ ok: true, message: "Lock supprime" }, { headers: H });
  }

  // -- STEP 1: Init — scrape les pages liste, extrait les URLs --
  if (subPath === "init" && request.method === "POST") {
    let allProgrammes = [];
    let allUrls = new Set();

    const listPages = [
      BASE + "/acheter/recherche-residence",
      BASE + "/investir/recherche-programme",
    ];

    for (const listUrl of listPages) {
      const r = await fetchHtml(listUrl);
      if (!r.ok) continue;

      // Extraire les cartes pour les metadonnees
      const cards = parseSearchCards(r.html);
      allProgrammes.push(...cards);

      // Extraire les URLs
      const urls = extractProgrammeUrls(r.html);
      urls.forEach(u => allUrls.add(u));

      // Pagination — chercher ?page=N
      const pageMatches = r.html.match(/href="\?page=(\d+)"/g) || [];
      const pageNums = [...new Set(pageMatches.map(m => parseInt(m.match(/page=(\d+)/)[1])))].filter(n => n > 0);

      for (const pn of pageNums.slice(0, 3)) {
        const pr = await fetchHtml(listUrl + "?page=" + pn);
        if (!pr.ok) break;
        const moreCards = parseSearchCards(pr.html);
        allProgrammes.push(...moreCards);
        const moreUrls = extractProgrammeUrls(pr.html);
        moreUrls.forEach(u => allUrls.add(u));
      }
    }

    // Dedupliquer les programmes par id
    const seen = new Set();
    allProgrammes = allProgrammes.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    // Stocker chaque programme depuis les cartes (donnees de base)
    for (const prog of allProgrammes) {
      await env.STRATEGE_DB.put(
        `senioriales:prog:${prog.id}`,
        JSON.stringify(prog),
        { expirationTtl: CACHE_TTL }
      );
    }

    // Queue = URLs uniques pour les details
    const queue = [...allUrls];
    await env.STRATEGE_DB.put("senioriales:queue", JSON.stringify(queue), { expirationTtl: 3600 });
    await env.STRATEGE_DB.put("senioriales:cursor", "0", { expirationTtl: 3600 });
    await env.STRATEGE_DB.put("senioriales:syncing", "1", { expirationTtl: 3600 });

    return Response.json({
      ok: true,
      programmes_from_list: allProgrammes.length,
      urls_to_detail: queue.length,
      programmes: allProgrammes.map(p => ({ titre: p.titre, ville: p.ville, prix: p.prix_min })),
      next: "POST /api/senioriales/next",
    }, { headers: H });
  }

  // -- STEP 2: Next — scrape UN detail --
  if (subPath === "next" && request.method === "POST") {
    const queueRaw = await env.STRATEGE_DB.get("senioriales:queue");
    const cursorRaw = await env.STRATEGE_DB.get("senioriales:cursor");

    if (!queueRaw) {
      return Response.json({ ok: false, error: "Queue vide - POST /api/senioriales/init d'abord" }, { headers: H });
    }

    const queue = JSON.parse(queueRaw);
    const cursor = parseInt(cursorRaw || "0");
    const total = queue.length;

    if (cursor >= total) {
      // Construire l'index final
      const programmes = [];
      for (const url of queue) {
        const id = "SEN-" + url.split("/").pop().replace(/[^a-z0-9]/gi, "-");
        const cached = await env.STRATEGE_DB.get(`senioriales:prog:${id}`);
        if (cached) programmes.push(JSON.parse(cached));
      }

      const index = {
        programmes,
        total_programmes: programmes.length,
        scraped_at: new Date().toISOString(),
        next_refresh: new Date(Date.now() + CACHE_TTL * 1000).toISOString(),
      };

      await env.STRATEGE_DB.put("senioriales:index", JSON.stringify(index), { expirationTtl: CACHE_TTL });
      await env.STRATEGE_DB.delete("senioriales:syncing");
      await env.STRATEGE_DB.delete("senioriales:queue");
      await env.STRATEGE_DB.delete("senioriales:cursor");

      return Response.json({
        ok: true, finished: true,
        done: total, total,
        message: `Sync terminee - ${programmes.length} programmes`,
      }, { headers: H });
    }

    // Scraper l'URL courante
    const url = queue[cursor];
    const id = "SEN-" + url.split("/").pop().replace(/[^a-z0-9]/gi, "-");
    const r = await fetchHtml(url);
    let enriched = null;

    if (r.ok) {
      const detail = parseProgrammeDetail(r.html, url);
      // Enrichir le programme existant
      const existingRaw = await env.STRATEGE_DB.get(`senioriales:prog:${id}`);
      let prog = existingRaw ? JSON.parse(existingRaw) : {
        id, source: "senioriales", url_detail: url,
        dispositif: "residence-senior", promoteur: "Senioriales", badge: "Partenaire",
      };

      if (detail.titre) prog.titre = detail.titre;
      if (detail.description) prog.description = detail.description;
      if (detail.image) prog.image = detail.image;
      if (detail.ville) prog.ville = detail.ville;
      if (detail.code_postal) prog.code_postal = detail.code_postal;
      if (detail.adresse) prog.adresse = detail.adresse;
      if (detail.lat) prog.lat = detail.lat;
      if (detail.lng) prog.lng = detail.lng;
      prog.detail_scraped = true;
      prog.scraped_at = new Date().toISOString();

      await env.STRATEGE_DB.put(`senioriales:prog:${id}`, JSON.stringify(prog), { expirationTtl: CACHE_TTL });
      enriched = { titre: prog.titre, ville: prog.ville };
    }

    await env.STRATEGE_DB.put("senioriales:cursor", String(cursor + 1), { expirationTtl: 3600 });

    return Response.json({
      ok: true, finished: false,
      done: cursor + 1, total,
      programme: enriched,
      skipped: !enriched,
      url,
    }, { headers: H });
  }

  // -- Status --
  if (subPath === "status") {
    const syncing = await env.STRATEGE_DB.get("senioriales:syncing");
    const cursor = await env.STRATEGE_DB.get("senioriales:cursor");
    const queueRaw = await env.STRATEGE_DB.get("senioriales:queue");
    const indexRaw = await env.STRATEGE_DB.get("senioriales:index");

    if (indexRaw) {
      const data = JSON.parse(indexRaw);
      return Response.json({
        has_data: true,
        total_programmes: data.total_programmes,
        scraped_at: data.scraped_at,
        next_refresh: data.next_refresh,
      }, { headers: H });
    }

    return Response.json({
      has_data: false,
      syncing: !!syncing,
      done: parseInt(cursor || "0"),
      total: queueRaw ? JSON.parse(queueRaw).length : 0,
    }, { headers: H });
  }

  // -- Programmes (lecture cache) --
  if (subPath === "programmes") {
    const cached = await env.STRATEGE_DB.get("senioriales:index");
    if (!cached) {
      return Response.json({ ok: false, message: "POST /api/senioriales/init puis /next" }, { status: 404, headers: H });
    }
    return new Response(cached, { headers: H });
  }

  // -- Programme detail --
  if (subPath.startsWith("programme/")) {
    const progId = subPath.replace("programme/", "");
    const cached = await env.STRATEGE_DB.get(`senioriales:prog:${progId}`);
    if (cached) return new Response(cached, { headers: H });
    return Response.json({ error: "Programme non trouve" }, { status: 404, headers: H });
  }

  // -- Enrich Photos (incremental, 1 programme par requete) --
  if (subPath === "enrich-photos" && request.method === "POST") {
    const indexRaw = await env.STRATEGE_DB.get("senioriales:index");
    if (!indexRaw) {
      return Response.json({ ok: false, error: "Pas d'index — POST /api/senioriales/init puis /next d'abord" }, { status: 404, headers: H });
    }

    const index = JSON.parse(indexRaw);
    const programmes = index.programmes || [];

    // Trouver le premier programme sans images
    let target = null;
    for (const prog of programmes) {
      if (!prog.images || !prog.images.length) {
        target = prog;
        break;
      }
    }

    if (!target) {
      return Response.json({ ok: true, done: true, message: "Tous les programmes ont des images" }, { headers: H });
    }

    // Fetcher la page detail
    const url = target.url_detail;
    if (!url) {
      // Marquer comme traite avec tableau vide pour ne pas boucler
      target.images = [];
      await env.STRATEGE_DB.put(`senioriales:prog:${target.id}`, JSON.stringify(target), { expirationTtl: CACHE_TTL });
      // Mettre a jour l'index
      const updatedIndex = { ...index, programmes: programmes.map(p => p.id === target.id ? target : p) };
      await env.STRATEGE_DB.put("senioriales:index", JSON.stringify(updatedIndex), { expirationTtl: CACHE_TTL });
      return Response.json({ ok: true, done: false, skipped: true, id: target.id, reason: "Pas d'URL detail" }, { headers: H });
    }

    const r = await fetchHtml(url);
    if (!r.ok) {
      target.images = [];
      await env.STRATEGE_DB.put(`senioriales:prog:${target.id}`, JSON.stringify(target), { expirationTtl: CACHE_TTL });
      const updatedIndex = { ...index, programmes: programmes.map(p => p.id === target.id ? target : p) };
      await env.STRATEGE_DB.put("senioriales:index", JSON.stringify(updatedIndex), { expirationTtl: CACHE_TTL });
      return Response.json({ ok: true, done: false, skipped: true, id: target.id, reason: "Fetch echoue: " + (r.status || r.error) }, { headers: H });
    }

    const html = r.html;
    const images = new Set();

    // 1. og:image
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogMatch) images.add(ogMatch[1]);

    // 2. JSON-LD image fields
    const ldMatches = html.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
    for (const ldm of ldMatches) {
      try {
        const ld = JSON.parse(ldm[1]);
        if (typeof ld.image === "string") images.add(ld.image);
        if (Array.isArray(ld.image)) ld.image.forEach(i => { if (typeof i === "string") images.add(i); });
        if (ld.photo) {
          const photos = Array.isArray(ld.photo) ? ld.photo : [ld.photo];
          photos.forEach(p => { if (typeof p === "string") images.add(p); else if (p?.contentUrl) images.add(p.contentUrl); else if (p?.url) images.add(p.url); });
        }
      } catch (e) {}
    }

    // 3. data-src, data-lazy (lazy-loaded images)
    const dataSrcRe = /(?:data-src|data-lazy)\s*=\s*["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
    let dsm;
    while ((dsm = dataSrcRe.exec(html)) !== null) images.add(dsm[1]);

    // 4. srcset first URL
    const srcsetRe = /srcset\s*=\s*["']([^"']+)["']/gi;
    let ssm;
    while ((ssm = srcsetRe.exec(html)) !== null) {
      const firstUrl = ssm[1].split(",")[0].trim().split(/\s+/)[0];
      if (firstUrl && /\.(jpg|jpeg|png|webp)/i.test(firstUrl)) images.add(firstUrl);
    }

    // 5. Regular img src
    const imgSrcRe = /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
    let ism;
    while ((ism = imgSrcRe.exec(html)) !== null) images.add(ism[1]);

    // Filter out logos, icons, favicons, tiny images
    const EXCLUDE = /logo|icon|favicon|sprite|pixel|tracking|badge|btn|button|arrow|loader|spinner/i;
    let filtered = [...images]
      .filter(u => !EXCLUDE.test(u))
      .map(u => {
        if (u.startsWith("//")) return "https:" + u;
        if (u.startsWith("/")) return BASE + u;
        return u;
      })
      .filter(u => u.startsWith("http"));

    // Dedup
    filtered = [...new Set(filtered)];

    // Max 8
    filtered = filtered.slice(0, 8);

    // Mettre a jour le programme
    target.images = filtered;
    if (filtered.length > 0 && !target.image) {
      target.image = filtered[0];
    }

    await env.STRATEGE_DB.put(`senioriales:prog:${target.id}`, JSON.stringify(target), { expirationTtl: CACHE_TTL });

    // Mettre a jour l'index
    const updatedIndex = { ...index, programmes: programmes.map(p => p.id === target.id ? target : p) };
    await env.STRATEGE_DB.put("senioriales:index", JSON.stringify(updatedIndex), { expirationTtl: CACHE_TTL });

    // Compter combien restent sans images
    const remaining = programmes.filter(p => p.id !== target.id && (!p.images || !p.images.length)).length;

    return Response.json({
      ok: true,
      done: false,
      id: target.id,
      titre: target.titre,
      images_found: filtered.length,
      remaining,
      images: filtered,
    }, { headers: H });
  }

  return Response.json({
    routes: [
      "GET  /test", "POST /clear-lock", "POST /init",
      "POST /next", "GET  /status", "GET  /programmes",
      "POST /enrich-photos",
    ]
  }, { status: 404, headers: H });
}