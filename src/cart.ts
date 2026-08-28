import type { CartLine, Product } from './types';

/* Reserved units are held for a named customer, so they are not on the shelf
   to sell. Every screen that offers a product for sale asks this, so the sum
   lives here rather than being re-derived at each call site. */
export const availableOf = (product: Product): number => Math.max(0, product.qty - product.reservedQty);

/* A cart line is keyed by product id — one row per exact size, because a size
   is its own product row with its own stock and price. Adding a product that
   is already in the cart raises its quantity instead of opening a second row,
   which is what a counter expects when the same board is scanned twice. */
export function addLine(lines: CartLine[], product: Product, qty = 1): CartLine[] {
  if (qty <= 0) return lines;
  const available = availableOf(product);
  if (product.price === null || available === 0) return lines;
  const existing = lines.find(line => line.productId === product.id);
  if (!existing) return [...lines, { productId: product.id, qty: Math.min(qty, available), unitPrice: product.price, discount: 0 }];
  return lines.map(line => line.productId === product.id
    ? { ...line, qty: Math.min(line.qty + qty, available) }
    : line);
}

/* Zero is the remove gesture: the stepper's minus at one unit and the sheet's
   ✕ are the same operation, so they share one path and a zero-quantity line
   can never be stored. */
export function setLineQty(lines: CartLine[], productId: string, qty: number): CartLine[] {
  if (qty <= 0) return removeLine(lines, productId);
  return lines.map(line => line.productId === productId ? { ...line, qty } : line);
}

export function setLineDiscount(lines: CartLine[], productId: string, discount: number): CartLine[] {
  return lines.map(line => line.productId === productId
    ? { ...line, discount: Math.min(Math.max(0, Number.isFinite(discount) ? discount : 0), line.qty * line.unitPrice) }
    : line);
}

export const removeLine = (lines: CartLine[], productId: string): CartLine[] => lines.filter(line => line.productId !== productId);

export const lineTotal = (line: CartLine): number => line.qty * line.unitPrice - line.discount;
export const cartSubtotal = (lines: CartLine[]): number => lines.reduce((sum, line) => sum + lineTotal(line), 0);
export const cartCount = (lines: CartLine[]): number => lines.reduce((sum, line) => sum + line.qty, 0);
