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
export const saleTotal = (sale: Sale) => sale.price === null ? null : sale.qty * sale.price - (sale.discount || 0);
export const latestSaleDate = (sales: Sale[]) => sales.reduce<string | null>((latest, sale) => !latest || sale.date > latest ? sale.date : latest, null);
export const reportingPeriod = (sales: Sale[]) => {
  const latest = latestSaleDate(sales);
  if (!latest) return { label: 'No sales period', sales: [] as Sale[] };
  const key = latest.slice(0, 7);
  const date = new Date(`${key}-01T00:00:00`);
  return { label: date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }), sales: sales.filter(sale => sale.date.startsWith(key)) };
};
export const inventoryValue = (products: Product[]) => products.reduce((sum, product) => sum + (product.qty * (product.price || 0)), 0);
export const activeSkuCount = (products: Product[]) => products.filter(product => product.qty > 0).length;
export const attentionCount = (products: Product[]) => products.filter(product => statusFor(product) === 'Low Stock' || statusFor(product) === 'Out of Stock').length;
export const bestSellers = (products: Product[]) => [...products].sort((a, b) => b.sold - a.sold);
export const productsWithZeroPriceInStock = (products: Product[]) => products.filter(product => product.qty > 0 && product.price === 0).length;
export const duplicateSkuRows = (products: Product[]) => {
  const counts = new Map<string, number>();
  products.forEach(product => counts.set(product.sku, (counts.get(product.sku) || 0) + 1));
  return [...counts.entries()].filter(([, count]) => count > 1);
};
