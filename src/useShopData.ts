import { useEffect, useState } from 'react';
import { shopRepository } from './repository';
import type { Product, Sale } from './types';

export function useShopData() {
  const [state, setState] = useState<{ products: Product[]; sales: Sale[]; snapshotDate: string; loading: boolean; error: string | null }>({ products: [], sales: [], snapshotDate: '', loading: true, error: null });
  useEffect(() => {
    let active = true;
    Promise.all([shopRepository.getProducts(), shopRepository.getSales()]).then(([products, sales]) => {
      if (active) setState({ products, sales, snapshotDate: shopRepository.getSnapshotDate(), loading: false, error: null });
    }).catch(() => {
      if (active) setState(current => ({ ...current, loading: false, error: 'The shop snapshot could not be loaded.' }));
    });
    return () => { active = false; };
  }, []);
  return state;
}
