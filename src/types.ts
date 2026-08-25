export type Product = {
  sku: string;
  name: string;
  brand: string;
  category: string;
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
};

export type Note = { id: number; text: string; date: string; pinned: boolean; archived: boolean };
