import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { shopRepository } from './repository';
import type { Product, Sale } from './types';

export interface ShopDataState {
  products: Product[];
  sales: Sale[];
  snapshotDate: string;
  loading: boolean;
  error: string | null;
}

const initialState: ShopDataState = { products: [], sales: [], snapshotDate: '', loading: true, error: null };
const ShopDataContext = createContext<ShopDataState | null>(null);

export function ShopDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShopDataState>(initialState);
  useEffect(() => {
    let active = true;
    Promise.all([shopRepository.getProducts(), shopRepository.getSales()]).then(([products, sales]) => {
      if (active) setState({ products, sales, snapshotDate: shopRepository.getSnapshotDate(), loading: false, error: null });
    }).catch(() => {
      if (active) setState(current => ({ ...current, loading: false, error: 'The shop snapshot could not be loaded.' }));
    });
    return () => { active = false; };
  }, []);
  return <ShopDataContext.Provider value={state}>{children}</ShopDataContext.Provider>;
}

export function useShopData() {
  const state = useContext(ShopDataContext);
  if (!state) throw new Error('useShopData must be used inside ShopDataProvider.');
  return state;
}
