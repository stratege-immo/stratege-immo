#!/bin/bash
set -e

MSG=${1:-"feat: update"}
echo "Deploiement Stratege..."
echo "Commit : $MSG"

# Git
git add .
git commit -m "$MSG" || echo "Rien a commiter"
git push origin main

# Cloudflare Pages
CLOUDFLARE_API_KEY=e363d5d4da7f300b025b504c13cf03cbebd6e \
CLOUDFLARE_EMAIL=contact@stratege-immo.fr \
CLOUDFLARE_ACCOUNT_ID=ae6aa4e3d684027eff982f997549a1d2 \
npx wrangler pages deploy . \
  --project-name stratege-immo \
  --commit-dirty=true

echo ""
echo "Deploiement termine !"
echo "https://stratege-immo.pages.dev"
echo "https://stratege-immo.fr"
