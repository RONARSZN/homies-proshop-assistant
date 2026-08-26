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

/* Brand marks land in different places on the two sides. The line sheet writes
   "FOCAL- ONE FIVE SLATE" and "P$$FCL - ONE OUT ANORAK"; the database writes
   "2026 DUP Atlas Pro", with the brand sitting between the year and the model.
   Nothing positional survives that, so names are compared as sets of words
   with the brand words dropped wherever they appear. */
const NOISE = new Set(['DUP', 'DUPWAKE', 'FOCAL', 'PSSFCL', 'FCL', 'P', 'SOUTHBY', 'STHBY']);

const tokens = (value: string): string[] =>
  value
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(word => word && !NOISE.has(word));

const INDEX: ReadonlyArray<readonly [string[], string]> = CATALOG.map(([name, asset]) => [tokens(name), `/products/${asset}.webp`] as const);

const covers = (outer: Set<string>, inner: string[]) => inner.every(word => outer.has(word));

/** Catalogue tile for a product, or null when the line sheet has no card. */
export function catalogPhoto(product: Pick<Product, 'name'>): string | null {
  const words = tokens(product.name);
  if (words.length < 2) return null;
  const set = new Set(words);

  /* Same words, ignoring order and brand, is the strongest signal and settles
     the pairs where one product's name is a subset of another's: "Interstate
     Roller" and "Interstate 81 L Travel Roller" are different bags. */
  const exact = INDEX.filter(([key]) => key.length === words.length && covers(set, key));
  if (new Set(exact.map(([, asset]) => asset)).size === 1) return exact[0][1];

  /* Otherwise one name's words must wholly contain the other's: the database
     adds a brand and sometimes a size, the line sheet sometimes adds "PRO".
     The match has to be unique. A row called "DUP ChilV Pro" with no year is
     inside four different boards, and showing the 2023 deck for the 2026 one
     is worse than showing no photo, so ambiguity keeps the placeholder. The
     year, when both sides carry one, is itself a word — so a 2025 card can
     never cover a 2026 product. */
  const hits = INDEX.filter(([key]) => key.length >= 2 && (covers(set, key) || covers(new Set(key), words)));
  const assets = new Set(hits.map(([, asset]) => asset));
  return assets.size === 1 ? hits[0][1] : null;
}
