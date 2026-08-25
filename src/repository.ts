import { supabase } from './supabase';
import { downscaleImage } from './image';
import type { CartLine, Category, Product, ProductInput, Sale, StockMovement } from './types';

const PHOTO_BUCKET = 'product-photos';
const PHOTO_URL_TTL = 3600;

type ProductRow = {
  id: string; sku: string; name: string; category_id: string; brand: string | null;
  size: string | null; colour: string | null; unit_cost: number | null;
  selling_price: number | null; supplier: string | null; received_at: string | null;
  is_active: boolean; image_path: string | null;
  categories: { name: string } | { name: string }[] | null;
};

// The bucket is private, so paths need signing before they can render. One
// batch call for the whole catalogue rather than one request per row.
async function signPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (!paths.length) return signed;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_URL_TTL);
  if (error) return signed; // A missing photo must never break the inventory list.
  (data || []).forEach(item => {
    if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  });
  return signed;
}

type SaleRow = {
  id: string; sold_at: string; subtotal: number | null; discount: number | null;
  total: number | null; payment_method: string | null; status: 'completed' | 'voided';
  is_historical: boolean; sale_items: Array<{
    id: string; product_id: string | null; description: string; qty: number;
    unit_price: number | null; discount: number | null; line_total: number | null;
    products: { sku: string; brand: string | null; categories: { name: string } | { name: string }[] | null } | Array<{ sku: string; brand: string | null; categories: { name: string } | { name: string }[] | null }> | null;
  }>;
};

const categoryName = (value: ProductRow['categories']) => Array.isArray(value) ? value[0]?.name : value?.name;
const relatedProduct = (value: SaleRow['sale_items'][number]['products']) => Array.isArray(value) ? value[0] : value;
const fail = (message: string, error: { message: string } | null) => {
  if (error) throw new Error(`${message}: ${error.message}`);
};

export interface ShopRepository {
  getProducts(): Promise<Product[]>;
  getSales(): Promise<Sale[]>;
  getCategories(): Promise<Category[]>;
  getLastRefresh(): string;
  getMovements(productId: string): Promise<StockMovement[]>;
  addMovement(productId: string, delta: number, reason: StockMovement['reason'], note: string | null): Promise<void>;
  createProduct(values: ProductInput): Promise<string>;
  updateProduct(productId: string, values: Omit<ProductInput, 'openingQuantity'> & { isActive: boolean }): Promise<void>;
  completeSale(lines: CartLine[], orderDiscount: number, paymentMethod: string): Promise<string>;
  voidSale(saleId: string): Promise<void>;
  setProductPhoto(productId: string, file: File): Promise<void>;
  removeProductPhoto(productId: string, path: string): Promise<void>;
}

let lastRefresh = '';

