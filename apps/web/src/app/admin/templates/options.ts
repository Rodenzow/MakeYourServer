import { SIZES, SIZE_LABELS, THEMES, THEME_LABELS } from "@mys/core";

export const themeOptions = THEMES.map((t) => [t, THEME_LABELS[t]] as [string, string]);
export const sizeOptions = SIZES.map((s) => [s, SIZE_LABELS[s]] as [string, string]);
