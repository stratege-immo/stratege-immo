import puppeteer from 'puppeteer';
import fs from 'fs';

const BASE = 'https://stratege-immo.fr';
const DIR = '/tmp/stratege-recette';
const issues = [];

function log(msg) { process.stdout.write(msg + '\n'); }

function addIssue(severity, page, type, desc, fix) {
  issues.push({ severity, page, type, desc, fix });
  const icon = severity === 'CRITIQUE' ? '🔴' : severity === 'IMPORTANT' ? '🟠' : '🟡';
  log(`  ${icon} [${type}] ${desc}`);
}

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
});

const page = await browser.newPage();

// Basic Auth pour passer le middleware (seulement pour notre domaine)
await page.setRequestInterception(true);
page.on('request', req => {
  const url = req.url();
  if (url.startsWith(BASE)) {
    req.continue({
      headers: { ...req.headers(), 'Authorization': 'Basic ' + Buffer.from('rajaa:rajaavitrine').toString('base64') }
    });
  } else {
    req.continue();
  }
});

const consoleErrors = {};
page.on('console', msg => {
  if (msg.type() === 'error') {
    const u = page.url();
    if (!consoleErrors[u]) consoleErrors[u] = [];
    consoleErrors[u].push(msg.text().slice(0,200));
  }
});
page.on('pageerror', err => {
  const u = page.url();
  if (!consoleErrors[u]) consoleErrors[u] = [];
  consoleErrors[u].push('JS ERROR: ' + err.message.slice(0,200));
});

