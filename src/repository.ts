import { liveProducts, liveSales } from './data/live-data';
import { snapshotDate } from './data/source-meta';
import type { Product, Sale } from './types';

export interface ShopRepository {
  getProducts(): Promise<Product[]>;
  getSales(): Promise<Sale[]>;
  getSnapshotDate(): string;
}

export const shopRepository: ShopRepository = {
  async getProducts() { return liveProducts.map(product => ({ ...product, cost: product.cost === 0 ? null : product.cost })); },
  async getSales() { return liveSales.map(sale => ({ ...sale })); },
  getSnapshotDate() { return snapshotDate; },
};
