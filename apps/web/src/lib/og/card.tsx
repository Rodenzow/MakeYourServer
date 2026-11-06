import "server-only";
import { ImageResponse } from "next/og";
import { THEME_VISUALS, themeVisual } from "@/components/templates/theme-visuals";
import { env } from "@/lib/env";
import { BRICOLAGE_BOLD_B64, BRICOLAGE_REGULAR_B64, LOGO_PNG_B64 } from "./assets";

/**
 * Images de partage (Open Graph) : l’aperçu qui s’affiche quand un lien du site est
 * collé dans Discord, X, WhatsApp… Format recommandé 1200 × 630.
 *
 * Rendu par next/og (Satori + Resvg en WebAssembly), compatible Cloudflare Workers.
 * Les polices et le logo sont intégrés au code (pas de système de fichiers sur Workers).
 * Les emoji sont dessinés avec Twemoji, téléchargé à la volée depuis le CDN jsDelivr.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** Navigateurs : 1 h ; cache en périphérie (worker.ts) : 1 jour, puis rafraîchi en arrière-plan. */
export const OG_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

const NIGHT = "#07142d";
const LOGO_SRC = `data:image/png;base64,${LOGO_PNG_B64}`;

let fonts: { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[] | null = null;
function loadFonts() {
  if (!fonts) {
    const buf = (b64: string) => {
      const bytes = Buffer.from(b64, "base64");
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    };
    fonts = [
      { name: "Bricolage", data: buf(BRICOLAGE_REGULAR_B64), weight: 400, style: "normal" },
      { name: "Bricolage", data: buf(BRICOLAGE_BOLD_B64), weight: 700, style: "normal" },
    ];
  }
  return fonts;
}

function siteHost() {
  try {
    return new URL(env.appUrl).host.replace(/^www\./, "");
  } catch {
    return "make-your-server.com";
  }
}

const clip = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

function render(node: React.ReactElement) {
  return new ImageResponse(node, {
    ...OG_SIZE,
    fonts: loadFonts(),
    emoji: "twemoji",
    headers: { "cache-control": OG_CACHE_CONTROL },
  });
}

function Brand({ size = 52 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_SRC} width={size} height={size} alt="" style={{ borderRadius: size / 4 }} />
      <span style={{ fontSize: size * 0.6, fontWeight: 700, color: "white", letterSpacing: -0.5 }}>Make Your Server</span>
    </div>
  );
}

export interface TemplateCardData {
  name: string;
  tagline: string;
  theme: string;
  official: boolean;
  stats: { channels: number; roles: number; categories: number; onboardingPrompts: number; automodRules: number };
}

export function templateCard(t: TemplateCardData) {
  const v = themeVisual(t.theme);
  const chips = [
    `${t.stats.channels} salons`,
    `${t.stats.roles} rôles`,
    `${t.stats.categories} catégories`,
    t.stats.onboardingPrompts > 0 ? `${t.stats.onboardingPrompts} questions d’accueil` : t.stats.automodRules > 0 ? `${t.stats.automodRules} règles AutoMod` : null,
  ].filter((c): c is string => !!c);
  const name = clip(t.name, 42);
  return render(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Bricolage", backgroundColor: NIGHT, backgroundImage: `linear-gradient(120deg, ${v.from} 0%, ${v.to} 80%)` }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", backgroundImage: "linear-gradient(to top, rgba(4,11,27,0.92) 0%, rgba(4,11,27,0.55) 55%, rgba(4,11,27,0.15) 100%)" }} />
      <div style={{ position: "absolute", right: -40, bottom: -90, display: "flex", fontSize: 400, opacity: 0.22, transform: "rotate(-10deg)" }}>{v.emoji}</div>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: "52px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Brand />
          <div style={{ display: "flex", fontSize: 40, letterSpacing: 18, opacity: 0.75 }}>{v.motif}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 168, height: 168, flexShrink: 0, borderRadius: 44, backgroundColor: "rgba(7,20,45,0.85)", border: "6px solid rgba(255,255,255,0.18)", fontSize: 100 }}>
            {v.emoji}
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 820 }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: "rgba(255,255,255,0.8)" }}>
              {t.official ? "Template Discord officiel" : "Template Discord de la communauté"}
            </div>
            <div style={{ display: "flex", marginTop: 6, fontSize: name.length > 26 ? 64 : 80, fontWeight: 700, lineHeight: 1.05, color: "white", letterSpacing: -1.5 }}>{name}</div>
            {t.tagline ? <div style={{ display: "flex", marginTop: 16, fontSize: 32, lineHeight: 1.3, color: "rgba(255,255,255,0.88)" }}>{clip(t.tagline, 110)}</div> : null}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12, overflow: "hidden" }}>
            {chips.map((c) => (
              <div key={c} style={{ display: "flex", flexShrink: 0, padding: "9px 18px", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.14)", border: "2px solid rgba(255,255,255,0.22)", color: "white", fontSize: 24, fontWeight: 700 }}>
                {c}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexShrink: 0, marginLeft: 20, fontSize: 24, color: "rgba(255,255,255,0.75)" }}>{siteHost()}</div>
        </div>
      </div>
    </div>,
  );
}

const SITE_EMOJI = ["gaming", "musique", "createur", "etudes", "roleplay", "tech", "art", "amis"].map((k) => THEME_VISUALS[k]!.emoji);

export function siteCard() {
  return render(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Bricolage", backgroundColor: NIGHT, backgroundImage: "linear-gradient(125deg, #07142d 0%, #13274f 55%, #2f5196 100%)" }}>
      <div style={{ position: "absolute", right: -120, top: -160, width: 620, height: 620, borderRadius: 999, display: "flex", backgroundImage: "radial-gradient(circle, rgba(131,168,243,0.45) 0%, rgba(131,168,243,0) 70%)" }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: "56px 68px" }}>
        <Brand size={64} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05, color: "white", letterSpacing: -1.5, maxWidth: 980 }}>Votre serveur Discord, prêt à l’emploi</div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 32, lineHeight: 1.35, color: "#c3d1ef", maxWidth: 960 }}>
            Templates complets ou IA : salons, rôles, permissions, messages, AutoMod et onboarding, installés par notre bot.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 14 }}>
            {SITE_EMOJI.map((e) => (
              <div key={e} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.16)", fontSize: 40 }}>
                {e}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#b8d7ff", fontWeight: 700 }}>{siteHost()}</div>
        </div>
      </div>
    </div>,
  );
}
