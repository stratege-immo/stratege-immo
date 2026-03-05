# Stratege — Plateforme CGP Immobiliere

Societe JESPER SAS — SIREN 977 754 050
Marque "Stratege" INPI N° FR5029558

## Stack technique

| Service | Usage | Statut |
|---------|-------|--------|
| Cloudflare Pages | Hosting + Functions serverless | Actif |
| Cloudflare KV | Base de donnees (STRATEGE_DB) | Actif |
| MailChannels | Emails transactionnels via CF Workers | Actif (DNS a completer) |
| Stripe | Paiements (reservation + abonnement) | Code pret, cles manquantes |
| YouSign | Signature electronique sandbox | Code pret, cle manquante |
| Twilio Verify | SMS OTP inscription | Code pret, cles manquantes |
| Powens | Agregation bancaire sandbox | Code pret, cles manquantes |

## URLs

- **Production** : https://stratege-immo.fr
- **Staging** : https://staging.stratege.immo (auth: galadrim/galadrim974)
- **Pages dev** : https://stratege-immo.pages.dev
- **Repo** : github.com/stratege-immo/stratege-immo

## Structure du projet

```
/
├── index.html                    # Landing page + simulation
├── login.html                    # Authentification (login + reset)
├── register.html                 # Inscription 3 etapes + KYC
├── dashboard.html                # Espace client (6 sections)
├── bien-detail.html              # Fiche bien + tunnel reservation
├── reservation-confirmee.html    # Confirmation post-paiement
├── scpi.html                     # Module SCPI (table + simulateur)
├── pret.html                     # Simulateur pret (taux + amortissement)
├── mentions-legales.html         # Mentions legales JESPER
├── politique-confidentialite.html # RGPD
├── cgv-cgu.html                  # CGV/CGU
├── 404.html                      # Page erreur branded
├── assets/
│   ├── style.css                 # Design system complet (~2500 lignes)
│   ├── shared.js                 # Navbar + footer + auth + toasts
│   └── main.js                   # Logique simulateurs + catalogue
├── functions/api/
│   ├── auth.js                   # JWT + bcrypt + Twilio SMS + RGPD
│   ├── biens.js                  # Catalogue biens (6 biens)
│   ├── simulations.js            # CRUD simulations KV
│   ├── stripe.js                 # Checkout + webhook + billing portal
│   ├── signature.js              # YouSign sandbox
│   ├── banque.js                 # Powens agregation
│   ├── email.js                  # MailChannels + DKIM
│   └── contact.js                # Formulaire contact
├── docs/
│   ├── README.md                 # Ce fichier
│   ├── design-system.md          # Tokens + composants
│   ├── audit-existant.md         # Etat des pages et APIs
│   ├── api.md                    # Documentation endpoints
│   ├── tokens.md                 # Design tokens reference
│   └── changelog.md              # Historique
├── scripts/
│   └── setup.sh                  # Auto-config Cloudflare
├── inject-cloudflare-keys.sh     # Injection env vars (placeholders)
├── deploy.sh                     # Deploiement git + wrangler
├── sitemap.xml
├── robots.txt
└── favicon.svg
```

## Deploiement

```bash
bash deploy.sh "message de commit"
```

Le script :
1. `git add . && git commit && git push`
2. `npx wrangler pages deploy .`

## Variables d'environnement requises

```
JWT_SECRET                  # Secret JWT (obligatoire en prod)
STRIPE_SECRET_KEY           # sk_test_xxx ou sk_live_xxx
STRIPE_PUBLISHABLE_KEY      # pk_test_xxx ou pk_live_xxx
STRIPE_WEBHOOK_SECRET       # whsec_xxx
STRIPE_PRICE_ID_APPROFONDI  # price_xxx (abonnement 29€/mois)
TWILIO_ACCOUNT_SID          # ACxxx
TWILIO_AUTH_TOKEN            # 32 chars hex
TWILIO_VERIFY_SID            # VAxxx
YOUSIGN_API_KEY              # Bearer token sandbox
POWENS_CLIENT_ID             # Client ID sandbox
POWENS_CLIENT_SECRET         # Client secret sandbox
DKIM_PRIVATE_KEY             # Cle DKIM pour emails signes
```

Injection : `bash scripts/setup.sh` ou `bash inject-cloudflare-keys.sh`

## Contact

- Email : contact@stratege-immo.fr
- Presidente : El Gharbouji Rajaa
- Siege : 51 bis rue de Miromesnil, 75008 Paris
