import { saleTime } from './domain';
import type { Product, Sale } from './types';

/*
 * A single CSV holding two sections: every sale line in the chosen period,
 * then the inventory position.
 *
 * On the inventory section: it is the position AS AT EXPORT, not as at the
 * end of the period, and that is a limitation of the data rather than a
 * shortcut. Reconstructing a past position means replaying stock_movements,
 * but the 146 imported sales were loaded as historical and never wrote to
 * that ledger. Replaying it would therefore return the opening balance for
 * every date, ignoring every sale ever made. A figure like that is worse
 * than no figure, so the sheet states what it actually is.
 *
 * Numbers are written unformatted so a spreadsheet can sum them. No peso
 * signs, no thousands separators.
 */

const cell = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const row = (values: Array<string | number | null | undefined>) => values.map(cell).join(',');

const SALE_HEADERS = [
  'Sale date', 'Sale time', 'Sale ID', 'Status', 'Source', 'Customer', 'Seller',
  'Payment method', 'Amount paid', 'Balance due', 'Item code', 'Description',
  'Category', 'Brand', 'Size', 'Qty', 'Unit price', 'Line discount', 'Line total',
  'Sale subtotal', 'Sale discount', 'Sale total',
];

const STOCK_HEADERS = [
  'Item code', 'Name', 'Category', 'Brand', 'Size', 'Active',
  'On hand', 'Reserved', 'Available', 'Selling price', 'Inventory value',
  'Units sold in period', 'Units sold all time',
];

export function buildSalesSheet(sales: Sale[], products: Product[], periodLabel: string): string {
  const sizeOf = new Map(products.map(product => [product.id, product.size]));
  const soldInPeriod = new Map<string, number>();

  const lines: string[] = [];
  lines.push(row(['Homies Proshop — sales and inventory export']));
  lines.push(row(['Period', periodLabel]));
  lines.push(row(['Generated', new Date().toLocaleString('en-PH')]));
  lines.push(row(['Sales in period', sales.length]));
  lines.push('');

  lines.push(row(['SALES LINES']));
  lines.push(row(SALE_HEADERS));
  sales.forEach(sale => sale.items.forEach(item => {
    if (item.productId) soldInPeriod.set(item.productId, (soldInPeriod.get(item.productId) || 0) + item.qty);
    lines.push(row([
      sale.date,
      saleTime(sale) ?? 'not recorded on import',
      sale.id,
      sale.status,
      sale.isHistorical ? 'Imported' : 'POS',
      sale.customerName ?? 'Walk-in',
      sale.sellerName ?? sale.sellerNote ?? '',
      sale.paymentMethod ?? '',
      sale.amountPaid,
      sale.balanceDue,
      item.sku ?? '',
      item.description,
      item.category ?? '',
      item.brand ?? '',
      item.productId ? sizeOf.get(item.productId) ?? '' : '',
      item.qty,
      item.unitPrice,
      item.discount,
      item.lineTotal,
      sale.subtotal,
      sale.discount,
      sale.total,
    ]));
  }));
  if (!sales.length) lines.push(row(['No sales in this period']));

  lines.push('');
  lines.push(row(['INVENTORY — position as at export, not as at the end of the period']));
  lines.push(row(['Imported sales were loaded without stock movements, so a past position cannot be reconstructed from the ledger.']));
  lines.push(row(STOCK_HEADERS));
  [...products]
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name) || a.size.localeCompare(b.size))
    .forEach(product => lines.push(row([
      product.sku,
      product.name,
      product.category,
      product.brand,
      product.size,
      product.isActive ? 'yes' : 'no',
      product.qty,
      product.reservedQty,
      product.qty - product.reservedQty,
      product.price,
      product.price === null ? '' : product.qty * product.price,
      soldInPeriod.get(product.id) ?? 0,
      product.sold,
    ])));

  return lines.join('\r\n');
}

/** Excel needs the BOM to read the peso sign and accented names as UTF-8. */
export function downloadSheet(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const sheetFilename = (periodLabel: string) =>
  `homies-sales-${periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