async function shot(name, viewport, url) {
  try {
    await page.setViewport(viewport);
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));
    const file = `${DIR}/${name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    log(`  📸 ${name}.png`);
    return true;
  } catch(e) {
    log(`  ⚠️  Echec screenshot ${name}: ${e.message}`);
    return false;
  }
}

async function checkPage(url, label) {
  log(`\n━━ ${label} (${url}) ━━`);

  // Desktop screenshot
  await shot(`desktop-${label}`, { width: 1440, height: 900 }, url);

  // Tablet screenshot
  await shot(`tablet-${label}`, { width: 768, height: 1024 }, url);

  // Mobile screenshot
  await shot(`mobile-${label}`, { width: 390, height: 844, isMobile: true, hasTouch: true }, url);

  // Revenir desktop pour analyse
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  // Analyse UI
  const ui = await page.evaluate(() => {
    const r = { issues: [], infos: {} };
    const txt = document.body?.innerText || '';

    if (!document.querySelector('nav, header, .navbar, [class*="nav"]'))
      r.issues.push({ t: 'NAVBAR_MANQUANTE', d: 'Navbar introuvable sur la page' });

    if (!document.querySelector('footer, .footer, [class*="footer"]'))
      r.issues.push({ t: 'FOOTER_MANQUANT', d: 'Footer introuvable' });

    if (txt.toLowerCase().includes('lorem ipsum'))
      r.issues.push({ t: 'LOREM_IPSUM', d: 'Contenu placeholder Lorem Ipsum détecté' });

    const brokenImgs = Array.from(document.images)
      .filter(i => !i.complete || i.naturalWidth === 0);
    if (brokenImgs.length > 0)
      r.issues.push({ t: 'IMAGES_CASSEES', d: `${brokenImgs.length} image(s) cassée(s): ${brokenImgs.map(i=>i.src.split('/').pop()).slice(0,3).join(', ')}` });

    const docW = document.documentElement.scrollWidth;
    const winW = window.innerWidth;
    if (docW > winW + 10)
      r.issues.push({ t: 'DEBORDEMENT_HORIZONTAL', d: `Scroll horizontal: contenu ${docW}px > écran ${winW}px` });

    const deadLinks = Array.from(document.querySelectorAll('a[href="#"], a[href="javascript:void(0)"]'));
    if (deadLinks.length > 5)
      r.issues.push({ t: 'LIENS_MORTS', d: `${deadLinks.length} liens href="#" trouvés` });

    const emptyBtns = Array.from(document.querySelectorAll('button, .btn'))
      .filter(b => !b.textContent.trim() && !b.querySelector('svg,img,i'));
    if (emptyBtns.length > 0)
      r.issues.push({ t: 'BOUTONS_VIDES', d: `${emptyBtns.length} bouton(s) sans texte` });

    const h1 = document.querySelector('h1');
    const fontFamily = h1 ? window.getComputedStyle(h1).fontFamily : '';
    r.infos.font = fontFamily.split(',')[0].trim();
    if (h1 && !fontFamily.includes('Cormorant') && !fontFamily.includes('serif'))
      r.issues.push({ t: 'POLICE_INCORRECTE', d: `Police h1: "${r.infos.font}" (attendu: Cormorant Garamond)` });

    r.infos.h1 = h1?.textContent?.trim().slice(0, 60) || 'AUCUN H1';
    r.infos.title = document.title.slice(0, 60);
    r.infos.btns = document.querySelectorAll('button, .btn').length;
    r.infos.links = document.querySelectorAll('a[href]').length;
    r.infos.imgs = document.images.length;
    r.infos.forms = document.querySelectorAll('form').length;

    return r;
  });

  // Analyse Mobile
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));

  const mobile = await page.evaluate(() => {
    const docW = document.documentElement.scrollWidth;
    const winW = window.innerWidth;
    const hamburger = document.querySelector('[class*="hamburger"],[class*="menu-toggle"],[class*="mobile-menu"],#menu-toggle,.menu-btn');
    return {
      overflow: docW > winW + 10,
      docW, winW,
      hasHamburger: !!hamburger,
      readable: window.getComputedStyle(document.body).fontSize
    };
  });

  if (mobile.overflow)
    ui.issues.push({ t: 'MOBILE_OVERFLOW', d: `Mobile: débordement ${mobile.docW}px > ${mobile.winW}px` });
  if (!mobile.hasHamburger)
    ui.issues.push({ t: 'PAS_DE_HAMBURGER', d: 'Menu hamburger absent sur mobile' });

  // Logger infos + issues
  log(`  📄 Titre: "${ui.infos.title}"`);
  log(`  🏷  H1: "${ui.infos.h1}"`);
  log(`  🔤 Police: ${ui.infos.font}`);
  log(`  📊 ${ui.infos.btns} boutons | ${ui.infos.links} liens | ${ui.infos.imgs} images | ${ui.infos.forms} formulaires`);
  log(`  📱 Mobile: overflow=${mobile.overflow} | hamburger=${mobile.hasHamburger}`);

  if (ui.issues.length === 0) {
    log(`  ✅ Aucun problème détecté`);
  } else {
    ui.issues.forEach(i => addIssue(
      i.t.includes('MANQUANTE') || i.t.includes('CASSEE') || i.t.includes('LOREM') ? 'CRITIQUE' :
      i.t.includes('OVERFLOW') || i.t.includes('POLICE') ? 'IMPORTANT' : 'MINEUR',
      label, i.t, i.d,
      getFix(i.t)
    ));
  }

  // Erreurs console
  const errs = consoleErrors[BASE + url] || [];
  if (errs.length > 0) {
    log(`  ⚠️  ${errs.length} erreur(s) console JS`);
    errs.slice(0, 3).forEach(e => addIssue('IMPORTANT', label, 'ERREUR_JS', e, 'Corriger le JavaScript'));
  }
}

function getFix(type) {
  const F = {
    'NAVBAR_MANQUANTE': 'Vérifier que shared.js injecte bien la navbar sur cette page',
    'FOOTER_MANQUANT': 'Vérifier que shared.js injecte bien le footer sur cette page',
    'LOREM_IPSUM': 'Remplacer tout le contenu placeholder par du vrai contenu',
    'IMAGES_CASSEES': 'Corriger les URLs ou utiliser des placeholders SVG inline',
    'DEBORDEMENT_HORIZONTAL': 'Ajouter overflow-x:hidden sur body, corriger les éléments larges',
    'MOBILE_OVERFLOW': 'Corriger CSS responsive: max-width:100%, overflow-x:hidden',
    'PAS_DE_HAMBURGER': 'Ajouter menu hamburger dans la navbar pour mobile',
    'LIENS_MORTS': 'Remplacer href="#" par de vraies URLs ou supprimer',
    'BOUTONS_VIDES': 'Ajouter du texte ou aria-label sur les boutons',
    'POLICE_INCORRECTE': 'Vérifier le chargement Google Fonts Cormorant Garamond + DM Sans',
    'ERREUR_JS': 'Inspecter et corriger l\'erreur JavaScript signalée',
  };
  return F[type] || 'Inspecter et corriger';
}

// ═══════════════════════════════════
// LANCER LES TESTS SUR TOUTES LES PAGES
// ═══════════════════════════════════

const PAGES = [
  ['/', '01-accueil'],
  ['/login.html', '02-login'],
  ['/register.html', '03-register'],
  ['/dashboard.html', '04-dashboard'],
  ['/simulation.html', '05-simulation'],
  ['/calculateur.html', '06-calculateur'],
  ['/catalogue.html', '07-catalogue'],
  ['/scpi.html', '08-scpi'],
  ['/pret.html', '09-pret'],
  ['/rdv.html', '10-rdv'],
  ['/souscrire-scpi.html', '11-souscription-scpi'],
  ['/signer.html', '12-signature'],
  ['/verifier-signature.html', '13-verifier-doc'],
  ['/admin.html', '14-admin'],
  ['/comparer.html', '15-comparateur'],
  ['/blog.html', '16-blog'],
  ['/a-propos.html', '17-apropos'],
  ['/contact.html', '18-contact'],
  ['/mentions-legales.html', '19-mentions'],
];

log('🔍 RECETTE COMPLÈTE STRATÈGE');
log('═'.repeat(60));

for (const [url, name] of PAGES) {
  await checkPage(url, name);
}

// ═══════════════════════════════════
// TESTS FONCTIONNELS
// ═══════════════════════════════════

log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('TESTS FONCTIONNELS');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Simulateur
await page.setViewport({width:1440,height:900});
await page.goto(BASE+'/simulation.html',{waitUntil:'networkidle2',timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,3000));
const sim = await page.evaluate(()=>({
  sliders: document.querySelectorAll('input[type=range]').length,
  results: document.querySelectorAll('[class*="result"],[class*="economie"],[class*="calcul"],[id*="result"]').length,
  tabs: document.querySelectorAll('[class*="tab"],[role="tab"]').length,
}));
log(`\n📊 Simulateur: ${sim.sliders} sliders | ${sim.results} zones résultats | ${sim.tabs} onglets`);
if (sim.sliders === 0) addIssue('CRITIQUE','05-simulation','PAS_DE_SLIDER','Aucun slider dans le simulateur','Vérifier simulation.html - inputs type range');
if (sim.results === 0) addIssue('CRITIQUE','05-simulation','PAS_DE_RESULTAT','Zone de résultat de simulation introuvable','Ajouter div résultat avec id/class reconnaissable');

// Catalogue - chargement API
await page.goto(BASE+'/catalogue.html',{waitUntil:'networkidle2',timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,5000)); // laisser le temps à l'API
const cat = await page.evaluate(()=>({
  cards: document.querySelectorAll('[class*="card"],[class*="bien"],[class*="programme"],[class*="property"]').length,
  filters: document.querySelectorAll('select,[class*="filter"]').length,
  loading: !!document.querySelector('[class*="loading"],[class*="skeleton"],[class*="spinner"]'),
}));
log(`📦 Catalogue: ${cat.cards} cards | ${cat.filters} filtres | loading=${cat.loading}`);
if (cat.cards < 5) addIssue('CRITIQUE','07-catalogue',`CATALOGUE_VIDE`,`Seulement ${cat.cards} cards (attendu 10+) — API Senioriales ne charge pas?`,'Vérifier /api/senioriales/programmes + fallback si vide');

// Chatbot
await page.goto(BASE+'/',{waitUntil:'networkidle2',timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,3000));
const chat = await page.evaluate(()=>({
  widget: !!document.querySelector('[class*="chat"],[class*="bot"],#chatbot,[id*="chat"]'),
  btn: !!document.querySelector('[class*="chat-btn"],[class*="chat-toggle"]'),
}));
log(`💬 Chatbot: widget=${chat.widget} | bouton=${chat.btn}`);
if (!chat.widget) addIssue('IMPORTANT','01-accueil','PAS_DE_CHATBOT','Widget chatbot absent de la homepage','Vérifier shared.js injection chatbot widget');

// RDV
await page.goto(BASE+'/rdv.html',{waitUntil:'networkidle2',timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,3000));
const rdv = await page.evaluate(()=>({
  calendar: !!document.querySelector('[class*="calendar"],[class*="creneaux"],[class*="slot"],[class*="date"]'),
  form: !!document.querySelector('form,[class*="form"]'),
  timeSlots: document.querySelectorAll('[class*="slot"],[class*="creneau"]').length,
}));
log(`📅 RDV: calendar=${rdv.calendar} | form=${rdv.form} | ${rdv.timeSlots} créneaux`);
if (!rdv.calendar) addIssue('CRITIQUE','10-rdv','CALENDRIER_ABSENT','Calendrier RDV absent','Vérifier rdv.html + /api/rdv/creneaux');

// Signature canvas
await page.goto(BASE+'/signer.html',{waitUntil:'networkidle2',timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
const sig = await page.evaluate(()=>({
  canvas: !!document.querySelector('#signature-canvas,canvas'),
  signBtn: !!document.querySelector('#sign-btn,[class*="sign-btn"]'),
  pdfViewer: !!document.querySelector('#pdf-canvas,[class*="pdf"]'),
}));
log(`✍  Signature: canvas=${sig.canvas} | bouton=${sig.signBtn} | pdfViewer=${sig.pdfViewer}`);
if (!sig.canvas) addIssue('CRITIQUE','12-signature','PAS_DE_CANVAS','Canvas signature absent','Vérifier signer.html #signature-canvas');

// Admin
await page.goto(BASE+'/admin.html',{waitUntil:'networkidle2',timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,2000));
const adm = await page.evaluate(()=>({
  tabs: document.querySelectorAll('[class*="tab"],[role="tab"]').length,
  kpis: document.querySelectorAll('[class*="kpi"],[class*="stat"],[class*="metric"]').length,
  tables: document.querySelectorAll('table').length,
  loginForm: !!document.querySelector('form input[type=password]'),
}));
log(`🔧 Admin: tabs=${adm.tabs} | kpis=${adm.kpis} | tables=${adm.tables} | loginForm=${adm.loginForm}`);
if (adm.tabs < 3) addIssue('IMPORTANT','14-admin','ADMIN_INCOMPLET',`Seulement ${adm.tabs} onglets admin (attendu 6+)`,'Vérifier admin.html onglets');

await browser.close();

// ═══════════════════════════════════
// GÉNÉRER LE RAPPORT
// ═══════════════════════════════════

const critiques = issues.filter(i=>i.severity==='CRITIQUE');
const importants = issues.filter(i=>i.severity==='IMPORTANT');
const mineurs = issues.filter(i=>i.severity==='MINEUR');

const planCorrection = issues.map((iss, n) => {
  const icon = iss.severity==='CRITIQUE'?'🔴':iss.severity==='IMPORTANT'?'🟠':'🟡';
  return `### ${n+1}. ${icon} ${iss.page} — ${iss.type}
