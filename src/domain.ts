import type { Product, Sale } from './types';

export type Status = 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Slow Moving' | 'Data Missing';

export const formatPeso = (value: number | null | undefined) => value === null || value === undefined ? '—' : `₱${Math.round(value).toLocaleString('en-PH')}`;
export const statusFor = (product: Product): Status => {
  const source = (product.sourceStatus || '').toLowerCase();
  if (source.includes('out of stock')) return 'Out of Stock';
  if (source.includes('restock') || source.includes('low stock')) return 'Low Stock';
  if (source.includes('slow')) return 'Slow Moving';
  if (source.includes('missing')) return 'Data Missing';
  return product.qty === 0 ? 'Out of Stock' : product.qty <= 2 ? 'Low Stock' : product.sold < 5 ? 'Slow Moving' : 'In Stock';
};
export const marginFor = (product: Product) => product.cost === null || product.cost === 0 || product.price === null ? null : product.price - product.cost;
export const saleTotal = (sale: Sale) => sale.total;
export const latestSaleDate = (sales: Sale[]) => sales.reduce<string | null>((latest, sale) => !latest || sale.date > latest ? sale.date : latest, null);
export const reportingPeriod = (sales: Sale[]) => {
  const latest = latestSaleDate(sales);
  if (!latest) return { label: 'No sales period', sales: [] as Sale[] };
  const key = latest.slice(0, 7);
  const date = new Date(`${key}-01T00:00:00`);
  return { label: date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }), sales: sales.filter(sale => sale.date.startsWith(key)) };
};
/* ---------------------------------------------------------- month analytics
   The overview reports the CURRENT calendar month, not the month of the last
   recorded sale. reportingPeriod stays as-is for the Sales page, where the
   latest-sale framing is still what you want when browsing history. */

export const monthKeyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export const monthLabelOf = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

/** Voided sales are excluded: they are not revenue and never were. */
export const salesInMonth = (sales: Sale[], key: string) =>
  sales.filter(sale => sale.status === 'completed' && sale.date.startsWith(key));

export type MonthTotals = { revenue: number; units: number; transactions: number };
export const monthTotals = (sales: Sale[], key: string): MonthTotals => {
  const rows = salesInMonth(sales, key);
  return {
    revenue: rows.reduce((sum, sale) => sum + (saleTotal(sale) || 0), 0),
    units: rows.reduce((sum, sale) => sum + sale.qty, 0),
    transactions: rows.length,
  };
};

/** Ranked by units actually sold this month, not all-time product.sold. */
export const topSellersInMonth = (sales: Sale[], key: string) => {
  const units = new Map<string, { name: string; sku: string; qty: number }>();
  salesInMonth(sales, key).forEach(sale => sale.items.forEach(item => {
    const id = item.productId || `unmatched:${item.description}`;
    const entry = units.get(id) || { name: item.description, sku: item.sku || '—', qty: 0 };
    entry.qty += item.qty;
    units.set(id, entry);
  }));
  return [...units.entries()].map(([id, value]) => ({ id, ...value })).sort((a, b) => b.qty - a.qty);
};

export const inventoryValue = (products: Product[]) => products.reduce((sum, product) => sum + (product.qty * (product.price || 0)), 0);
export const activeSkuCount = (products: Product[]) => products.filter(product => product.qty > 0).length;
export const attentionCount = (products: Product[]) => products.filter(product => statusFor(product) === 'Slow Moving' || statusFor(product) === 'Data Missing').length;
export const bestSellers = (products: Product[]) => [...products].sort((a, b) => b.sold - a.sold);
export const productsWithZeroPriceInStock = (products: Product[]) => products.filter(product => product.qty > 0 && product.price === 0).length;
export const duplicateSkuRows = (products: Product[]) => {
  const counts = new Map<string, number>();
  products.forEach(product => counts.set(product.sku, (counts.get(product.sku) || 0) + 1));
  return [...counts.entries()].filter(([, count]) => count > 1);
};
