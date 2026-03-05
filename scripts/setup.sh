#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Stratege — Auto-configuration complete Cloudflare
# Usage :
#   CF_API_KEY=xxx CF_EMAIL=xxx CF_ACCOUNT_ID=xxx bash scripts/setup.sh
#
# Optionnel (si cles API dispo) :
#   STRIPE_SECRET_KEY=sk_test_xxx ... bash scripts/setup.sh
# ═══════════════════════════════════════════════════════════════

set -e

echo "━━━ Stratege — Configuration automatique ━━━"
echo ""

# ── Verifier les outils ──────────────────────────────────
command -v curl >/dev/null || { echo "ERREUR: curl manquant"; exit 1; }
command -v python3 >/dev/null || { echo "ERREUR: python3 manquant"; exit 1; }

# ── Credentials Cloudflare ───────────────────────────────
CF_API_KEY="${CF_API_KEY:-${CLOUDFLARE_API_KEY:-}}"
CF_EMAIL="${CF_EMAIL:-${CLOUDFLARE_EMAIL:-contact@stratege-immo.fr}}"
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-${CLOUDFLARE_ACCOUNT_ID:-}}"

if [ -z "$CF_API_KEY" ] || [ -z "$CF_ACCOUNT_ID" ]; then
  # Tenter de lire depuis .env
  if [ -f ".env" ]; then
    source <(grep -E '^CF_|^CLOUDFLARE_' .env | sed 's/^/export /')
    CF_API_KEY="${CF_API_KEY:-${CF_API_TOKEN:-${CLOUDFLARE_API_KEY:-}}}"
    CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-${CLOUDFLARE_ACCOUNT_ID:-}}"
    CF_EMAIL="${CF_EMAIL:-${CF_API_EMAIL:-${CLOUDFLARE_EMAIL:-}}}"
  fi
fi

if [ -z "$CF_API_KEY" ]; then
  echo "ERREUR: CF_API_KEY non defini."
  echo "Usage: CF_API_KEY=xxx CF_ACCOUNT_ID=xxx bash scripts/setup.sh"
  exit 1
fi
if [ -z "$CF_ACCOUNT_ID" ]; then
  echo "ERREUR: CF_ACCOUNT_ID non defini."
  exit 1
fi

AUTH_HEADERS="-H \"X-Auth-Email: $CF_EMAIL\" -H \"X-Auth-Key: $CF_API_KEY\""

echo "Compte: $CF_EMAIL"
echo "Account ID: ${CF_ACCOUNT_ID:0:8}..."
echo ""

# ── 1. Recuperer Zone ID automatiquement ─────────────────
echo "[1/5] Recherche Zone ID pour stratege-immo.fr..."
ZONE_RESPONSE=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=stratege-immo.fr" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY")

ZONE_ID=$(echo "$ZONE_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['result'][0]['id'] if d.get('result') else '')" 2>/dev/null)

if [ -z "$ZONE_ID" ]; then
  echo "  ERREUR: Zone stratege-immo.fr introuvable"
  echo "  Reponse: $ZONE_RESPONSE"
  exit 1
fi
echo "  Zone ID: $ZONE_ID"

