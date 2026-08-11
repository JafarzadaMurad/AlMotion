#!/usr/bin/env bash
#
# Deploy AlMotion on the VPS.
#
# Written after a deploy silently did nothing: `git pull` aborted on a dirty
# composer.json, every following command reported success against the old
# checkout ("Nothing to migrate", a clean build), and the deploy looked fine
# while none of the new code had arrived.
#
# So this script refuses to guess. It stops at the first failure, refuses to
# run against a dirty tree, and prints the commit it actually deployed.
#
# Usage:  ./deploy.sh
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$REPO_DIR/freecut-backend"
FRONTEND_DIR="$REPO_DIR/freecut"

say()  { printf '\n\033[1;35m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mFAILED: %s\033[0m\n' "$1" >&2; exit 1; }

cd "$REPO_DIR"

# --- Refuse to start from an unclean tree ------------------------------------
# This is the check that would have caught the silent deploy. A dirty file that
# the incoming commit also touches makes `git pull` abort, and without this the
# rest of the script would happily "succeed" against stale code.
say "Checking the working tree is clean"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  git status --short --untracked-files=no
  fail "Uncommitted changes above. Commit, stash, or 'git checkout --' them, then re-run."
fi

BEFORE="$(git rev-parse HEAD)"

say "Pulling"
git pull --ff-only || fail "git pull could not fast-forward. Resolve by hand, then re-run."

AFTER="$(git rev-parse HEAD)"
if [[ "$BEFORE" == "$AFTER" ]]; then
  say "Already up to date at $(git rev-parse --short HEAD) — rebuilding anyway"
else
  say "Moved $(git rev-parse --short "$BEFORE") -> $(git rev-parse --short "$AFTER")"
fi

# What changed decides what we rebuild. On a no-op pull both run, so an
# interrupted earlier deploy still gets finished.
CHANGED="$(git diff --name-only "$BEFORE" "$AFTER" || true)"
backend_touched=1
frontend_touched=1
if [[ "$BEFORE" != "$AFTER" ]]; then
  grep -q '^freecut-backend/' <<<"$CHANGED" || backend_touched=0
  grep -q '^freecut/'         <<<"$CHANGED" || frontend_touched=0
fi

# --- Backend -----------------------------------------------------------------
if [[ "$backend_touched" == 1 ]]; then
  say "Backend: dependencies"
  cd "$BACKEND_DIR"
  composer install --no-dev --optimize-autoloader --no-interaction

  say "Backend: migrations"
  # Surfaced deliberately: "Nothing to migrate" after a pull that added one is
  # the symptom that the pull never landed.
  php artisan migrate --force

  say "Backend: clearing caches"
  php artisan config:clear
  php artisan route:clear
else
  say "Backend unchanged — skipping"
fi

# --- Frontend ----------------------------------------------------------------
if [[ "$frontend_touched" == 1 ]]; then
  say "Frontend: dependencies"
  cd "$FRONTEND_DIR"
  npm ci

  say "Frontend: build"
  # Build into a temp dir and swap, so a failed build cannot leave dist/ half
  # written and the site broken. Caddy serves dist/ straight off disk.
  rm -rf dist.new
  npm run build -- --outDir dist.new
  rm -rf dist.old
  [[ -d dist ]] && mv dist dist.old
  mv dist.new dist
  rm -rf dist.old
else
  say "Frontend unchanged — skipping"
fi

say "Deployed $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"
