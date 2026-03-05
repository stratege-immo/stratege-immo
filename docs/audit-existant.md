# Stratege — Audit de l'existant

Date : 5 mars 2026

## Pages et leur etat

| Page | Fichier | Etat | Notes |
|------|---------|------|-------|
| Homepage | index.html | OK | Hero + 5 sections + simulation 4 etapes |
| Login | login.html | OK | 3 formulaires (login, reset request, reset password) |
| Register | register.html | OK | Onboarding 3 etapes (compte, verif, KYC) |
| Dashboard | dashboard.html | OK | Sidebar + 6 sections (overview, simulations, investissements, documents, banque, profil) |
| SCPI | scpi.html | OK | Table 12 SCPI + simulateur revenus + comparatif |
| Pret | pret.html | OK | Taux CAFPI mars 2026 + simulateur + tableau amortissement |
| Bien detail | bien-detail.html | OK | Galerie + 4 tabs + tunnel reservation 3 etapes + contact modal |
| Reservation confirmee | reservation-confirmee.html | OK | Confirmation + 4 etapes suivantes |
| Mentions legales | mentions-legales.html | OK | 9 sections JESPER completes |
| Politique confidentialite | politique-confidentialite.html | OK | RGPD |
| CGV/CGU | cgv-cgu.html | OK | Conditions generales |
| 404 | 404.html | OK | Branded avec CTAs |

## APIs et leur etat

| Endpoint | Fichier | Etat | Depend de |
|----------|---------|------|-----------|
| POST /api/auth | functions/api/auth.js | OK (fallback JWT_SECRET) | JWT_SECRET, TWILIO_*, STRATEGE_DB |
| GET /api/biens | functions/api/biens.js | OK | Aucun (donnees statiques) |
| POST /api/stripe | functions/api/stripe.js | Pret | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET |
| POST /api/signature | functions/api/signature.js | Pret | YOUSIGN_API_KEY |
| POST /api/banque | functions/api/banque.js | Pret | POWENS_CLIENT_ID, POWENS_CLIENT_SECRET |
| POST /api/email | functions/api/email.js | Partiel | DKIM_PRIVATE_KEY (optionnel) |
| POST /api/simulations | functions/api/simulations.js | OK | STRATEGE_DB |

## Variables d'environnement

| Variable | Configuree | Critique |
|----------|-----------|----------|
| STRATEGE_DB (KV binding) | A verifier | Oui |
| JWT_SECRET | Non (fallback insecure) | Oui |
| STRIPE_SECRET_KEY | Non | Oui pour paiements |
| STRIPE_PUBLISHABLE_KEY | Non | Oui pour paiements |
| STRIPE_WEBHOOK_SECRET | Non | Oui pour webhooks |
| STRIPE_PRICE_ID_APPROFONDI | Non | Oui pour abonnement |
| TWILIO_ACCOUNT_SID | Non | Oui pour SMS |
| TWILIO_AUTH_TOKEN | Non | Oui pour SMS |
| TWILIO_VERIFY_SID | Non | Oui pour SMS |
| YOUSIGN_API_KEY | Non | Oui pour signature |
| POWENS_CLIENT_ID | Non | Oui pour banque |
| POWENS_CLIENT_SECRET | Non | Oui pour banque |
| DKIM_PRIVATE_KEY | Non | Recommande |

**Score : 0/13 variables configurees**

## DNS

| Record | Etat | Probleme |
|--------|------|----------|
| CNAME @ → pages.dev | OK | — |
| CNAME www → pages.dev | OK | — |
| MX → ionos.fr | OK | — |
| SPF | Partiel | Manque `include:relay.mailchannels.net` |
| _mailchannels | Absent | Domain lockdown manquant |
| DKIM | Absent | Signature email manquante |
| DMARC | Ionos CNAME | Pas de policy propre |

## Inconsistances a corriger

1. **JWT_SECRET fallback** : `auth.js:110` utilise `'stratege-default-secret-change-me'` — insecure en prod
2. **SPF incomplet** : Les emails MailChannels risquent d'etre rejetes par Gmail/Outlook
3. **Copyright footer** : Affiche "2025" au lieu de "2025-2026"
4. **Gallery images** : Toutes les fiches bien ont un placeholder emoji, pas de vraies photos
5. **Social links** : Navbar et footer ont des `href="#"` — pas de vrais liens sociaux

## Staging vs Prod — Differences notables

Le staging (staging.stratege.immo) est un projet React SPA totalement different :
- Stack : React + Mantine + Tailwind + Shadcn/ui
- Fonts : Poppins + Roboto (prod : Playfair Display + Inter)
- Couleurs legererement differentes (teal plus fonce sur staging)
- Features supplementaires : chatbot IA, carte Leaflet, graphiques Recharts
- Routes differentes (/catalog au lieu de /index.html#catalogue)

**Decision** : La prod reste en static HTML. Le staging est une reference visuelle seulement.