# ── 2. Verifier DNS existants ────────────────────────────
echo ""
echo "[2/5] Verification des DNS existants..."
DNS_RESPONSE=$(curl -s "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?per_page=100" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY")

# Fonction pour checker si un record existe
check_dns() {
  local name="$1"
  local type="$2"
  local content_match="$3"
  echo "$DNS_RESPONSE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d.get('result',[]):
    if r['name']=='$name' and r['type']=='$type':
        if '$content_match' in r.get('content',''):
            print(r['id'])
            sys.exit(0)
print('')
" 2>/dev/null
}

# ── 3. SPF pour MailChannels ─────────────────────────────
echo ""
echo "[3/5] Configuration SPF..."

SPF_EXISTING=$(echo "$DNS_RESPONSE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for r in d.get('result',[]):
    if r['name']=='stratege-immo.fr' and r['type']=='TXT' and 'spf1' in r.get('content',''):
        print(r['id'] + '|' + r['content'])
        break
" 2>/dev/null)

if [ -n "$SPF_EXISTING" ]; then
  SPF_ID=$(echo "$SPF_EXISTING" | cut -d'|' -f1)
  SPF_CONTENT=$(echo "$SPF_EXISTING" | cut -d'|' -f2-)

  if echo "$SPF_CONTENT" | grep -q "mailchannels"; then
    echo "  SPF deja OK (inclut MailChannels)"
  else
    echo "  SPF existe mais sans MailChannels — mise a jour..."
    # Remplacer le SPF existant pour inclure mailchannels
    NEW_SPF="v=spf1 include:relay.mailchannels.net include:_spf-eu.ionos.com mx ~all"
    curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$SPF_ID" \
      -H "X-Auth-Email: $CF_EMAIL" \
      -H "X-Auth-Key: $CF_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"type\":\"TXT\",\"name\":\"@\",\"content\":\"$NEW_SPF\",\"ttl\":1}" > /dev/null
    echo "  SPF mis a jour: $NEW_SPF"
  fi
else
  echo "  Ajout SPF..."
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "X-Auth-Email: $CF_EMAIL" \
    -H "X-Auth-Key: $CF_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"type":"TXT","name":"@","content":"v=spf1 include:relay.mailchannels.net include:_spf-eu.ionos.com mx ~all","ttl":1}' > /dev/null
  echo "  SPF ajoute"
fi

# ── 4. Mailchannels domain lockdown ──────────────────────
echo ""
echo "[4/5] Configuration MailChannels lockdown..."

MC_EXISTS=$(check_dns "_mailchannels.stratege-immo.fr" "TXT" "mc1")

if [ -n "$MC_EXISTS" ]; then
  echo "  _mailchannels deja configure"
else
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "X-Auth-Email: $CF_EMAIL" \
    -H "X-Auth-Key: $CF_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"type":"TXT","name":"_mailchannels","content":"v=mc1 cfid=stratege-immo.pages.dev","ttl":1}' > /dev/null
  echo "  _mailchannels lockdown ajoute"
fi

# ── 5. Injection env vars si fournies ────────────────────
echo ""
echo "[5/5] Variables d'environnement Cloudflare Pages..."

# Construire le JSON des env vars
ENV_JSON=""

add_env() {
  local key="$1"
  local val="$2"
  local type="${3:-plain_text}"
  if [ -n "$val" ]; then
    if [ -n "$ENV_JSON" ]; then ENV_JSON="$ENV_JSON,"; fi
    ENV_JSON="$ENV_JSON\"$key\":{\"type\":\"$type\",\"value\":\"$val\"}"
    echo "  + $key (${type})"
  fi
}

add_env "JWT_SECRET" "${JWT_SECRET:-}" "secret_text"
add_env "STRIPE_SECRET_KEY" "${STRIPE_SECRET_KEY:-}" "secret_text"
add_env "STRIPE_PUBLISHABLE_KEY" "${STRIPE_PUBLISHABLE_KEY:-}" "plain_text"
add_env "STRIPE_WEBHOOK_SECRET" "${STRIPE_WEBHOOK_SECRET:-}" "secret_text"
add_env "STRIPE_PRICE_ID_APPROFONDI" "${STRIPE_PRICE_ID_APPROFONDI:-}" "plain_text"
add_env "TWILIO_ACCOUNT_SID" "${TWILIO_ACCOUNT_SID:-}" "secret_text"
add_env "TWILIO_AUTH_TOKEN" "${TWILIO_AUTH_TOKEN:-}" "secret_text"
add_env "TWILIO_VERIFY_SID" "${TWILIO_VERIFY_SID:-}" "plain_text"
add_env "YOUSIGN_API_KEY" "${YOUSIGN_API_KEY:-}" "secret_text"
add_env "POWENS_CLIENT_ID" "${POWENS_CLIENT_ID:-}" "secret_text"
add_env "POWENS_CLIENT_SECRET" "${POWENS_CLIENT_SECRET:-}" "secret_text"
add_env "DKIM_PRIVATE_KEY" "${DKIM_PRIVATE_KEY:-}" "secret_text"

if [ -n "$ENV_JSON" ]; then
  PATCH_BODY="{\"deployment_configs\":{\"production\":{\"env_vars\":{$ENV_JSON}},\"preview\":{\"env_vars\":{$ENV_JSON}}}}"

  HTTP_CODE=$(curl -s -o /tmp/cf-setup-response.json -w "%{http_code}" \
    -X PATCH \
    "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/pages/projects/stratege-immo" \
    -H "X-Auth-Email: $CF_EMAIL" \
    -H "X-Auth-Key: $CF_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PATCH_BODY")

  if [ "$HTTP_CODE" -eq 200 ]; then
    echo "  Variables injectees (production + preview)"
  else
    echo "  ERREUR ($HTTP_CODE) — voir /tmp/cf-setup-response.json"
  fi
  rm -f /tmp/cf-setup-response.json
else
  echo "  Aucune variable API fournie — injection ignoree"
  echo "  Pour injecter : STRIPE_SECRET_KEY=xxx ... bash scripts/setup.sh"
fi

# ── Rapport final ────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Configuration terminee"
echo ""
echo "Zone ID       : $ZONE_ID"
echo "Account ID    : $CF_ACCOUNT_ID"
echo "Projet        : stratege-immo"
echo ""
echo "Verifier : https://stratege-immo.fr"
echo "DNS      : https://dash.cloudflare.com → DNS → stratege-immo.fr"
echo "Env vars : https://dash.cloudflare.com → Pages → stratege-immo → Settings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
