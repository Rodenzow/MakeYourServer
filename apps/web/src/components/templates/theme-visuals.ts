/** Identité visuelle de chaque thème : emoji d’icône et motif de bannière. */
export const THEME_VISUALS: Record<string, { emoji: string; motif: string; from: string; to: string }> = {
  communaute: { emoji: "💬", motif: "💬 ✨ 🙌", from: "#4f7cff", to: "#9db8ff" },
  gaming: { emoji: "🎮", motif: "🎮 🏆 🎯", from: "#7c3aed", to: "#22d3ee" },
  musique: { emoji: "🎧", motif: "🎧 🎤 🎵", from: "#e11d74", to: "#7c3aed" },
  createur: { emoji: "🎬", motif: "🎬 📺 ⭐", from: "#ff5f45", to: "#ffb03a" },
  association: { emoji: "🤝", motif: "🤝 📅 💙", from: "#0ea5a4", to: "#38bdf8" },
  etudes: { emoji: "📚", motif: "📚 ✏️ 🎓", from: "#2563eb", to: "#60e2c0" },
  roleplay: { emoji: "🐉", motif: "🐉 ⚔️ 🗺️", from: "#8b5a2b", to: "#d4a24c" },
  professionnel: { emoji: "💼", motif: "💼 📊 🗂️", from: "#334e8a", to: "#7aa2d8" },
  tech: { emoji: "💻", motif: "💻 ⌨️ 🚀", from: "#16a34a", to: "#2dd4bf" },
  art: { emoji: "🎨", motif: "🎨 🖌️ 📸", from: "#ec4899", to: "#f59e0b" },
  anime: { emoji: "🌸", motif: "🌸 📖 ⛩️", from: "#f472b6", to: "#a78bfa" },
  amis: { emoji: "🍕", motif: "🍕 🎉 📸", from: "#f97316", to: "#facc15" },
  sport: { emoji: "🏃", motif: "🏃 🚴 🏆", from: "#ef4444", to: "#f97316" },
  autre: { emoji: "✨", motif: "✨ 🧩 💡", from: "#6366f1", to: "#a7bdff" },
};

export const themeVisual = (theme: string) => THEME_VISUALS[theme] ?? THEME_VISUALS.autre!;

/** Couleur d’accent en rgb() avec opacité, pour les dégradés de bannière. */
export function accentRgba(color: number, alpha: number) {
  return `rgb(${(color >> 16) & 255} ${(color >> 8) & 255} ${color & 255} / ${alpha})`;
}
