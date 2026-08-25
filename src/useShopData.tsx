import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { shopRepository } from './repository';
import type { Product, Sale } from './types';

export interface ShopDataState {
  products: Product[];
  sales: Sale[];
  categories: string[];
  snapshotDate: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

type ShopDataValues = Omit<ShopDataState, 'refresh'>;
const initialState: ShopDataValues = { products: [], sales: [], categories: [], snapshotDate: '', loading: true, error: null };
const ShopDataContext = createContext<ShopDataState | null>(null);

export function ShopDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShopDataValues>(initialState);
  const refresh = useCallback(async () => {
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const [products, sales, categories] = await Promise.all([
        shopRepository.getProducts(),
        shopRepository.getSales(),
        shopRepository.getCategories(),
      ]);
      setState({ products, sales, categories, snapshotDate: shopRepository.getSnapshotDate(), loading: false, error: null });
    } catch {
      setState(current => ({ ...current, loading: false, error: 'The shop snapshot could not be loaded.' }));
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <ShopDataContext.Provider value={{ ...state, refresh }}>{children}</ShopDataContext.Provider>;
}

export function useShopData() {
  const state = useContext(ShopDataContext);
  if (!state) throw new Error('useShopData must be used inside ShopDataProvider.');
  return state;
}
