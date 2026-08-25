export type Role = 'owner' | 'manager' | 'staff';

export type Category = { id: string; name: string; sortOrder: number };

export type Product = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  categoryId: string;
  size: string;
  color: string;
  qty: number;
  cost: number | null;
  price: number | null;
  sold: number;
  received: string;
  supplier: string;
  image: string;
  /** Object path in the product-photos bucket. Null means no photo captured. */
  imagePath: string | null;
  /** Short-lived signed URL for imagePath, resolved on load. Null when absent. */
  imageUrl: string | null;
  sourceStatus?: string;
  isActive: boolean;
};

export type SaleItem = {
  id: string;
  productId: string | null;
  description: string;
  sku: string | null;
  brand: string | null;
  qty: number;
  unitPrice: number | null;
  discount: number | null;
  lineTotal: number | null;
};

export type Sale = {
  id: string;
  date: string;
  product: string;
  sku: string;
  qty: number;
  price: number | null;
  discount: number | null;
  category: string;
  brand: string;
  subtotal: number | null;
  total: number | null;
  paymentMethod: string | null;
  /** Optional name taken at the counter. Null means not given. */
  customerName: string | null;
  /** Display name of the staff member who rang up the sale, from created_by. */
  sellerName: string | null;
  /** Seller name from an imported sheet, where created_by is unknown. */
  sellerNote: string | null;
  status: 'completed' | 'voided';
  isHistorical: boolean;
  items: SaleItem[];
};

export type Profile = { id: string; fullName: string; role: Role };

export type MovementReason = 'opening_balance' | 'sale' | 'return' | 'receipt' | 'adjustment' | 'write_off' | 'allocation';

export type StockMovement = {
  id: string;
  productId: string;
  delta: number;
  reason: MovementReason;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
  riderId: string | null;
};

export type TeamRider = {
  id: string;
  fullName: string;
  nickname: string | null;
  team: string;
  note: string | null;
  isActive: boolean;
  createdAt: string;
};

/** One line of a rider's gear history. */
export type RiderAllocation = {
  id: string;
  riderId: string;
  productId: string | null;
  /** Product name where the item code matched a product, else the raw code. */
  productName: string;
  itemCode: string;
  size: string | null;
  qty: number;
  allocatedAt: string | null;
  note: string | null;
  /** Imported from the workbook: never moved stock and never should. */
  isHistorical: boolean;
  createdAt: string;
};

export type CartLine = { productId: string; qty: number; unitPrice: number; discount: number };

export type ProductInput = {
  sku: string;
  name: string;
  categoryId: string;
  brand: string | null;
  size: string | null;
  color: string | null;
  cost: number | null;
  price: number | null;
  supplier: string | null;
  received: string | null;
  openingQuantity: number;
};

export type Note = { id: number; text: string; date: string; pinned: boolean; archived: boolean };
