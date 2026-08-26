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

export type CategorySales = { category: string; revenue: number; units: number; transactions: number };
export const salesByCategoryInMonth = (sales: Sale[], key: string): CategorySales[] => {
  const grouped = new Map<string, { revenue: number; units: number; saleIds: Set<string> }>();
  salesInMonth(sales, key).forEach(sale => sale.items.forEach(item => {
    if (!item.category) return;
    const category = item.category;
    const entry = grouped.get(category) || { revenue: 0, units: 0, saleIds: new Set<string>() };
    entry.revenue += item.lineTotal || 0;
    entry.units += item.qty;
    entry.saleIds.add(sale.id);
    grouped.set(category, entry);
  }));
  return [...grouped.entries()]
    .map(([category, value]) => ({ category, revenue: value.revenue, units: value.units, transactions: value.saleIds.size }))
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units || a.category.localeCompare(b.category));
};

export const inventoryValue = (products: Product[]) => products.reduce((sum, product) => sum + (product.qty * (product.price || 0)), 0);
export const activeSkuCount = (products: Product[]) => products.filter(product => product.qty > 0).length;
export const attentionCount = (products: Product[]) => products.filter(product => statusFor(product) === 'Slow Moving' || statusFor(product) === 'Data Missing').length;
export const productsWithZeroPriceInStock = (products: Product[]) => products.filter(product => product.qty > 0 && product.price === 0).length;
