import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { shopRepository } from './repository';
import type { Category, Product, Reservation, Sale } from './types';

export interface ShopDataState {
  products: Product[];
  sales: Sale[];
  categories: Category[];
  reservations: Reservation[];
  lastRefresh: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

type ShopDataValues = Omit<ShopDataState, 'refresh'>;
const initialState: ShopDataValues = { products: [], sales: [], categories: [], reservations: [], lastRefresh: '', loading: true, error: null };
const ShopDataContext = createContext<ShopDataState | null>(null);

export function ShopDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShopDataValues>(initialState);
  const refresh = useCallback(async () => {
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const [products, sales, categories, reservations] = await Promise.all([
        shopRepository.getProducts(),
        shopRepository.getSales(),
        shopRepository.getCategories(),
        shopRepository.getReservations(),
      ]);
      setState({ products, sales, categories, reservations, lastRefresh: shopRepository.getLastRefresh(), loading: false, error: null });
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : 'Unknown database error';
      console.error('Shop data refresh failed:', caught);
      setState(current => ({ ...current, loading: false, error: `Live shop data could not be loaded. ${detail}` }));
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refresh]);
  return <ShopDataContext.Provider value={{ ...state, refresh }}>{children}</ShopDataContext.Provider>;
}

export function useShopData() {
  const state = useContext(ShopDataContext);
  if (!state) throw new Error('useShopData must be used inside ShopDataProvider.');
  return state;
}
