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
  status: 'completed' | 'voided';
  isHistorical: boolean;
  items: SaleItem[];
};

export type Profile = { id: string; fullName: string; role: Role };

export type StockMovement = {
  id: string;
  productId: string;
  delta: number;
  reason: 'opening_balance' | 'sale' | 'return' | 'receipt' | 'adjustment' | 'write_off';
  referenceId: string | null;
  note: string | null;
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
