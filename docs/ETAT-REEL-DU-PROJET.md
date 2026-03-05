# ETAT REEL DU PROJET STRATEGE
Date : 05/03/2026
Version : v128
Auteur : Audit automatise Claude Code

---

## 1. PAGES EXISTANTES (31 fichiers HTML)

| Page | Fichier | Lignes | Role | Fonctionnel ? |
|------|---------|--------|------|---------------|
| Accueil | index.html | 1382 | Public | Oui - hero, simulation express 4 etapes, catalogue, contact |
| Login | login.html | 219 | Public | Oui - JWT auth, reset password via email OTP |
| Register | register.html | 386 | Public | Oui - creation compte, verif email |
| Dashboard | dashboard.html | 1614 | Client (JWT) | Oui - simulations, profil, docs, favoris, score investisseur |
| Simulation | simulation.html | 1073 | Public | Oui - 4 onglets (Jeanbrun/LMNP/Denormandie/Bilan), PDF export |
| Calculateur | calculateur.html | 295 | Public | Oui - defiscalisation 2026 |
| Catalogue | catalogue.html | 447 | Public | Oui - 49 biens (12 hardcodes + 38 Senioriales), carte Leaflet, filtres |
| SCPI | scpi.html | 381 | Public | Oui - comparatif 5 SCPI, simulateur |
| Pret | pret.html | 333 | Public | Oui - simulateur credit, taux 2026 |
| RDV | rdv.html | 952 | Public | Oui - 4 etapes, calendrier, creneaux, confirmation email |
| Souscription SCPI | souscrire-scpi.html | 497 | Public | Oui - formulaire multi-etapes, email confirmation |
| Signature | signer.html | 698 | Public | Oui - Canvas + pdf-lib, SHA-256, 4 etapes |
| Verifier doc | verifier-signature.html | 348 | Public | Oui - verification par ref ou hash |
| Admin CRM | admin.html | 1388 | Admin (JWT) | Oui - prospects, biens, RDV, marketing, sequences, analytics, signatures |
| Conseiller | conseiller.html | 976 | Conseiller (JWT) | Oui - CRM clients, notes, chat, RDV, marketing, email |
| Comparateur | comparer.html | 331 | Public | Oui - comparaison cote-a-cote de programmes |
| Blog index | blog.html | 325 | Public | Oui - 6 articles generes en JS |
| A propos | a-propos.html | 294 | Public | Oui - equipe, valeurs, mission |
| Contact | contact.html | 294 | Public | Oui - formulaire + FAQ accordeon |
| Mentions legales | mentions-legales.html | 98 | Public | Oui |
| Bien detail | bien-detail.html | 758 | Public | Oui - fiche bien, galerie, simulateur integre, reservation Stripe |
| Reservation confirmee | reservation-confirmee.html | 77 | Public | Oui |
| 404 | 404.html | 38 | Public | Oui |
| Politique confidentialite | politique-confidentialite.html | 144 | Public | Oui |
| CGV/CGU | cgv-cgu.html | 140 | Public | Oui |
| Blog : Loi Jeanbrun | blog/loi-jeanbrun-2026.html | 124 | Public | Oui |
| Blog : Senioriales | blog/residences-seniors-senioriales.html | 125 | Public | Oui |
| Blog : Bilan patrimonial | blog/bilan-patrimonial-guide.html | 142 | Public | Oui |
| Blog : LMNP | blog/lmnp-defiscalisation-2026.html | 115 | Public | Oui |
| Blog : SCPI | blog/quelle-scpi-choisir-2026.html | 165 | Public | Oui |
| Blog : Credit | blog/credit-immobilier-taux-2026.html | 117 | Public | Oui |

**Total : 31 pages HTML, ~13 300 lignes**

---

## 2. ROLES UTILISATEURS

### Roles identifies dans le code

| Role | Login | Token key | Pages dediees |
|------|-------|-----------|---------------|
| **Visiteur** | Aucun | - | Toutes pages publiques |
| **Client** | login.html (email+mdp) | `stratege_token` / `stratege_user` | dashboard.html |
| **Admin** | admin.html (email+mdp) | `admin_token` | admin.html |
| **Conseiller** | conseiller.html (email+mdp) | `stratege_advisor_token` | conseiller.html |

