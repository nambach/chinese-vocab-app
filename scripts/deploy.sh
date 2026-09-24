#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="nambach/chinese-vocab-app"
PAGES_URL="https://nambach.github.io/chinese-vocab-app/"
# The deploy clone below is a fresh checkout with no local git config, so it
# falls back to the machine's global user.email (which may be a work email)
# unless we set it explicitly here to match the personal `nambach` account.
DEPLOY_GIT_NAME="Nam Bach"
DEPLOY_GIT_EMAIL="nambach2@gmail.com"

cd "$ROOT"

echo "→ Using GitHub account: nambach"
gh auth switch --user nambach --hostname github.com >/dev/null

echo "→ Building production bundle"
npm run build

DEPLOY_DIR="$(mktemp -d)"
trap 'rm -rf "$DEPLOY_DIR"' EXIT

GIT_CREDENTIAL='!gh auth git-credential'

echo "→ Fetching gh-pages branch"
git -c credential.helper= -c "credential.helper=${GIT_CREDENTIAL}" \
  clone --depth=1 --branch=gh-pages "https://github.com/${REPO}.git" "$DEPLOY_DIR"

echo "→ Syncing dist/ to gh-pages"
rsync -a --delete --exclude '.git' "$ROOT/dist/" "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git config user.name "$DEPLOY_GIT_NAME"
git config user.email "$DEPLOY_GIT_EMAIL"

git add -A
if git diff --staged --quiet; then
  echo "✓ No changes to deploy."
  exit 0
fi

git commit -m "Deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "→ Pushing to gh-pages"
git -c credential.helper= -c "credential.helper=${GIT_CREDENTIAL}" \
  push origin gh-pages

echo "✓ Deployed to ${PAGES_URL}"
