# Changelog Stratege

## [1.4.0] — 5 mars 2026 (Session nuit - Part 2)

### Nouvelles features
- **Simulation Hub** (`simulation.html`) — Page 4 onglets : Jeanbrun Social, LMNP, Denormandie, Bilan patrimonial avec calculs temps reel, graphiques SVG, sauvegarde KV
- **Dark mode** — Toggle navbar (soleil/lune), persistence localStorage, @media prefers-color-scheme, variables CSS completes
- **Notifications in-app** — Cloche dans navbar avec badge non lus, dropdown, API `/api/notifs` (GET/PUT/POST)
- **Onboarding premiere connexion** — Modal 4 etapes (objectif, budget, situation, recommandation) sur dashboard.html
- **Tunnel souscription SCPI** — API `/api/scpi/subscribe` avec emails Mailchannels (confirmation client + notification conseiller), reference unique SCPI-2026-XXXXX
- **Sequences nurturing** — API `/api/admin/sequences` : welcome (4 steps J+0/1/3/7), post_rdv (3 steps), scpi_subscriber (3 steps), relance inactifs. Templates email brandes Stratege
- **Page A propos enrichie** — Histoire JESPER SAS, equipe avec bios detaillees, certifications CPI/INPI, partenaires (Senioriales/Corum/Iroko/Sofidy/Perial), chiffres cles
- **Bilan patrimonial PDF** — Export jsPDF avec logo, donnees patrimoniales, resultats analyse, recommandation personnalisee, mentions legales

### Ameliorations
- Navigation: lien Simulation pointe vers simulation.html (hub complet)
- Admin marketing: onglet sequences automatiques avec boutons lancement
- Cache-bust: v122 -> v123

## [1.3.0] — 5 mars 2026 (Session nuit - Part 1)

### Nouvelles features
- **Chatbot IA Bedrock** — Claude Haiku 4.5 via AWS Bedrock (SigV4 signing Web Crypto), remplace le chatbot rule-based
- **Admin JWT auth** — PBKDF2 + HMAC-SHA256, rate limiting IP, suppression code en dur
- **Calculateur defiscalisation** (`calculateur.html`) — 4 dispositifs, baremes IR 2026, partage Web Share API
- **Admin enrichi** — Dossiers credit scoring, sync Senioriales progress bar, notifications badges
- **Dashboard client enrichi** — Favoris, conseiller chat Jitsi, documents drag&drop, progression profil
- **Catalogue Senioriales** — Integration 38 programmes, filtre source, badge Partenaire
- **Blog enrichi** — 3 articles (Jeanbrun guide complet, LMNP 2026, residences seniors)
- **Landing premium** — Stats count-up animation, profils investisseurs, process steps, trust indicators
- **PWA** — manifest.json, theme-color, icones
- **Documents API** — Upload/download documents client via KV
- **Marketing API** — Campagnes email segmentees via Mailchannels

## [1.2.0] — 5 mars 2026

### Analyse staging Galadrim + parite fonctionnelle
- Crawl complet du staging (staging.stratege.immo) — React SPA Vite
- Analyse du backend staging (staging.api.stratege.immo)
- Documentation comparative staging vs prod (docs/staging-analysis.md)

### Nouvelles pages
- blog.html : 4 articles (tendances, cles investissement, SCPI guide, pret 2026)
- catalogue.html : recherche avec carte Leaflet + filtres (ville, dispositif, budget)
- a-propos.html : page equipe + valeurs + chiffres cles
- contact.html : formulaire contact avec endpoint /api/contact

### Nouveaux endpoints API
- POST /api/newsletter : inscription newsletter (KV storage)

### Enrichissements
- Catalogue biens : 6 → 12 biens (+ Rennes, Marseille, Lille, Strasbourg, Nice, Villeurbanne)
- Biens enrichis : coordonnees GPS, promoteur, livraison, nombre de pieces
- Navbar : ajout lien Blog + lien Catalogue dedie
- Footer : ajout colonnes Decouvrir (blog, a-propos, contact) + newsletter
- Sitemap : 4 nouvelles pages indexees

### Deja present en prod (confirme)
- Auth complete (register/login/JWT/SMS OTP/email verify/password reset)
- Simulation 4 etapes (Jeanbrun/Denormandie/LMNP)
- Dashboard 6 sections
- SCPI 12 fonds
- Pret simulateur + amortissement
- Stripe/YouSign/Powens (code pret, cles manquantes)
- Favoris, contact, email MailChannels

## [1.1.0] — 5 mars 2026

### Ajoute
- Documentation projet complete (docs/)
  - design-system.md : tokens, composants, breakpoints
  - audit-existant.md : etat complet pages + APIs + DNS
  - api.md : documentation tous endpoints
  - tokens.md : reference design tokens
  - README.md : guide projet complet
  - changelog.md : historique
- Design system CSS aligne sur specs PDF
  - Tokens couleurs PDF integres
  - Composants buttons 3 variants x 3 tailles
  - Composants badges avec variants soft
  - Progress steps vertical/horizontal
  - Avatars 3 tailles + status indicator
  - Alerts inline 4 types
  - Cards avec hover et featured variant
- Script auto-configuration Cloudflare (scripts/setup.sh)
  - Detection automatique Zone ID
  - Ajout SPF MailChannels
  - Ajout _mailchannels domain lockdown
  - Injection env vars Stripe/Twilio/YouSign/Powens
- bien-detail.html : tunnel reservation 3 etapes complet
  - Etape 1 : recapitulatif bien + frais
  - Etape 2 : coordonnees + CGV
  - Etape 3 : redirection Stripe Checkout
  - Modal contact conseiller
  - Banner annulation
  - Breadcrumb navigation
  - Section avantages par dispositif
- inject-cloudflare-keys.sh : script injection env vars avec placeholders

### Securite
- Rate limiting 10 req/min auth
- XSS sanitization inputs
- RGPD validation serveur
- SPF/DKIM MailChannels (DNS a completer)
- JWT 7 jours, PBKDF2 hash passwords

## [1.0.0] — 4 mars 2026

### Ajoute
- Plateforme CGP complete — JESPER SAS
- Inscription/login JWT + bcrypt + rate limiting
- Verification SMS Twilio + email
- Simulations Jeanbrun/Denormandie/LMNP 4 profils
- SCPI top 12 donnees ASPIM mars 2026
- Simulateur pret taux CAFPI mars 2026
- Tableau amortissement + export CSV
- Espace client dashboard 6 sections
- Catalogue 6 biens avec filtres
- Pages legales JESPER completes (mentions, confidentialite, CGV/CGU)
- Stripe checkout + webhooks (code pret)
- YouSign signature sandbox (code pret)
- Powens agregation bancaire (code pret)
- Email MailChannels + DKIM
- SEO : sitemap.xml, robots.txt, meta OG, Schema.org
- Favicon SVG etoile 4 branches
- 404 page branded