### Role CLIENT
- **Auth** : JWT via `/api/auth?action=login` (PBKDF2 + HMAC-SHA256, 7j expiry)
- **Pages accessibles** : dashboard.html (simulations, profil, documents, favoris, score investisseur, chat, banque)
- **Fonctionnalites** :
  - Sauvegarder/partager des simulations
  - Uploader des documents (KYC)
  - Signer electroniquement des documents
  - Gerer favoris
  - Connexion bancaire (Powens demo)
  - Score investisseur (calcule depuis onboarding)
  - Chat avec conseiller
- **Inscription** : register.html, verification email par lien + OTP telephone

### Role ADMIN
- **Auth** : JWT via `/api/admin/auth?action=login` (24h expiry)
- **Compte** : `rajaa@stratege-immo.fr` / `MotDePasseAdmin2026!` (cree via `/api/admin/seed`)
- **Fonctionnalites reelles** :
  - CRM prospects : liste des leads, ajout, filtrage par statut
  - Catalogue biens : vue des 12 biens hardcodes + 38 Senioriales
  - Scraping Senioriales : lancer/suivre le scraping incremental + enrichissement photos
  - RDV : liste des rendez-vous pris
  - Marketing : envoi de campagnes email segmentees (tous/nouveaux/inactifs/SCPI)
  - Sequences nurturing : lancement welcome/relance/post-RDV/SCPI
  - Dossiers credit : 6 dossiers sample avec scoring
  - Analytics : dashboard pageviews/sessions/events/referrers (self-hosted)
  - Signatures : liste de toutes les signatures electroniques

### Role CONSEILLER
- **Auth** : JWT via `/api/advisor/login`
- **Compte** : `conseiller@stratege-immo.fr` / `Conseiller2026!` (cree via `/api/advisor/seed`)
- **Fonctionnalites reelles** :
  - CRM clients : vue de tous les utilisateurs inscrits + leurs simulations + documents
  - Notes privees par client
  - Chat par email avec clients (messages stockes en KV)
  - RDV : liste des rendez-vous
  - Marketing : memes fonctionnalites que admin
  - Email direct aux clients via Mailchannels

---

## 3. FONCTIONNALITES — ETAT REEL

| Fonctionnalite | Statut | Detail |
|----------------|--------|--------|
| Auth login/register | **Reel** | PBKDF2 + JWT, KV storage, email verification, OTP, password reset |
| Simulation Jeanbrun | **Reel** | Calcul fiscal reel : zones A/Abis/B1, durees 6/9/12 ans, complement social, TMI |
| Simulation LMNP | **Reel** | Amortissements (85% immo/30a + 5% meubles/10a), charges, rendement net |
| Simulation Denormandie | **Reel** | Plafond 300k, taux par zone et duree, validation travaux 25% |
| Bilan patrimonial | **Reel** | Scoring profil + recommandations personnalisees + export PDF (jsPDF) |
| Simulation express | **Reel** | 4 etapes, calcul capacite emprunt, budget total, rendement, effort reel |
| Catalogue de biens | **Mixte** | 12 biens hardcodes (biens.js) + 38 programmes Senioriales scrapes (reel) |
| Photos des biens | **Reel** | 38 programmes Senioriales avec ~8 photos chacun (scrapes depuis senioriales.com) |
| Carte interactive | **Reel** | Leaflet avec marqueurs geo pour chaque bien |
| Filtres catalogue | **Reel** | Ville, dispositif, budget max, disponibilite, source |
| Prise de RDV | **Reel** | Creneaux 9h-17h, anti-double-booking, email confirmation, ref RDV-XXXXX |
| Signature electronique | **Reel** | Canvas HTML5 + pdf-lib, SHA-256, stockage KV, verification par ref/hash |
| SCPI souscription | **Reel** | Formulaire multi-etapes, ref SCPI-2026-XXXXX, email admin+client |
| Chatbot IA | **Reel** | 3 tiers : FAQ locale (0 cout) -> cache KV -> AWS Bedrock Claude Haiku 4.5 |
| Emails transactionnels | **Reel** | Mailchannels : welcome, reset, simulation, contact, RDV, SCPI, signature |
| Sequences nurturing | **Reel** | 4 sequences (welcome/post_rdv/scpi/relance), envoi incremental |
| Dashboard client | **Reel** | Simulations, profil, documents, favoris, score, chat, banque |
| Score investisseur | **Reel** | Calcule depuis onboarding (capacite/stabilite/risque/fiscal = /100) |
| CRM Admin | **Reel** | Leads KV, campagnes marketing, analytics, signatures, RDV |
| CRM Conseiller | **Reel** | Clients, notes, chat, RDV, marketing, email |
| Connexion bancaire | **Demo** | Powens BiAPI demo (demo.biapi.pro), analyse revenus/charges/epargne |
| Reservation Stripe | **Reel** | Checkout sessions, webhooks, billing portal, reservation status |
| Analytics | **Reel** | Self-hosted : pageviews, events, sessions (IP hash), referrers, dashboard SVG |
| Upload documents | **Reel** | PDF/JPG/PNG max 10MB, base64 en KV, categories KYC |
| Partage simulation | **Reel** | Hash unique, URL partageable, 30j expiry |
| Newsletter | **Reel** | Inscription footer, stockage KV |
| Notifications | **Reel** | Per-user, max 20, badge non-lus, polling admin 30s |
| Error tracking | **Reel** | window.onerror -> /api/log/error, KV 7j TTL |
| Onboarding | **Reel** | Modal 4 etapes au premier login, stocke preferences localStorage |
| Blog | **Statique** | 6 articles HTML statiques, contenu reel sur Jeanbrun/SCPI/LMNP/credit |
| Comparateur | **Reel** | Comparaison cote-a-cote depuis catalogue, checkboxes + vue comparaison |

