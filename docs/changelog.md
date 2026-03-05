# Changelog Stratege

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