**Problème :** ${iss.desc}
**Correction :** ${iss.fix}
`;
}).join('\n');

const rapport = `# 📋 RAPPORT DE RECETTE — STRATÈGE
*Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}*
*Site : https://stratege-immo.fr*

---

## 📊 RÉSUMÉ GLOBAL

| Criticité | Nombre | Action |
|-----------|--------|--------|
| 🔴 Critique | **${critiques.length}** | Corriger immédiatement |
| 🟠 Important | **${importants.length}** | Corriger avant mise en prod |
| 🟡 Mineur | **${mineurs.length}** | Corriger si le temps le permet |
| **TOTAL** | **${issues.length}** | |

📸 Screenshots disponibles dans : /tmp/stratege-recette/
Format : desktop-XX.png | tablet-XX.png | mobile-XX.png

---

## 🔴 PROBLÈMES CRITIQUES
${critiques.length === 0 ? '✅ **Aucun problème critique !**' : critiques.map((i,n)=>`
### ${n+1}. ${i.page} — ${i.type}
- **Problème :** ${i.desc}
- **Correction :** ${i.fix}
`).join('')}

## 🟠 PROBLÈMES IMPORTANTS
${importants.length === 0 ? '✅ **Aucun !**' : importants.map((i,n)=>`
### ${n+1}. ${i.page} — ${i.type}
- **Problème :** ${i.desc}
- **Correction :** ${i.fix}
`).join('')}

## 🟡 PROBLÈMES MINEURS
${mineurs.length === 0 ? '✅ **Aucun !**' : mineurs.map((i,n)=>`
### ${n+1}. ${i.page} — ${i.type}
- **Problème :** ${i.desc}
- **Correction :** ${i.fix}
`).join('')}

---

## 🛠 PLAN DE CORRECTION COMPLET (ordre priorité)

${planCorrection}

---

## 🔒 ÉTAPE FINALE — PROTECTION DU SITE
Après toutes les corrections, ajouter functions/_middleware.js :
- Utilisateur : rajaa
- Mot de passe : rajaavitrine
- S'applique à TOUT le site sauf /assets/

`;

fs.writeFileSync('docs/recette-rapport.md', rapport);

log('\n' + '═'.repeat(60));
log(`✅ RECETTE TERMINÉE`);
log(`📊 ${issues.length} problèmes : ${critiques.length} critiques | ${importants.length} importants | ${mineurs.length} mineurs`);
log(`📄 Rapport : docs/recette-rapport.md`);
log(`📸 Screenshots : /tmp/stratege-recette/`);
log('═'.repeat(60));
