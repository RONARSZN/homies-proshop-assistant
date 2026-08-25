import type { Product, Sale } from './types';

export type DuplicateGroup = { sku: string; rows: Product[]; kind: 'same-product' | 'identity-collision' };
export type DataQuality = {
  duplicateGroups: DuplicateGroup[];
  missingPriceRows: Product[];
  missingCostRows: Product[];
  missingReceivedRows: Product[];
  orphanSales: Sale[];
  issueCount: number;
};

export function buildDataQuality(products: Product[], sales: Sale[]): DataQuality {
  const grouped = new Map<string, Product[]>();
  products.forEach(product => grouped.set(product.sku, [...(grouped.get(product.sku) || []), product]));
  const duplicateGroups = [...grouped.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([sku, rows]) => ({ sku, rows, kind: new Set(rows.map(row => row.name)).size > 1 ? 'identity-collision' as const : 'same-product' as const }));
  const orphanSales = sales.filter(sale => sale.items.some(item => item.productId === null));
  const missingPriceRows = products.filter(product => product.price === null);
  const missingCostRows = products.filter(product => product.cost === null);
  const missingReceivedRows = products.filter(product => !product.received);
  const issueCount = duplicateGroups.length + missingPriceRows.length + (missingCostRows.length ? 1 : 0) + (missingReceivedRows.length ? 1 : 0) + orphanSales.length;
  return { duplicateGroups, missingPriceRows, missingCostRows, missingReceivedRows, orphanSales, issueCount };
}
