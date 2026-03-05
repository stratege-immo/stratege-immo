# Analyse Staging vs Prod — 5 mars 2026

## Contexte

- **Staging** : React SPA (Vite) par Galadrim — `staging.stratege.immo` (auth basic `galadrim:galadrim974`)
- **Backend staging** : `staging.api.stratege.immo` (Node.js/Prisma, base SQL)
- **Prod** : Static HTML + Cloudflare Functions — `stratege-immo.fr`
- **Stacks différents** : le staging est un SPA React, la prod est du vanilla HTML/CSS/JS

---

## Pages staging

| Route staging | Status | Contenu | Équivalent prod |
|---------------|--------|---------|-----------------|
| `/` | 200 | Landing + simulation express + catalogue | ✅ `index.html` |
| `/blog` | 200 | Liste d'articles (2 articles) | ❌ **À créer** |
| `/blog/:blogId` | 200 | Détail article avec cover | ❌ **À créer** |
| `/catalog` | 200 | Redirect vers search | ⚠️ Partiel (`index.html#catalogue`) |
| `/catalog/search` | 200 | Recherche programmes avec carte Leaflet | ❌ **À créer** |
| `/catalog/search/lots` | 200 | Liste des lots filtrable | ⚠️ Partiel (`bien-detail.html`) |
| `/catalog/search/lots/:lotId` | 200 | Détail lot + réservation | ✅ `bien-detail.html` |
| `/get-to-know-us` | 200 | Page équipe / à propos | ❌ **À créer** |
| `/payment` | 200 | Tunnel paiement Stripe | ✅ `bien-detail.html` (tunnel intégré) |
| `/pdf` | 200 | Génération PDF synthèse | ❌ **À créer** (endpoint) |
| `/profile` | 200 | Profil utilisateur | ✅ `dashboard.html#profil` |
| `/reset-password/:token` | 200 | Réinitialisation mot de passe | ⚠️ Form existe dans `login.html`, endpoint à compléter |
| `/simulation-advanced` | 200 | Simulation approfondie multi-étapes | ✅ `index.html#simulation` (4 étapes) |
| `/simulation-advanced/results` | 200 | Résultats simulation avancée | ✅ Dans `main.js` |
| `/simulation-express` | 200 | Simulation rapide | ❌ **À créer** |
| `/simulation-express/results` | 200 | Résultats express | ❌ **À créer** |

## Endpoints API staging (backend)

| Endpoint | Méthode | Réponse | Équivalent prod |
|----------|---------|---------|-----------------|
| `/auth/login/` | POST | JWT + user | ✅ `/api/auth?action=login` |
| `/user/customer` | POST | Création compte | ✅ `/api/auth?action=register` |
| `/user/forgot-password` | POST | Email reset | ⚠️ Action existe dans auth.js mais incomplète |
| `/user/reset-password/` | PUT | Reset password | ⚠️ À compléter |
| `/blog/published` | GET | 2 articles JSON | ❌ **À créer** |
| `/catalog/search/programs` | GET | 3 programmes | ⚠️ `/api/biens` (6 biens statiques) |
| `/catalog/search/lots` | GET | 4 lots | ⚠️ `/api/biens` |
| `/catalog/search/map` | GET | Données cartographiques | ❌ **À créer** |
| `/catalog/search/count` | GET | `{lots:4, programs:3}` | ❌ **À créer** |
| `/simulations/express/ads` | GET | Pubs simulation express | ❌ Pas pertinent |
| `/simulations/advanced/ads` | GET | Pubs simulation avancée | ❌ Pas pertinent |
| `/files/generate-signed-url` | GET | URL signée fichiers | ❌ Pas nécessaire (statique) |
| `/files/generate-pdf` | POST | Génération PDF synthèse | ❌ **À créer** |
| `/newsletter/subscribe` | POST | Inscription newsletter | ❌ **À créer** |
| `/api/chat` | POST | Chatbot IA | ❌ Non implémentable (clé API) |
| `customers/reservations` | GET | Liste réservations | ⚠️ Dashboard existe |

## Données staging

- **Programmes immobiliers** : 3 (Nexity — Villeurbanne, Ajaccio, etc.)
- **Lots disponibles** : 4 (T3, T5, etc. — 150K€ à 210K€)
- **Articles blog** : 2 (Tendances 2025, Clés investissement)
- **Dispositifs** : LMNP, Droit commun, Meublé non géré
- **Géolocalisation** : Intégration API Adresse, Communes, Départements (gouv.fr)
- **Cartographie** : Leaflet + OpenStreetMap + IGN

## Fonctionnalités staging (détaillées)

### Présentes sur staging, absentes en prod :
1. **Blog** — Articles avec cover, date, contenu riche (ProseMirror)
2. **Recherche catalogue avec carte** — Leaflet map, filtres (ville, budget, pièces, dispositif)
3. **Simulation express** — Version simplifiée de la simulation
4. **Newsletter** — Formulaire inscription dans le footer
5. **Page "Qui sommes-nous"** — Équipe avec photos et descriptions
6. **Chatbot IA** — Interface chat avec /api/chat
7. **Génération PDF** — Synthèse simulation en PDF téléchargeable
8. **Reset password complet** — Email + token + formulaire
9. **Rendez-vous conseiller** — Prise de RDV en ligne
10. **Favoris lots** — Ajout/retrait de lots en favoris

### Présentes sur les deux (✅ déjà en prod) :
1. Auth (inscription, connexion, JWT)
2. Simulation avancée multi-étapes
3. Catalogue de biens / lots
4. Détail bien + tunnel réservation
5. Profil utilisateur
6. Dashboard
7. Pages légales
8. Paiement Stripe (code prêt, clés manquantes)

---

## ❌ Non implémentable maintenant

| Fonctionnalité | Raison |
|----------------|--------|
| Chatbot IA (`/api/chat`) | Clé API LLM manquante |
| Rendez-vous conseiller | Backend Galadrim (calendrier, dispo conseillers) |
| Réservations temps réel | Dépend du backend Galadrim (stock lots) |
| Génération PDF serveur | Librairie PDF non dispo sur Cloudflare Workers |

## 🔑 Clés API manquantes (déjà identifiées)

- `STRIPE_SECRET_KEY` — Paiements Stripe
- `TWILIO_*` — SMS OTP
- `YOUSIGN_API_KEY` — Signatures électroniques
- `POWENS_*` — Agrégation bancaire
- `DKIM_PRIVATE_KEY` — Signature email

---

## Plan d'implémentation (par priorité)

### P1 — Pages manquantes
1. ✅ `blog.html` — Page blog avec articles
2. ✅ `a-propos.html` — Page équipe
3. ✅ `contact.html` — Page contact avec formulaire
4. ✅ Catalogue enrichi avec recherche + carte

### P2 — Fonctionnalités manquantes
5. ✅ Newsletter (footer + endpoint)
6. ✅ Password reset (compléter auth.js)
7. ✅ Enrichir le catalogue de biens (plus de biens)

### P3 — Polish
8. ✅ Mise à jour navigation (navbar + footer + sitemap)
9. ✅ Documentation complète
