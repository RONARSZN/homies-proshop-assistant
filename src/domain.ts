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

/**
 * Time of sale, shown only when it is real. Every imported row was given a
 * placeholder noon on import, so rendering a clock time for those would dress
 * a guess up as a record.
 */
export const saleTime = (sale: Sale): string | null =>
  sale.isHistorical ? null
    : new Date(sale.soldAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
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

/* ------------------------------------------------------ headline period
   The overview's headline figures answer "how are we doing", which is asked
   about a month, a quarter or a season depending on who is asking. So the
   period is chosen rather than pinned to the current calendar month. */

export type Period = { type: 'range'; key: RangeKey } | { type: 'month'; key: string };

export const encodePeriod = (p: Period) => `${p.type}:${p.key}`;
export const decodePeriod = (value: string): Period => {
  const [type, key] = value.split(':');
  return type === 'month' ? { type: 'month', key } : { type: 'range', key: key as RangeKey };
};

/** Months that actually contain completed sales, newest first. */
export const monthsWithSales = (sales: Sale[]): string[] =>
  [...new Set(sales.filter(sale => sale.status === 'completed').map(sale => sale.date.slice(0, 7)))]
    .sort().reverse();

/**
 * Months offered in the period picker: every month with sales, plus the
 * current one whether or not it has any yet. Without that union the current
 * month would vanish from the list until its first sale — you would land on
 * it by default on the 1st, switch away, and be unable to switch back.
 */
export const selectableMonths = (sales: Sale[], now = new Date()): string[] =>
  [...new Set([...monthsWithSales(sales), monthKeyOf(now)])].sort().reverse();

export const periodLabelOf = (p: Period) =>
  p.type === 'month' ? monthLabelOf(p.key) : RANGE_LABELS[p.key];

export const salesForPeriod = (sales: Sale[], p: Period): Sale[] =>
  p.type === 'month' ? salesInMonth(sales, p.key) : completedSince(sales, rangeStart(p.key));

export const totalsOf = (rows: Sale[]): MonthTotals => ({
  revenue: rows.reduce((sum, sale) => sum + (saleTotal(sale) || 0), 0),
  units: rows.reduce((sum, sale) => sum + sale.qty, 0),
  transactions: rows.length,
});

/** Revenue, units and transaction reach per category for a set of sales. */
export const categoryBreakdown = (rows: Sale[]): CategorySales[] => {
  const grouped = new Map<string, { revenue: number; units: number; saleIds: Set<string> }>();
  rows.forEach(sale => sale.items.forEach(item => {
    if (!item.category) return;
    const entry = grouped.get(item.category) || { revenue: 0, units: 0, saleIds: new Set<string>() };
    entry.revenue += item.lineTotal || 0;
    entry.units += item.qty;
    entry.saleIds.add(sale.id);
    grouped.set(item.category, entry);
  }));
  return [...grouped.entries()]
    .map(([category, v]) => ({ category, revenue: v.revenue, units: v.units, transactions: v.saleIds.size }))
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units || a.category.localeCompare(b.category));
};

/* ------------------------------------------------------- range charts
   Cards on the overview each carry their own window, because "what sold
   best" and "which sizes move" are questions asked over a season, not over
   whatever happens to have been rung up this month. */

export type RangeKey = '1m' | '3m' | '6m' | '12m' | 'all';
export const RANGE_LABELS: Record<RangeKey, string> = {
  '1m': 'Last 30 days', '3m': 'Last 3 months', '6m': 'Last 6 months',
  '12m': 'Last 12 months', 'all': 'All time',
};

/** ISO date the window opens on, or null for all time. */
export const rangeStart = (key: RangeKey, now = new Date()): string | null => {
  if (key === 'all') return null;
  const months = key === '1m' ? 0 : Number(key.replace('m', ''));
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === '1m') from.setDate(from.getDate() - 30); else from.setMonth(from.getMonth() - months);
  return `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
};

export const completedSince = (sales: Sale[], start: string | null) =>
  sales.filter(sale => sale.status === 'completed' && (!start || sale.date >= start));

export type ChartRow = { key: string; label: string; qty: number; title?: string };

/** Units sold per item code within one category, for a set of sales. */
export const bestSellersInCategory = (rows: Sale[], category: string, limit = 6): ChartRow[] => {
  const totals = new Map<string, ChartRow>();
  rows.forEach(sale => sale.items.forEach(item => {
    if (item.category !== category) return;
    // Keyed on item code. Each size variant is its own code, which is the
    // level a restock decision is actually made at. Lines with no code are
    // imported history that was never matched to a product; they keep their
    // description rather than being dropped from the count.
    const code = (item.sku || '').trim();
    const key = code ? code.toLowerCase() : `text:${item.description.trim().toLowerCase()}`;
    const row = totals.get(key) || {
      key,
      label: code || item.description.trim(),
      title: code ? `${item.description.trim()} · ${code}` : `${item.description.trim()} — no item code`,
      qty: 0,
    };
    row.qty += item.qty;
    totals.set(key, row);
  }));
  return [...totals.values()].sort((a, b) => b.qty - a.qty || a.label.localeCompare(b.label)).slice(0, limit);
};

/* Sizes must sort the way a rack is laid out, not alphabetically: vests are
   lettered (XS→XXL) while boards and boots are numeric, and localeCompare
   alone puts L before M before S, which is nonsense on a size chart. */
const LETTER_SIZES = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'];
const sizeRank = (value: string) => {
  const text = value.trim().toLowerCase();
  const letter = LETTER_SIZES.indexOf(text);
  if (letter >= 0) return letter;
  const n = parseFloat(text);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : 1000 + n;
};

/**
 * Units sold per size. Size lives on the product, not the sale line, so a
 * line with no product cannot be sized — those are counted separately rather
 * than dropped, because a silent undercount is worse than a stated gap.
 */
export const sizeMixInCategory = (rows: Sale[], products: Product[], category: string) => {
  const sizeOf = new Map(products.map(product => [product.id, product.size]));
  const totals = new Map<string, ChartRow>();
  let unlinked = 0;
  rows.forEach(sale => sale.items.forEach(item => {
    if (item.category !== category) return;
    const size = item.productId ? sizeOf.get(item.productId) : undefined;
    if (!size || size === '—') { unlinked += item.qty; return; }
    const row = totals.get(size) || { key: size, label: size, qty: 0 };
    row.qty += item.qty;
    totals.set(size, row);
  }));
  const sized = [...totals.values()].sort((a, b) => sizeRank(a.label) - sizeRank(b.label) || a.label.localeCompare(b.label));
  return { rows: sized, unlinked };
};

export const inventoryValue = (products: Product[]) => products.reduce((sum, product) => sum + (product.qty * (product.price || 0)), 0);
export const activeSkuCount = (products: Product[]) => products.filter(product => product.qty > 0).length;
export const productsWithZeroPriceInStock = (products: Product[]) => products.filter(product => product.qty > 0 && product.price === 0).length;
