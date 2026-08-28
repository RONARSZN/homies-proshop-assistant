import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CartProvider, useCart } from './useCart';
import type { Product } from './types';

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1', sku: 'SKU1', name: 'Board', category: 'BOARDS', categoryId: 'c1',
  brand: 'Ronix', size: '142', color: 'Black', cost: 100, price: 200,
  supplier: '—', received: '2026-01-01', isActive: true, qty: 5, reservedQty: 0,
  sold: 0, image: 'board.jpg', imagePath: null, imageUrl: null, ...over,
} as Product);

let cart: ReturnType<typeof useCart>;
function Probe() {
  cart = useCart();
  return <span data-testid="count">{cart.count}</span>;
}
const mount = () => render(<CartProvider><Probe/></CartProvider>);

beforeEach(() => window.localStorage.clear());

describe('CartProvider', () => {
  it('starts empty', () => {
    mount();
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('adds a product and counts its units', () => {
    mount();
    act(() => cart.add(product()));
    act(() => cart.add(product()));
    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(cart.subtotal).toBe(400);
  });

  it('persists the cart across a remount', () => {
    const first = mount();
    act(() => cart.add(product()));
    first.unmount();
    mount();
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('clears the cart and the stored copy', () => {
    mount();
    act(() => cart.add(product()));
    act(() => cart.clear());
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(window.localStorage.getItem('homies.cart')).toBe('[]');
  });

  it('survives corrupt stored data', () => {
    window.localStorage.setItem('homies.cart', 'not json');
    mount();
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('opens and closes the sheet', () => {
    mount();
    expect(cart.open).toBe(false);
    act(() => cart.openCart());
    expect(cart.open).toBe(true);
    act(() => cart.closeCart());
    expect(cart.open).toBe(false);
  });

  it('throws when used outside the provider', () => {
    expect(() => render(<Probe/>)).toThrow(/CartProvider/);
  });
});
