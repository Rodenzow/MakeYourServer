// Crée (ou met à jour) la configuration Hyperdrive du site à partir de DATABASE_URL,
// puis écrit son identifiant dans GITHUB_OUTPUT (hyperdrive_id).
//
// Pourquoi : sur Cloudflare Workers, une connexion TLS directe vers Supabase échoue
// (certificat signé par l’autorité propre à Supabase). Hyperdrive gère ce chiffrement
// côté Cloudflare et garde des connexions ouvertes : plus fiable et plus rapide.
//
// Si la variable HYPERDRIVE_ID est fournie, elle est utilisée telle quelle.
// Aucun secret n’est affiché.
import { appendFileSync } from "node:fs";

const NAME = "make-your-server-db";
const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, DATABASE_URL: databaseUrl, GITHUB_OUTPUT } = process.env;
const fixedId = process.env.HYPERDRIVE_ID?.trim();

function output(id) {
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `hyperdrive_id=${id}\n`);
}

function fail(message) {
  console.log(`::error::${message}`);
  process.exit(1);
}

if (fixedId) {
  console.log("Hyperdrive : identifiant fourni par la variable HYPERDRIVE_ID.");
  output(fixedId);
  process.exit(0);
}

let url;
try {
  url = new URL(databaseUrl ?? "");
} catch {
  fail("DATABASE_URL n’est pas une adresse valide (attendu : postgresql://utilisateur:motdepasse@hôte:5432/base).");
}

const origin = {
  scheme: "postgres",
  host: url.hostname,
  port: Number(url.port || 5432),
  database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres",
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
};
if (!origin.user || !origin.password) fail("DATABASE_URL doit contenir l’utilisateur et le mot de passe.");

const body = {
  name: NAME,
  origin,
  // Pas de cache des lectures : le site doit toujours voir l’état réel (sessions, quotas…).
  caching: { disabled: true },
};

async function api(method, path, payload) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/hyperdrive/configs${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const detail = (data.errors ?? []).map((e) => `${e.code} ${e.message}`).join(" ; ") || `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403 || /auth/i.test(detail)) {
      fail(`Le jeton Cloudflare n’a pas accès à Hyperdrive (${detail}). Ajoutez la permission « Compte · Hyperdrive · Modifier » au jeton (DEPLOIEMENT-CLOUDFLARE.md, étape 2), puis relancez.`);
    }
    fail(`Hyperdrive : ${detail}. Vérifiez DATABASE_URL (Session pooler Supabase, port 5432, mot de passe).`);
  }
  return data.result;
}

const existing = (await api("GET", "")).find((c) => c.name === NAME);
const config = existing ? await api("PUT", `/${existing.id}`, body) : await api("POST", "", body);
console.log(`Hyperdrive ${existing ? "mis à jour" : "créé"} : ${NAME} → ${origin.host}:${origin.port}/${origin.database}`);
output(config.id);
