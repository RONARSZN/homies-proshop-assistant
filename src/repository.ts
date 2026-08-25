import { liveProducts, liveSales } from './data/live-data';
import { snapshotDate } from './data/source-meta';
import type { Product, Sale } from './types';

export interface ShopRepository {
  getProducts(): Promise<Product[]>;
  getSales(): Promise<Sale[]>;
  getSnapshotDate(): string;
}

export const shopRepository: ShopRepository = {
  async getProducts() { return liveProducts as Product[]; },
  async getSales() { return liveSales as Sale[]; },
  getSnapshotDate() { return snapshotDate; },
};
