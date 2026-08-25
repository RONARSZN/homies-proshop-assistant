import type { Product, Sale } from './types';

export type DuplicateGroup = { sku: string; rows: Product[]; kind: 'same-product' | 'identity-collision' };
export type DataQuality = {
  duplicateGroups: DuplicateGroup[];
  missingPriceRows: Product[];
  unmatchedSales: Sale[];
  issueCount: number;
};

/**
 * Unit cost and received date are deliberately not tracked as issues: the shop
 * does not keep them, so flagging 354 rows for each would bury the problems
 * that can actually be acted on.
 *
 * Unmatched sale lines are only counted on NON-historical sales. The imported
 * Google Sheet rows were never matched to products and never will be — that is
 * closed history. Any unmatched line on a sale rung up in this app is a real
 * defect, because the POS always writes a product reference.
 */
export function buildDataQuality(products: Product[], sales: Sale[]): DataQuality {
  const grouped = new Map<string, Product[]>();
  products.forEach(product => grouped.set(product.sku, [...(grouped.get(product.sku) || []), product]));
  const duplicateGroups = [...grouped.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([sku, rows]) => ({ sku, rows, kind: new Set(rows.map(row => row.name)).size > 1 ? 'identity-collision' as const : 'same-product' as const }));

  const missingPriceRows = products.filter(product => product.price === null);
  const unmatchedSales = sales.filter(sale => !sale.isHistorical && sale.items.some(item => item.productId === null));

  const issueCount = duplicateGroups.length + missingPriceRows.length + unmatchedSales.length;
  return { duplicateGroups, missingPriceRows, unmatchedSales, issueCount };
}
