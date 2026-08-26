import type { Product } from './types';

/* The 28 catalogue tiles in public/products are the shop's own 2026 line
   sheet, cropped square and retoned onto the bone ground. They ship with the
   build and are named by position — boards_4.webp, not by SKU — so this table
   is what ties an asset to a product row.

   The key is the product name printed on the source card, which is the only
   thing the cards and the database have in common. Photos are per style, not
   per SKU: one card lists every size it comes in, which matches how the
   inventory screens already group variants. */
const CATALOG: ReadonlyArray<readonly [string, string]> = [
  // Bags
  ['FOCAL- INTERSTATE ROLLER', 'bags'],
  ['FOCAL-LOCALE DAY BAG', 'bags_2'],
  ['FOCAL- 24 L BACKPACK', 'bags_3'],
  ['FOCAL- INTERSTATE 81 L TRAVEL ROLLER', 'bags_4'],
  // Outerwear and impact vests, filed under BAGS on the line sheet
  ['FOCAL- ONE FIVE SLATE', 'bags_5'],
  ['FOCAL- ONE FIVE STONE', 'bags_6'],
  ['P$$FCL - ONE OUT ANORAK COOL GREY', 'bags_7'],
  ['BENNINGTON CHARCOAL', 'bags_8'],
  ['FOCAL BENNINGTON BLACK', 'boots_3'],
  ['FOCAL BENNINGTON SLATE', 'boots_4'],
  ['FOCAL BENNINGTON WINE', 'boots_5'],
  // Boards
  ['2026 CHILV PRO', 'boards'],
  ['2026 ATLAS PRO', 'boards_2'],
  ['2026 WHITEXX PRO', 'boards_3'],
  ['2025 SAPPAROD PRO', 'boards_4'],
  ['2025 ATLAS PRO', 'boards_5'],
  ['2025 CHILV PRO', 'boards_6'],
  ['2025 WHITEXX PRO', 'boards_7'],
  ['2024 SAPPAROD PRO', 'boards_8'],
  ['2024 KUDETA PRO', 'boards_9'],
  ['2024 CHILV PRO', 'boards_10'],
  ['2023 SAPPAROD PRO', 'boards_11'],
  ['2023 CHILV PRO', 'boards_12'],
  ['2022 SDR PRO', 'boards_13'],
  // Boots
  ['2026 PROGRAM', 'boots'],
  ['2026 FIGMENT MOJITO', 'boots_2'],
  ['2025 FIGMENT HERITAGE', 'boots_6'],
  ['2023 MOJITO', 'boots_7'],
];

/* Line-sheet titles carry brand marks the database does not: "FOCAL-",
   "P$$FCL - ". Stripping punctuation and the brand token leaves the part both
   sides actually agree on. Board names keep their year, because the year is
   what separates the 2026 Chilv from the 2025 one. */
const normalise = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/^(?:FOCAL|P FCL|PSSFCL|DUP)\s+/, '')
    .trim();

const INDEX: ReadonlyArray<readonly [string, string]> = CATALOG.map(([name, asset]) => [normalise(name), `/products/${asset}.webp`] as const);

/** Catalogue tile for a product, or null when the line sheet has no card. */
export function catalogPhoto(product: Pick<Product, 'name'>): string | null {
  const name = normalise(product.name);
  if (!name) return null;

  const exact = INDEX.find(([key]) => key === name);
  if (exact) return exact[1];

  /* The database may carry extra words the card does not ("2026 CHILV PRO
     WIDE"), so fall back to containment. It has to resolve to exactly one
     card: a row named "CHILV PRO" with no year sits inside four different
     boards, and showing the 2023 deck for the 2026 one is worse than showing
     no photo at all. Ambiguity keeps the placeholder. */
  const partial = INDEX.filter(([key]) => key.length > 3 && (name.includes(key) || key.includes(name)));
  const assets = new Set(partial.map(([, asset]) => asset));
  return assets.size === 1 ? partial[0][1] : null;
}
