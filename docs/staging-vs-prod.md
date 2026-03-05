# Parité Staging ↔ Prod — 5 mars 2026

## Contexte
- **Staging** : React SPA (Vite) + backend Node.js/Prisma — par Galadrim
- **Prod** : Static HTML/CSS/JS + Cloudflare Functions/KV — par nous

## Tableau de parité

### Pages / Routes

| Fonctionnalité | Staging | Prod | Statut |
|----------------|---------|------|--------|
| Landing / Home | `/` | `index.html` | ✅ |
| Blog liste | `/blog` | `blog.html` | ✅ |
| Blog détail | `/blog/:id` | `blog.html#article-id` | ✅ |
| Catalogue recherche | `/catalog/search` | `catalogue.html` | ✅ |
| Catalogue carte | Leaflet intégré | `catalogue.html` (Leaflet) | ✅ |
| Détail lot | `/catalog/search/lots/:id` | `bien-detail.html?id=xxx` | ✅ |
| Simulation express | `/simulation-express` | N/A | ❌ (simulation complète disponible) |
| Simulation avancée | `/simulation-advanced` | `index.html#simulation` | ✅ |
| Résultats simulation | `/simulation-advanced/results` | `index.html` (inline) | ✅ |
| Connexion | N/A (modal) | `login.html` | ✅ |
| Inscription | N/A (modal) | `register.html` | ✅ |
| Profil | `/profile` | `dashboard.html#profil` | ✅ |
| Dashboard | N/A | `dashboard.html` | ✅ (prod a plus) |
| Paiement | `/payment` | `bien-detail.html` (tunnel) | ✅ |
| PDF synthèse | `/pdf/simulation-synthesis/:id` | N/A | ❌ |
| Reset password | `/reset-password/:token` | `login.html?reset=token` | ✅ |
| À propos / Équipe | `/get-to-know-us` | `a-propos.html` | ✅ |
| Contact | N/A | `contact.html` | ✅ |
| SCPI | N/A | `scpi.html` | ✅ (prod uniquement) |
| Prêt immobilier | N/A | `pret.html` | ✅ (prod uniquement) |
| Pages légales | N/A | 3 pages légales | ✅ (prod uniquement) |
| 404 | N/A | `404.html` | ✅ (prod uniquement) |
| Confirmation réservation | N/A | `reservation-confirmee.html` | ✅ (prod uniquement) |

### Endpoints API

| Endpoint | Staging | Prod | Statut |
|----------|---------|------|--------|
| Auth login | `POST /auth/login/` | `POST /api/auth?action=login` | ✅ |
| Auth register | `POST /user/customer` | `POST /api/auth?action=register` | ✅ |
| Forgot password | `POST /user/forgot-password` | `POST /api/auth?action=reset-request` | ✅ |
| Reset password | `PUT /user/reset-password/` | `POST /api/auth?action=reset` | ✅ |
| Biens / programmes | `GET /catalog/search/programs` | `GET /api/biens` | ✅ |
| Lots | `GET /catalog/search/lots` | `GET /api/biens` (inclus) | ✅ |
| Carte | `GET /catalog/search/map` | Client-side Leaflet | ✅ |
| Blog | `GET /blog/published` | Client-side (données inline) | ✅ |
| Newsletter | `POST /newsletter/subscribe` | `POST /api/newsletter` | ✅ |
| Simulation | Formulaire inline | `POST /api/simulation` | ✅ |
| Sauvegarder sim. | N/A | `GET/POST /api/simulations` | ✅ (prod uniquement) |
| Chat IA | `POST /api/chat` | N/A | ❌ (clé LLM manquante) |
| Réservations | `GET /customers/reservations` | Dashboard inline | ✅ |
| PDF génération | `POST /files/generate-pdf` | N/A | ❌ |
| Contact | N/A | `POST /api/contact` | ✅ (prod uniquement) |
| Favoris | N/A | `GET/POST/DELETE /api/favoris` | ✅ (prod uniquement) |
| Stripe | N/A | `POST /api/stripe` | ✅ (prod uniquement) |
| YouSign | N/A | `POST /api/signature` | ✅ (prod uniquement) |
| Powens | N/A | `POST /api/banque` | ✅ (prod uniquement) |
| Email | N/A | Via MailChannels | ✅ (prod uniquement) |
| SMS OTP | N/A | `POST /api/auth?action=send-sms` | ✅ (prod uniquement) |

### Données

| Données | Staging | Prod | Statut |
|---------|---------|------|--------|
| Biens immobiliers | 3 programmes, 4 lots | 12 biens | ✅ Prod a plus |
| Articles blog | 2 articles | 4 articles | ✅ Prod a plus |
| SCPI | N/A | 12 fonds (ASPIM) | ✅ Prod uniquement |
| Taux prêt | N/A | CAFPI mars 2026 | ✅ Prod uniquement |
| Dispositifs fiscaux | Meublé, Droit commun | Jeanbrun, Denormandie, LMNP | ✅ |

## Résumé

- **✅ En parité** : 24 fonctionnalités
- **✅ Prod uniquement** : 12 fonctionnalités (SCPI, prêt, dashboard complet, Stripe, YouSign, Powens, etc.)
- **❌ Non implémenté** : 2 (Chat IA, PDF serveur)
- **Raison** : Clés API manquantes / limitation Cloudflare Workers

## Clés API à configurer

| Service | Variables | Statut |
|---------|-----------|--------|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_APPROFONDI` | ⏳ |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID` | ⏳ |
| YouSign | `YOUSIGN_API_KEY` | ⏳ |
| Powens | `POWENS_CLIENT_ID`, `POWENS_CLIENT_SECRET` | ⏳ |
| DKIM | `DKIM_PRIVATE_KEY` | ⏳ |
