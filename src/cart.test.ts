import { describe, expect, it } from 'vitest';
import { addLine, availableOf, cartCount, cartSubtotal, lineTotal, removeLine, setLineDiscount, setLineQty } from './cart';
import type { CartLine, Product } from './types';

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1', sku: 'SKU1', name: 'Board', category: 'BOARDS', categoryId: 'c1',
  brand: 'Ronix', size: '142', color: 'Black', cost: 100, price: 200,
  supplier: '—', received: '2026-01-01', isActive: true, qty: 5, reservedQty: 1,
  sold: 0, image: 'board.jpg', imagePath: null, imageUrl: null, ...over,
} as Product);

describe('availableOf', () => {
  it('excludes reserved units', () => {
    expect(availableOf(product({ qty: 5, reservedQty: 1 }))).toBe(4);
  });
  it('never reports a negative count', () => {
    expect(availableOf(product({ qty: 1, reservedQty: 4 }))).toBe(0);
  });
});

describe('addLine', () => {
  it('adds a new line at the product price', () => {
    expect(addLine([], product())).toEqual([{ productId: 'p1', qty: 1, unitPrice: 200, discount: 0 }]);
  });
  it('increments an existing line instead of duplicating it', () => {
    const once = addLine([], product());
    expect(addLine(once, product())).toEqual([{ productId: 'p1', qty: 2, unitPrice: 200, discount: 0 }]);
  });
  it('caps the quantity at what is available', () => {
    const lines = addLine([], product({ qty: 2, reservedQty: 0 }), 9);
    expect(lines[0].qty).toBe(2);
  });
  it('refuses a product with no price', () => {
    expect(addLine([], product({ price: null }))).toEqual([]);
  });
  it('refuses a product with nothing available', () => {
    expect(addLine([], product({ qty: 1, reservedQty: 1 }))).toEqual([]);
  });
});

describe('setLineQty', () => {
  const lines: CartLine[] = [{ productId: 'p1', qty: 2, unitPrice: 200, discount: 0 }];
  it('changes the quantity', () => {
    expect(setLineQty(lines, 'p1', 3)[0].qty).toBe(3);
  });
  it('drops the line when the quantity reaches zero', () => {
    expect(setLineQty(lines, 'p1', 0)).toEqual([]);
  });
  it('drops the line on a negative quantity rather than storing one', () => {
    expect(setLineQty(lines, 'p1', -2)).toEqual([]);
  });
});

describe('setLineDiscount', () => {
  it('never lets a discount exceed the line value', () => {
    const lines: CartLine[] = [{ productId: 'p1', qty: 2, unitPrice: 200, discount: 0 }];
    expect(setLineDiscount(lines, 'p1', 900)[0].discount).toBe(400);
  });
  it('clamps a negative discount to zero', () => {
    const lines: CartLine[] = [{ productId: 'p1', qty: 1, unitPrice: 200, discount: 0 }];
    expect(setLineDiscount(lines, 'p1', -5)[0].discount).toBe(0);
  });
});

describe('totals', () => {
  const lines: CartLine[] = [
    { productId: 'p1', qty: 2, unitPrice: 200, discount: 50 },
    { productId: 'p2', qty: 1, unitPrice: 120, discount: 0 },
  ];
  it('totals one line net of its discount', () => {
    expect(lineTotal(lines[0])).toBe(350);
  });
  it('sums every line', () => {
    expect(cartSubtotal(lines)).toBe(470);
  });
  it('counts units, not lines', () => {
    expect(cartCount(lines)).toBe(3);
  });
  it('totals an empty cart as zero', () => {
    expect(cartSubtotal([])).toBe(0);
  });
});

describe('removeLine', () => {
  it('removes only the named product', () => {
    const lines: CartLine[] = [
      { productId: 'p1', qty: 1, unitPrice: 200, discount: 0 },
      { productId: 'p2', qty: 1, unitPrice: 120, discount: 0 },
    ];
    expect(removeLine(lines, 'p1').map(line => line.productId)).toEqual(['p2']);
  });
});
