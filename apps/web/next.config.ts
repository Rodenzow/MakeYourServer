import type { NextConfig } from "next";
import path from "node:path";

// Variables partagées avec le bot : fichier .env à la racine du monorepo.
try {
  process.loadEnvFile(path.join(import.meta.dirname, "../../.env"));
} catch {
  /* pas de fichier .env : variables fournies par l’environnement */
}

const nextConfig: NextConfig = {
  transpilePackages: ["@mys/core", "@mys/db", "@mys/engine"],
  serverExternalPackages: ["postgres", "stripe"],
  turbopack: {
    root: path.join(import.meta.dirname, "../.."),
    // Côté site, on utilise la version « web » de @discordjs/rest (fetch natif) : la version Node
    // dépend d’undici, qui ne fonctionne pas sur Cloudflare Workers. Le bot garde la version Node.
    resolveAlias: { "@discordjs/rest": "./node_modules/@discordjs/rest/dist/web.mjs" },
  },
  poweredByHeader: false,
  images: {
    // Images déjà légères (logo, avatars Discord) : pas d’optimisation serveur, compatible Cloudflare.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "cdn.discordapp.com" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
