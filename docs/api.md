# Stratege — Documentation API

Base URL : `https://stratege-immo.fr/api`

## Authentification

Toutes les routes protegees necessitent le header :
```
Authorization: Bearer <JWT_TOKEN>
```

Le token est obtenu via login/register (valide 7 jours).

---

## POST /api/auth?action=register

Cree un compte utilisateur.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| prenom | string | oui | Prenom |
| nom | string | oui | Nom |
| email | string | oui | Email unique |
| phone | string | non | Format +33xxx |
| password | string | oui | Min 8 caracteres |
| rgpd | boolean | oui | Doit etre true |

**Succes (201) :**
```json
{ "success": true, "token": "eyJ...", "user": { "id": "usr_xxx", "prenom": "...", "nom": "...", "email": "...", "plan": "express" } }
```

**Erreurs :** 400 (validation), 409 (email existant), 429 (rate limit 10/min)

---

## POST /api/auth?action=login

| Champ | Type | Requis |
|-------|------|--------|
| email | string | oui |
| password | string | oui |

**Succes (200) :** `{ "success": true, "token": "...", "user": {...} }`
**Erreurs :** 401 (identifiants incorrects), 429 (rate limit)

---

## POST /api/auth?action=send-sms

Envoie un OTP SMS via Twilio Verify.

| Champ | Type | Requis |
|-------|------|--------|
| phone | string | oui |

**Succes :** `{ "success": true, "sent": true }`

---

## POST /api/auth?action=verify-sms

Verifie le code OTP SMS.

| Champ | Type | Requis |
|-------|------|--------|
| phone | string | oui |
| code | string | oui |

**Succes :** `{ "success": true, "verified": true }`

---

## GET /api/auth?action=me

Auth requise. Retourne le profil utilisateur complet.

**Succes :** `{ "success": true, "user": { id, prenom, nom, email, phone, plan, kyc, verified_email, verified_phone } }`

---

## POST /api/auth?action=update-profile

Auth requise. Met a jour le profil KYC.

| Champ | Type | Description |
|-------|------|-------------|
| revenus_annuels | number | Revenus nets annuels |
| patrimoine | number | Patrimoine net estime |
| objectif | string | Rendement / Defiscalisation / Patrimoine / Retraite |
| experience | string | Debutant / Intermediaire / Expert |
| situation_familiale | string | Celibataire / Couple / Famille |
| regime_fiscal | string | IR / Micro / SCI-IS |

---

## GET /api/biens

Retourne le catalogue de biens. Pas d'auth requise.

**Parametres query optionnels :**
| Param | Description |
|-------|-------------|
| ville | Filtrer par ville (ex: Toulouse) |
| dispositif | Filtrer par dispositif (ex: Jeanbrun) |
| prix_max | Prix maximum (ex: 200000) |

**Succes :**
```json
{
  "success": true,
  "total": 6,
  "biens": [
    {
      "id": "bien_001",
      "titre": "Appartement T2 — Toulouse Capitole",
      "ville": "Toulouse",
      "surface": 42,
      "prix": 189000,
      "loyer_estime": 750,
      "rendement": 5.8,
      "dispositif": "Jeanbrun Social",
      "mensualite": 820,
      "effort_reel": 248,
      "etage": "3eme sur 5",
      "dpe": "B",
      "disponible": true,
      "tags": ["Investissement", "Jeanbrun", "Centre-ville"]
    }
  ]
}
```

---

## POST /api/stripe?action=create-checkout

Auth requise. Cree une session Stripe Checkout pour reservation.

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| bienId | string | oui | ID du bien |
| bienNom | string | non | Titre du bien |
| montant | number | oui | Montant en EUR (ex: 5000) |
| userId | string | non | ID utilisateur |
| userEmail | string | oui | Email client |

**Succes :** `{ "success": true, "url": "https://checkout.stripe.com/...", "sessionId": "cs_xxx" }`

---

## POST /api/stripe?action=webhook

Webhook Stripe (pas d'auth JWT, verification signature).

Events traites :
- `checkout.session.completed` → Enregistre reservation dans KV
- `invoice.payment_succeeded` → Met a jour statut abonnement

---

## POST /api/stripe?action=reservation-status

Auth requise.

| Champ | Type | Requis |
|-------|------|--------|
| bienId | string | oui |
| userId | string | non |

**Succes :** `{ "success": true, "reservation": { status, amount, paid_at, ... } | null }`

---

## POST /api/signature?action=create

Auth requise. Cree une demande de signature YouSign.

---

## GET /api/signature?action=list&userId=xxx

Auth requise. Liste les documents signes/en cours.

---

## POST /api/banque?action=connect

Auth requise. Initie la connexion bancaire Powens.

**Succes :** `{ "success": true, "url": "https://demo.biapi.pro/..." }`

---

## POST /api/email

Envoie un email via MailChannels.

| Champ | Type | Description |
|-------|------|-------------|
| type | string | "contact" ou "confirmation" |
| nom | string | Nom expediteur |
| email | string | Email destinataire |
| message | string | Contenu |

---

## GET/POST /api/simulations

Auth requise. CRUD des simulations sauvegardees.

**GET :** Liste les simulations de l'utilisateur
**POST :** Sauvegarde une nouvelle simulation

**POST /api/simulation (sans s) :** Execute une simulation (pas de sauvegarde)

| Champ | Type | Description |
|-------|------|-------------|
| profil | string | primo / couple / retraite / rp |
| budget | number | Budget total |
| apport | number | Apport personnel |
| revenu_mensuel | number | Revenus mensuels |
| duree | number | Duree en annees |