**Legende : Reel = backend + donnees en KV | Mixte = partie hardcodee + partie dynamique | Demo = API externe en mode test | Statique = contenu fixe**

---

## 4. BACKEND & DONNEES

### Architecture backend
- **Runtime** : Cloudflare Workers (serverless, edge)
- **Framework** : Cloudflare Pages Functions (fichier = endpoint)
- **Base de donnees** : Cloudflare KV (`STRATEGE_DB`, id: 5ca28b2b0a4e4aa7a699fd2577339ebd)
- **Config** : wrangler.toml + secrets Cloudflare

### Endpoints API reels (27 fichiers, ~7 500 lignes)

| Endpoint | Methodes | Auth | KV | External | Donnees |
|----------|----------|------|----|----------|---------|
| `_middleware.js` | ALL | Basic Auth | Non | - | Hardcoded creds |
| `/api/auth` | POST/GET | JWT | Oui | Mailchannels | Reels (users) |
| `/api/admin/auth` | POST/GET | JWT | Oui | - | Seed hardcode |
| `/api/admin` | POST/GET | Aucun* | Oui | - | Reels (leads) |
| `/api/admin/seed` | GET | - | Oui | - | Seed hardcode |
| `/api/admin/marketing` | POST/GET | JWT | Oui | Mailchannels | Reels (campagnes) |
| `/api/admin/sequences` | POST/GET | JWT | Oui | Mailchannels | Reels (sequences) |
| `/api/advisor/*` | POST/GET | JWT | Oui | Mailchannels | Reels (clients) |
| `/api/analytics` | POST/GET | JWT (dashboard) | Oui | - | Reels (events) |
| `/api/banque` | POST | Powens OAuth | Oui | Powens demo | Demo |
| `/api/biens` | GET | Aucun | Non | - | 12 biens hardcodes |
| `/api/chatbot` | POST | Aucun | Oui | AWS Bedrock | Reel + cache |
| `/api/contact` | POST | Aucun | Oui | - | Reels (contacts) |
| `/api/documents` | POST/GET/DEL | JWT | Oui | - | Reels (base64) |
| `/api/email` | POST | Aucun | Non | Mailchannels | Reels (templates) |
| `/api/favoris` | GET/POST/DEL | Aucun (email) | Oui | - | Reels |
| `/api/log/error` | POST | Aucun | Oui | - | Reels (logs 7j) |
| `/api/newsletter` | POST | Aucun | Oui | - | Reels |
| `/api/notifs` | GET/PUT/POST | JWT | Oui | - | Reels |
| `/api/rdv` | POST/GET | Aucun (email) | Oui | Mailchannels | Reels |
| `/api/scpi/*` | POST/GET | JWT (list) | Oui | Mailchannels | Reels |
| `/api/senioriales/*` | POST/GET | Aucun | Oui | senioriales.com | Reels (scrape) |
| `/api/signature` | POST/GET | Aucun | Oui | Mailchannels | Reels |
| `/api/simulation` | POST | Aucun | Oui | - | Reels (calculs) |
| `/api/simulations` | POST/GET/DEL | JWT | Oui | - | Reels |
| `/api/simulations/share` | POST/GET | Aucun | Oui | - | Reels (30j) |
| `/api/stripe` | POST | Stripe secret | Oui | Stripe API | Reels |

*`/api/admin` n'a PAS de verification JWT — vuln securite*

### Services externes

