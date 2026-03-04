#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# STRATÈGE — Script d'injection des clés API dans Cloudflare Pages
# Usage : bash inject-cloudflare-keys.sh
#
# AVANT D'EXÉCUTER :
# 1. Remplacer chaque "À_REMPLACER_xxx" par la vraie valeur
# 2. S'assurer que CF_API_TOKEN et CF_ACCOUNT_ID sont définis
# ═══════════════════════════════════════════════════════════════

set -e

# ── Cloudflare credentials ──────────────────────────────────
CF_API_TOKEN="${CF_API_TOKEN:-À_REMPLACER_CLOUDFLARE_API_TOKEN}"
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-À_REMPLACER_CLOUDFLARE_ACCOUNT_ID}"
PROJECT_NAME="stratege-immo"

# ── Clés API à injecter ─────────────────────────────────────
STRIPE_SECRET_KEY="À_REMPLACER_sk_test_xxx"
STRIPE_PUBLISHABLE_KEY="À_REMPLACER_pk_test_xxx"
STRIPE_WEBHOOK_SECRET="À_REMPLACER_whsec_xxx"
STRIPE_PRICE_ID_APPROFONDI="À_REMPLACER_price_xxx"

TWILIO_ACCOUNT_SID="À_REMPLACER_ACxxx"
TWILIO_AUTH_TOKEN="À_REMPLACER_auth_token_xxx"
TWILIO_VERIFY_SID="À_REMPLACER_VAxxx"

YOUSIGN_API_KEY="À_REMPLACER_yousign_key_xxx"

# ── Vérification ────────────────────────────────────────────
echo "━━━ Stratège — Injection des clés Cloudflare Pages ━━━"
echo ""

if [[ "$CF_API_TOKEN" == À_REMPLACER* ]]; then
  echo "ERREUR: CF_API_TOKEN n'est pas défini."
  echo "Export: export CF_API_TOKEN=votre_token"
  exit 1
fi

if [[ "$CF_ACCOUNT_ID" == À_REMPLACER* ]]; then
  echo "ERREUR: CF_ACCOUNT_ID n'est pas défini."
  echo "Export: export CF_ACCOUNT_ID=votre_account_id"
  exit 1
fi

# Vérifier qu'au moins une clé a été remplacée
UNCHANGED=0
for VAR in STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY STRIPE_WEBHOOK_SECRET \
           STRIPE_PRICE_ID_APPROFONDI TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN \
           TWILIO_VERIFY_SID YOUSIGN_API_KEY; do
  VAL="${!VAR}"
  if [[ "$VAL" == À_REMPLACER* ]]; then
    echo "⚠  $VAR non remplacé (placeholder)"
    UNCHANGED=$((UNCHANGED + 1))
  else
    echo "✓  $VAR configuré (...${VAL: -4})"
  fi
done

echo ""
if [ "$UNCHANGED" -eq 8 ]; then
  echo "ERREUR: Aucune clé n'a été remplacée. Éditez ce script d'abord."
  exit 1
fi

echo "Injection de $((8 - UNCHANGED))/8 clés..."
echo ""

# ── Injection PATCH ─────────────────────────────────────────
HTTP_CODE=$(curl -s -o /tmp/cf-inject-response.json -w "%{http_code}" \
  -X PATCH \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${PROJECT_NAME}" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"deployment_configs\": {
      \"production\": {
        \"env_vars\": {
          \"STRIPE_SECRET_KEY\":          {\"value\": \"${STRIPE_SECRET_KEY}\", \"type\": \"secret_text\"},
          \"STRIPE_PUBLISHABLE_KEY\":     {\"value\": \"${STRIPE_PUBLISHABLE_KEY}\"},
          \"STRIPE_WEBHOOK_SECRET\":      {\"value\": \"${STRIPE_WEBHOOK_SECRET}\", \"type\": \"secret_text\"},
          \"STRIPE_PRICE_ID_APPROFONDI\": {\"value\": \"${STRIPE_PRICE_ID_APPROFONDI}\"},
          \"TWILIO_ACCOUNT_SID\":         {\"value\": \"${TWILIO_ACCOUNT_SID}\", \"type\": \"secret_text\"},
          \"TWILIO_AUTH_TOKEN\":          {\"value\": \"${TWILIO_AUTH_TOKEN}\", \"type\": \"secret_text\"},
          \"TWILIO_VERIFY_SID\":          {\"value\": \"${TWILIO_VERIFY_SID}\"},
          \"YOUSIGN_API_KEY\":            {\"value\": \"${YOUSIGN_API_KEY}\", \"type\": \"secret_text\"}
        }
      },
      \"preview\": {
        \"env_vars\": {
          \"STRIPE_SECRET_KEY\":          {\"value\": \"${STRIPE_SECRET_KEY}\", \"type\": \"secret_text\"},
          \"STRIPE_PUBLISHABLE_KEY\":     {\"value\": \"${STRIPE_PUBLISHABLE_KEY}\"},
          \"STRIPE_WEBHOOK_SECRET\":      {\"value\": \"${STRIPE_WEBHOOK_SECRET}\", \"type\": \"secret_text\"},
          \"STRIPE_PRICE_ID_APPROFONDI\": {\"value\": \"${STRIPE_PRICE_ID_APPROFONDI}\"},
          \"TWILIO_ACCOUNT_SID\":         {\"value\": \"${TWILIO_ACCOUNT_SID}\", \"type\": \"secret_text\"},
          \"TWILIO_AUTH_TOKEN\":          {\"value\": \"${TWILIO_AUTH_TOKEN}\", \"type\": \"secret_text\"},
          \"TWILIO_VERIFY_SID\":          {\"value\": \"${TWILIO_VERIFY_SID}\"},
          \"YOUSIGN_API_KEY\":            {\"value\": \"${YOUSIGN_API_KEY}\", \"type\": \"secret_text\"}
        }
      }
    }
  }")

echo "HTTP Status: ${HTTP_CODE}"

if [ "$HTTP_CODE" -eq 200 ]; then
  echo ""
  echo "━━━ SUCCÈS — Clés injectées dans Cloudflare Pages ━━━"
  echo ""
  echo "Les variables sont disponibles pour production ET preview."
  echo "Relancez un déploiement pour qu'elles prennent effet :"
  echo "  bash deploy.sh \"config: clés API injectées\""
else
  echo ""
  echo "━━━ ERREUR ━━━"
  cat /tmp/cf-inject-response.json
  echo ""
  echo "Vérifiez votre CF_API_TOKEN et CF_ACCOUNT_ID."
fi

rm -f /tmp/cf-inject-response.json
