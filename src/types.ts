export type Role = 'admin' | 'staff';
export type ProfileStatus = 'pending' | 'active' | 'rejected';

export type RangeKey = '1m' | '3m' | '6m' | '12m' | 'all';
/** Reporting window for the overview: a preset range, or one calendar month. */
export type Period = { type: 'range'; key: RangeKey } | { type: 'month'; key: string };

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
  reservedQty: number;
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

export type ReservationItem = { id: string; productId: string; productName: string; sku: string; qty: number };
export type Reservation = {
  id: string;
  customerName: string | null;
  note: string | null;
  status: 'reserved' | 'converted' | 'cancelled';
  reservedAt: string;
  expiresAt: string | null;
  convertedSaleId: string | null;
  items: ReservationItem[];
};

export type SaleItem = {
  id: string;
  productId: string | null;
  description: string;
  sku: string | null;
  brand: string | null;
  category: string | null;
  qty: number;
  unitPrice: number | null;
  discount: number | null;
  lineTotal: number | null;
};

export type SalePayment = {
  id: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  note: string | null;
};

export type Sale = {
  id: string;
  date: string;
  /** Full timestamp. Real for POS sales; imported rows carry a placeholder time. */
  soldAt: string;
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
  payments: SalePayment[];
  amountPaid: number | null;
  balanceDue: number | null;
  paymentStatus: 'paid' | 'partial' | 'unpaid' | 'not-captured';
  status: 'completed' | 'voided';
  isHistorical: boolean;
  items: SaleItem[];
};

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role | null;
  status: ProfileStatus;
  avatarPath: string | null;
  avatarUrl: string | null;
  requestedAt: string;
  verifiedAt: string | null;
};

export type PendingProfile = Profile & { status: 'pending'; role: null };

export type MovementReason = 'opening_balance' | 'sale' | 'return' | 'receipt' | 'adjustment' | 'write_off' | 'allocation';

export type StockMovement = {
  id: string;
  productId: string;
  delta: number;
  reason: MovementReason;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
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