| Service | Usage | Cout |
|---------|-------|------|
| Cloudflare KV | Base de donnees principale | Gratuit (Workers free tier) |
| Cloudflare Pages | Hosting + CDN | Gratuit |
| AWS Bedrock (Claude Haiku 4.5) | Chatbot IA | ~2 EUR/mois (cache 80%) |
| Mailchannels | Emails transactionnels | Gratuit (via CF Workers) |
| Powens BiAPI | Connexion bancaire | Demo gratuit |
| Stripe | Paiements reservations | Commission standard |
| Senioriales.com | Scraping programmes | Gratuit (web scraping) |
| Google Fonts | Typographies | Gratuit |
| **TOTAL** | | **~2 EUR/mois** |

### Donnees hardcodees

| Donnee | Fichier | Quantite | Impact |
|--------|---------|----------|--------|
| Catalogue biens | functions/api/biens.js | 12 proprietes | Biens "maison" non dynamiques |
| SCPI top 5 | scpi.html (inline) | 5 SCPI | Donnees statiques, pas de mise a jour |
| Taux credit 2026 | pret.html (inline) | 5 durees | Statique, MAJ manuelle |
| Prospects admin | admin.html (inline) | 6 samples | Demo data dans le CRM |
| Dossiers credit | admin.html (inline) | 6 samples | Demo data |
| Admin seed | admin/auth.js | 1 compte | rajaa@stratege-immo.fr |
| Conseiller seed | advisor/[[path]].js | 1 compte | conseiller@stratege-immo.fr |
| Taux simulation Jeanbrun | simulation.html | Grille complete | Statique mais correcte |
| FAQ chatbot | functions/api/chatbot.js | ~20 keywords | Reponses locales instanciees |
| Blog articles | blog.html | 6 articles | Contenu genere en JS |

---

## 5. PHOTOS & MEDIAS

### Etat actuel
- **1 image reelle** : `assets/image0.jpeg` (photo generique)
- **38 programmes Senioriales** : ~8 photos chacun, URLs scrapes depuis senioriales.com (images hebergees sur leur CDN)
- **12 biens hardcodes** : PAS de photos (emoji 🏠 en placeholder)
- **0 photo d'equipe** : a-propos.html utilise des icones SVG
- **Favicon** : `favicon.svg` (SVG inline)
- **Logo** : SVG genere en JS dans shared.js

### Sources des images
- **Senioriales** : Images chargees en direct depuis `cdn.senioriales.com` et `senioriales.com` (scrape dynamique)
- **Biens hardcodes** : Placeholder CSS gradient + emoji, aucune image reelle
- **Blog** : Aucune image, articles texte uniquement
- **Icons** : Tous en SVG inline dans le HTML/JS

### Recommandation
Pour les 12 biens hardcodes : ajouter des photos depuis les promoteurs ou utiliser un service comme Unsplash/Cloudinary.
Les photos Senioriales sont chargees depuis leur CDN — risque de rupture si ils changent les URLs.

---

## 6. FICHIERS FRONTEND (4 JS + 1 CSS)

| Fichier | Lignes | Role |
|---------|--------|------|
| assets/shared.js | 356 | Navbar, footer, auth helpers, toasts, analytics, chatbot/onboarding loader |
| assets/main.js | 433 | Homepage : simulation express 4 etapes, catalogue demo, favoris, contact |
| assets/chatbot.js | 413 | Widget chatbot IA : FAB, panel, messages, suggestions, sessionStorage |
| assets/onboarding.js | 153 | Modal 4 etapes (objectif/budget/situation/recommandations) |
| assets/style.css | 2771 | Design system complet : variables CSS, composants, responsive, animations |

### localStorage keys utilisees

| Key | Usage |
|-----|-------|
| `stratege_token` | JWT client |
| `stratege_user` | Objet user (JSON) |
| `stratege_email` | Email pour favoris (sans login) |
| `stratege_favoris` | IDs des biens favoris |
| `stratege_simulations` | Backup local des simulations |
| `stratege_messages` | Messages chat dashboard |
| `stratege_onboarded` | Flag onboarding termine |
| `stratege_jwt` | JWT alternatif (register) |
| `admin_token` | JWT admin |
| `stratege_advisor_token` | JWT conseiller |

---

## 7. CE QUI RESTE A CONSTRUIRE

### Priorite HAUTE
- [ ] **Securiser `/api/admin`** : ajouter verification JWT (actuellement aucune auth)
- [ ] **Vrais biens immobiliers** : remplacer les 12 biens hardcodes par des donnees dynamiques (API promoteurs ou saisie admin)
- [ ] **Photos des biens** : heberger les images en R2/local au lieu de dependre du CDN Senioriales
- [ ] **Stripe en production** : configurer le compte Stripe reel (actuellement mode test probable)
- [ ] **Powens en production** : passer de demo.biapi.pro a l'API production

