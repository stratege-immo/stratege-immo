# Changelog Stratege

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
