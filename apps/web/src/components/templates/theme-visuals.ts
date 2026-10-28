/** Identité visuelle de chaque thème : emoji d’icône et motif de bannière. */
export const THEME_VISUALS: Record<string, { emoji: string; motif: string }> = {
  communaute: { emoji: "💬", motif: "💬 ✨ 🙌" },
  gaming: { emoji: "🎮", motif: "🎮 🏆 🎯" },
  musique: { emoji: "🎧", motif: "🎧 🎤 🎵" },
  createur: { emoji: "🎬", motif: "🎬 📺 ⭐" },
  association: { emoji: "🤝", motif: "🤝 📅 💙" },
  etudes: { emoji: "📚", motif: "📚 ✏️ 🎓" },
  roleplay: { emoji: "🐉", motif: "🐉 ⚔️ 🗺️" },
  professionnel: { emoji: "💼", motif: "💼 📊 🗂️" },
  tech: { emoji: "💻", motif: "💻 ⌨️ 🚀" },
  art: { emoji: "🎨", motif: "🎨 🖌️ 📸" },
  anime: { emoji: "🌸", motif: "🌸 📖 ⛩️" },
  amis: { emoji: "🍕", motif: "🍕 🎉 📸" },
  sport: { emoji: "🏃", motif: "🏃 🚴 🏆" },
  autre: { emoji: "✨", motif: "✨ 🧩 💡" },
};

export const themeVisual = (theme: string) => THEME_VISUALS[theme] ?? THEME_VISUALS.autre!;

/** Couleur d’accent en rgb() avec opacité, pour les dégradés de bannière. */
export function accentRgba(color: number, alpha: number) {
  return `rgb(${(color >> 16) & 255} ${(color >> 8) & 255} ${color & 255} / ${alpha})`;
}