export const shopRepository: ShopRepository = {
  async getProducts() {
    const [{ data: productData, error: productError }, { data: stockData, error: stockError }, { data: soldData, error: soldError }] = await Promise.all([
      supabase.from('products').select('id,sku,name,category_id,brand,size,colour,unit_cost,selling_price,supplier,received_at,is_active,image_path,categories(name)').order('name'),
      supabase.from('product_stock').select('product_id,on_hand'),
      supabase.from('sale_items').select('product_id,qty,sales!inner(status)').eq('sales.status', 'completed'),
    ]);
    fail('Products could not be loaded', productError);
    fail('Stock could not be loaded', stockError);
    fail('Sold quantities could not be loaded', soldError);
    const stock = new Map((stockData || []).map(row => [row.product_id, Number(row.on_hand)]));
    const sold = new Map<string, number>();
    (soldData || []).forEach(row => {
      if (row.product_id) sold.set(row.product_id, (sold.get(row.product_id) || 0) + Number(row.qty));
    });
    const rows = (productData || []) as ProductRow[];
    const photoUrls = await signPhotoUrls(rows.map(row => row.image_path).filter((path): path is string => Boolean(path)));
    lastRefresh = new Date().toISOString();
    return rows.map(row => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      brand: row.brand || '—',
      category: categoryName(row.categories) || 'Uncategorised',
      categoryId: row.category_id,
      size: row.size || '—',
      color: row.colour || '—',
      qty: stock.get(row.id) || 0,
      cost: row.unit_cost === null ? null : Number(row.unit_cost),
      price: row.selling_price === null ? null : Number(row.selling_price),
      sold: sold.get(row.id) || 0,
      received: row.received_at || '',
      supplier: row.supplier || '—',
      image: 'neutral',
      imagePath: row.image_path,
      imageUrl: row.image_path ? photoUrls.get(row.image_path) || null : null,
      isActive: row.is_active,
    }));
  },

  async getSales() {
    const { data, error } = await supabase.from('sales').select('id,sold_at,subtotal,discount,total,payment_method,status,is_historical,sale_items(id,product_id,description,qty,unit_price,discount,line_total,products(sku,brand,categories(name)))').order('sold_at', { ascending: false });
    fail('Sales could not be loaded', error);
    return ((data || []) as unknown as SaleRow[]).map(row => {
      const items = row.sale_items.map(item => {
        const product = relatedProduct(item.products);
        return ({
        id: item.id,
        productId: item.product_id,
        description: item.description,
        sku: product?.sku || null,
        brand: product?.brand || null,
        qty: Number(item.qty),
        unitPrice: item.unit_price === null ? null : Number(item.unit_price),
        discount: item.discount === null ? null : Number(item.discount),
        lineTotal: item.line_total === null ? null : Number(item.line_total),
      }); });
      const first = row.sale_items[0];
      const firstProduct = relatedProduct(first?.products || null);
      return {
        id: row.id,
        date: row.sold_at.slice(0, 10),
        product: items.length === 1 ? items[0].description : `${items.length} items`,
        sku: firstProduct?.sku || first?.description || '—',
        qty: items.reduce((sum, item) => sum + item.qty, 0),
        price: row.total,
        discount: row.discount,
        category: categoryName(firstProduct?.categories || null) || 'Uncategorised',
        brand: firstProduct?.brand || '—',
        subtotal: row.subtotal === null ? null : Number(row.subtotal),
        total: row.total === null ? null : Number(row.total),
        paymentMethod: row.payment_method,
        status: row.status,
        isHistorical: row.is_historical,
        items,
      };
    });
  },

  async getCategories() {
    const { data, error } = await supabase.from('categories').select('id,name,sort_order').order('sort_order');
    fail('Categories could not be loaded', error);
    return (data || []).map(row => ({ id: row.id, name: row.name, sortOrder: row.sort_order }));
  },

  getLastRefresh() { return lastRefresh; },

  async getMovements(productId) {
    const { data, error } = await supabase.from('stock_movements').select('id,product_id,delta,reason,reference_id,note,created_at').eq('product_id', productId).order('created_at', { ascending: false });
    fail('Movement history could not be loaded', error);
    return (data || []).map(row => ({ id: row.id, productId: row.product_id, delta: row.delta, reason: row.reason, referenceId: row.reference_id, note: row.note, createdAt: row.created_at }));
  },

  async addMovement(productId, delta, reason, note) {
    const { error } = await supabase.from('stock_movements').insert({ product_id: productId, delta, reason, note: note || null });
    fail('Stock movement could not be saved', error);
  },

  async createProduct(values) {
    const { data, error } = await supabase.rpc('create_product', {
      p_sku: values.sku,
      p_name: values.name,
      p_category_id: values.categoryId,
      p_brand: values.brand,
      p_size: values.size,
      p_colour: values.color,
      p_unit_cost: values.cost,
      p_selling_price: values.price,
      p_supplier: values.supplier,
      p_received_at: values.received,
      p_opening_quantity: values.openingQuantity,
    });
    fail('Product could not be created', error);
    return String(data);
  },

  async updateProduct(productId, values) {
    const { error } = await supabase.from('products').update({
      sku: values.sku,
      name: values.name,
      category_id: values.categoryId,
      brand: values.brand,
      size: values.size,
      colour: values.color,
      unit_cost: values.cost,
      selling_price: values.price,
      supplier: values.supplier,
      received_at: values.received,
      is_active: values.isActive,
    }).eq('id', productId);
    fail('Product could not be updated', error);
  },

  async completeSale(lines, orderDiscount, paymentMethod) {
    const { data, error } = await supabase.rpc('complete_sale', { p_items: lines.map(line => ({ product_id: line.productId, qty: line.qty, unit_price: line.unitPrice, discount: line.discount })), p_order_discount: orderDiscount, p_payment_method: paymentMethod });
    fail('Sale could not be completed', error);
    return String(data);
  },

  async voidSale(saleId) {
    const { error } = await supabase.rpc('void_sale', { p_sale_id: saleId });
    fail('Sale could not be voided', error);
  },

  async setProductPhoto(productId, file) {
    const blob = await downscaleImage(file);
    // Fixed path per product: replacing upserts in place, so a product can
    // never leave an orphaned object behind in the bucket.
    const path = `${productId}.jpg`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    fail('Photo could not be uploaded', error);
    const { error: linkError } = await supabase.from('products').update({ image_path: path }).eq('id', productId);
    fail('Photo could not be linked to the product', linkError);
  },

  async removeProductPhoto(productId, path) {
    const { error: clearError } = await supabase.from('products').update({ image_path: null }).eq('id', productId);
    fail('Photo reference could not be cleared', clearError);
    // Clear the reference first: a failed object delete leaves a harmless
    // orphan, whereas a dangling image_path renders as a broken photo.
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    fail('Photo could not be removed from storage', error);
  },
};
