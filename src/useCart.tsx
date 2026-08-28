import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { addLine, cartCount, cartSubtotal, isValidCartLine, removeLine, setLineDiscount, setLineQty } from './cart';
import type { CartLine, Product } from './types';

const STORAGE_KEY = 'homies.cart';

/* The counter loses its network and its tab. A cart half-built when the phone
   sleeps has to still be there on wake, so the lines are mirrored to local
   storage on every change. Storage is per device on purpose — this is one
   staffer's basket at one till, not shop state. */
function readStored(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidCartLine);
  } catch {
    return [];
  }
}

export interface CartState {
  lines: CartLine[];
  count: number;
  subtotal: number;
  open: boolean;
  add: (product: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  setDiscount: (productId: string, discount: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readStored);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); } catch { /* private mode; the cart still works in memory */ }
  }, [lines]);

  const add = useCallback((product: Product, qty = 1) => setLines(current => addLine(current, product, qty)), []);
  const setQty = useCallback((productId: string, qty: number) => setLines(current => setLineQty(current, productId, qty)), []);
  const setDiscount = useCallback((productId: string, discount: number) => setLines(current => setLineDiscount(current, productId, discount)), []);
  const remove = useCallback((productId: string) => setLines(current => removeLine(current, productId)), []);
  const clear = useCallback(() => setLines([]), []);
  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => setOpen(false), []);

  const value = useMemo<CartState>(() => ({
    lines, count: cartCount(lines), subtotal: cartSubtotal(lines), open,
    add, setQty, setDiscount, remove, clear, openCart, closeCart,
  }), [lines, open, add, setQty, setDiscount, remove, clear, openCart, closeCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const state = useContext(CartContext);
  if (!state) throw new Error('useCart must be used inside CartProvider.');
  return state;
}
