import { latestSaleDate } from './domain';
import type { Product, Sale } from './types';

export type DuplicateGroup = { sku: string; rows: Product[]; kind: 'same-product' | 'identity-collision' };
export type DataQuality = {
  duplicateGroups: DuplicateGroup[];
  missingPriceRows: Product[];
  missingCostRows: Product[];
  missingReceivedRows: Product[];
  orphanSales: Sale[];
  reconciliation: { sku: string; productSold: number; salesQty: number }[];
  stale: { latestSale: string | null; snapshotDate: string; daysBehind: number | null };
  issueCount: number;
};

export function buildDataQuality(products: Product[], sales: Sale[], snapshotDate: string): DataQuality {
  const grouped = new Map<string, Product[]>();
  products.forEach(product => grouped.set(product.sku, [...(grouped.get(product.sku) || []), product]));
  const duplicateGroups = [...grouped.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([sku, rows]) => ({ sku, rows, kind: new Set(rows.map(row => row.name)).size > 1 ? 'identity-collision' as const : 'same-product' as const }));
  const salesBySku = new Map<string, number>();
  sales.forEach(sale => salesBySku.set(sale.sku, (salesBySku.get(sale.sku) || 0) + sale.qty));
  const reconciliation = [...grouped.entries()]
    .map(([sku, rows]) => ({ sku, productSold: rows.reduce((sum, row) => sum + row.sold, 0), salesQty: salesBySku.get(sku) || 0 }))
    .filter(row => row.productSold !== row.salesQty);
  const productSkus = new Set(products.map(product => product.sku));
  const orphanSales = sales.filter(sale => !productSkus.has(sale.sku));
  const latestSale = latestSaleDate(sales);
  const daysBehind = latestSale && snapshotDate ? Math.round((Date.parse(snapshotDate) - Date.parse(latestSale)) / 86400000) : null;
  const stale = { latestSale, snapshotDate, daysBehind };
  const missingPriceRows = products.filter(product => product.price === null || product.price === 0);
  const missingCostRows = products.filter(product => product.cost === null);
  const missingReceivedRows = products.filter(product => !product.received);
  const issueCount = duplicateGroups.length + missingPriceRows.length + (missingCostRows.length ? 1 : 0) + (missingReceivedRows.length ? 1 : 0) + orphanSales.length + reconciliation.length + (daysBehind !== null && daysBehind < 0 ? 1 : 0);
  return { duplicateGroups, missingPriceRows, missingCostRows, missingReceivedRows, orphanSales, reconciliation, stale, issueCount };
}
