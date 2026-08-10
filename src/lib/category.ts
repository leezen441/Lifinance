import type { Category, CategoryGroup, Language } from "./types";
import { lookup } from "@/i18n/dictionaries";

/**
 * Custom categories carry their own labels; built-ins resolve through the
 * dictionary so they follow the language switch.
 */
export function categoryLabel(category: Category | undefined, lang: Language): string {
  if (!category) return "—";
  const custom = lang === "th" ? category.labelTh : category.labelEn;
  if (custom) return custom;
  if (category.isCustom) return category.labelEn ?? category.labelTh ?? category.key;
  return lookup(lang, `categories.${category.key}`);
}

export function groupLabel(group: CategoryGroup, lang: Language): string {
  return lookup(lang, `expenses.groups.${group}`);
}

export const GROUP_ORDER: CategoryGroup[] = [
  "essential",
  "food",
  "tech",
  "pet",
  "hobby",
  "transport",
  "health",
  "other",
];

/** Distinct hues per group for the spending breakdown bars. */
export const GROUP_COLOR: Record<CategoryGroup, string> = {
  essential: "var(--neon)",
  food: "#22d3ee",
  tech: "#a78bfa",
  pet: "#fb923c",
  hobby: "#f472b6",
  transport: "#facc15",
  health: "#4ade80",
  other: "#94a3b8",
};
