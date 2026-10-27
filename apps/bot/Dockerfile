# Image du bot Make Your Server (contexte de construction : racine du dépôt).
# Utilisée par Cloudflare Containers (apps/bot-host) ou n’importe quel hébergeur Docker.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@mys/bot..."
RUN pnpm --filter @mys/bot deploy --legacy --prod /app

FROM node:22-slim
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["node", "--import", "tsx", "src/index.ts"]
