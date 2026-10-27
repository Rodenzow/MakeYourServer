#!/usr/bin/env bash
# Tests de bout en bout : base de test, serveur Discord simulé, site + worker réels.
set -euo pipefail
cd "$(dirname "$0")/.."
export DATABASE_URL="${TEST_DATABASE_URL:-postgres://mys:mys@localhost:5432/mys_test}"
export APP_URL="http://localhost:3100" DISCORD_SANDBOX=true AI_PROVIDER=mock ADMIN_DISCORD_IDS=100000000000000001
export APP_ENCRYPTION_KEY="${APP_ENCRYPTION_KEY:-$(openssl rand -base64 32)}"
pnpm --filter @mys/db migrate
psql "$DATABASE_URL" -q -c "truncate users, templates, jobs, installations, backups, resource_mappings, guild_features, audit_logs, error_logs, app_settings, bot_guilds cascade"
pnpm --filter @mys/db seed
[ -d apps/web/.next ] || pnpm --filter @mys/web build
(cd apps/web && exec node node_modules/next/dist/bin/next start -p 3100 > /tmp/mys-e2e-web.log 2>&1) &
WEB=$!
(cd apps/bot && exec node --import tsx src/sandbox-worker.ts > /tmp/mys-e2e-worker.log 2>&1) &
WORKER=$!
cleanup() { kill $WEB $WORKER 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 60); do curl -sf -o /dev/null http://localhost:3100/ && break; sleep 0.5; done
E2E_BASE_URL=http://localhost:3100 npx vitest run --config vitest.e2e.config.ts
