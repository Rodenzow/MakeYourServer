# Image du bot Make Your Server.
# Contexte de construction : la racine du dépôt (voir apps/bot-host/wrangler.jsonc).
# Le code est regroupé en un seul fichier (esbuild) pour une image légère.

ARG NODE_IMAGE=node:22-slim

FROM ${NODE_IMAGE} AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@mys/bot..."
RUN pnpm --filter @mys/bot build

FROM ${NODE_IMAGE}
WORKDIR /app
COPY --from=build /repo/apps/bot/dist/bot.mjs /app/bot.mjs
COPY --from=build /repo/packages/db/migrations /app/migrations
ENV NODE_ENV=production \
    PORT=8080 \
    MIGRATIONS_DIR=/app/migrations \
    NODE_OPTIONS=--max-old-space-size=160
EXPOSE 8080
USER node
CMD ["node", "bot.mjs"]