### Priorite MOYENNE
- [ ] **Service Worker / PWA offline** : manifest.json existe mais pas de SW
- [ ] **SCPI dynamique** : les 5 SCPI sont hardcodees — ajouter une source de donnees
- [ ] **Taux credit auto-update** : les taux 2026 sont statiques, ajouter un scraper ou API
- [ ] **Admin : gestion dynamique des biens** : formulaire CRUD pour ajouter/modifier/supprimer des biens
- [ ] **Export CSV des leads/RDV** : pas de fonctionnalite d'export dans l'admin
- [ ] **Blog CMS** : les 6 articles sont en HTML statique, ajouter un editeur

### Priorite BASSE
- [ ] **Accents manquants** : certaines pages utilisent "electronique" au lieu de "electronique" (HTML entities)
- [ ] **Dark mode** : le toggle a ete supprime (v126), re-ajouter si besoin
- [ ] **i18n** : tout est en francais, pas de traduction
- [ ] **Tests automatises** : seul le script recette.mjs existe, pas de tests unitaires
- [ ] **Monitoring** : pas d'alerting sur les erreurs (juste logging en KV)
- [ ] **Backup KV** : pas de strategie de backup des donnees KV

---

## 8. DETTE TECHNIQUE

### Securite
- `/api/admin` (admin.js) n'a PAS de verification JWT — n'importe qui peut lire les leads et souscriptions
- Credentials admin/conseiller hardcodes dans le code source (seed functions)
- Basic Auth en clair dans le middleware (rajaa/rajaavitrine)
- Pas de rate limiting sur certains endpoints publics (contact, newsletter)

### Architecture
- Pas de build step : vanilla JS servi directement (pas de minification, tree-shaking)
- CSS monolithique : 1 fichier de 2771 lignes
- Certaines pages ont du JS inline volumineux (simulation.html ~600 lignes, dashboard.html ~700 lignes)
- Duplication de code entre admin.html et conseiller.html (~70% similaire)
- `main.js` contient des BIENS_DEMO hardcodes qui dupliquent biens.js

### Donnees
- KV n'a pas de schema — donnees structurees en JSON libre
- Pas de migration possible (KV est key-value pur)
- TTL varies : 7j (chat/logs), 30j (partages), 365j (users), 3y (simulations) — pas de politique uniforme
- Les index KV sont limites a 500 entrees (admin leads/souscriptions) — pas de pagination

### Monitoring
- Error logging dans KV (7j TTL) mais pas d'alerte
- Analytics self-hosted mais pas de dashboard en temps reel
- Pas de health check automatise

---

## 9. METRIQUES DU PROJET

| Metrique | Valeur |
|----------|--------|
| Pages HTML | 31 |
| Lignes HTML total | ~13 300 |
| Fichiers JS frontend | 4 (1 355 lignes) |
| Fichiers CSS | 1 (2 771 lignes) |
| Endpoints API (fichiers) | 27 (7 500 lignes) |
| Total lignes de code | ~25 000 |
| Services externes | 7 (dont 5 gratuits) |
| Cout mensuel | ~2 EUR |
| Roles utilisateurs | 4 (visiteur, client, admin, conseiller) |
| Biens immobiliers | 50 (12 hardcodes + 38 scrapes) |
| Articles blog | 6 |
| Sequences nurturing | 4 |
| Templates email | 4 |

---

## 10. CREDENTIALS & ACCES

| Service | Identifiant | Mot de passe | Notes |
|---------|-------------|--------------|-------|
| Site (Basic Auth) | rajaa | rajaavitrine | Protection beta |
| Admin CRM | rajaa@stratege-immo.fr | MotDePasseAdmin2026! | Cree via /api/admin/seed |
| Conseiller | conseiller@stratege-immo.fr | Conseiller2026! | Cree via /api/advisor/seed |
| Cloudflare | Via deploy.sh | CF_API_TOKEN | Secrets dans deploy.sh |
| AWS Bedrock | Via CF secrets | AWS_ACCESS_KEY_ID + SECRET | Region us-east-1 |
| Stripe | Via CF secrets | STRIPE_SECRET_KEY | Mode test |
| KV Namespace | STRATEGE_DB | 5ca28b2b...9ebd | Binding wrangler.toml |
