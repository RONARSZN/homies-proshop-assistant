import { supabase } from './supabase';
import { downscaleImage } from './image';
import type { CartLine, Category, Product, ProductInput, Reservation, RiderAllocation, Sale, SalePayment, StockMovement, TeamRider } from './types';

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
  is_historical: boolean; customer_name: string | null; seller_name: string | null; created_by: string | null; seller_note: string | null;
  sale_payments: Array<{ id: string; amount: number; payment_method: string; paid_at: string; note: string | null }>;
  sale_items: Array<{
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
  getReservations(): Promise<Reservation[]>;
  createReservation(items: Array<{ productId: string; qty: number }>, customerName: string | null, note: string | null, expiresAt: string | null): Promise<string>;
  cancelReservation(reservationId: string): Promise<void>;
  convertReservation(reservationId: string): Promise<string>;
  getLastRefresh(): string;
  getMovements(productId: string): Promise<StockMovement[]>;
  addMovement(productId: string, delta: number, reason: StockMovement['reason'], note: string | null): Promise<void>;
  createProduct(values: ProductInput): Promise<string>;
  updateProduct(productId: string, values: Omit<ProductInput, 'openingQuantity'> & { isActive: boolean }): Promise<void>;
  completeSale(lines: CartLine[], orderDiscount: number, paymentMethod: string, customerName: string | null, amountPaid: number, sellerName: string | null): Promise<string>;
  recordSalePayment(saleId: string, amount: number, paymentMethod: string, note: string | null): Promise<string>;
  voidSale(saleId: string): Promise<void>;
  setProductPhoto(productId: string, file: File): Promise<void>;
  removeProductPhoto(productId: string, path: string): Promise<void>;
  getRiders(): Promise<TeamRider[]>;
  createRider(fullName: string, nickname: string | null, note: string | null): Promise<void>;
  setRiderActive(riderId: string, isActive: boolean): Promise<void>;
  getAllocations(): Promise<RiderAllocation[]>;
  allocateToRider(riderId: string, productId: string, qty: number, note: string | null): Promise<void>;
}

let lastRefresh = '';

export const shopRepository: ShopRepository = {
  async getProducts() {
    const [{ data: productData, error: productError }, { data: stockData, error: stockError }, { data: soldData, error: soldError }, { data: reservedData, error: reservedError }] = await Promise.all([
      supabase.from('products').select('id,sku,name,category_id,brand,size,colour,unit_cost,selling_price,supplier,received_at,is_active,image_path,categories(name)').order('name'),
      supabase.from('product_stock').select('product_id,on_hand'),
      supabase.from('sale_items').select('product_id,qty,sales!inner(status)').eq('sales.status', 'completed'),
      supabase.from('reservation_items').select('product_id,qty,reservations!inner(status)').eq('reservations.status', 'reserved'),
    ]);
    fail('Products could not be loaded', productError);
    fail('Stock could not be loaded', stockError);
    fail('Sold quantities could not be loaded', soldError);
    fail('Reserved quantities could not be loaded', reservedError);
    const stock = new Map((stockData || []).map(row => [row.product_id, Number(row.on_hand)]));
    const sold = new Map<string, number>();
    (soldData || []).forEach(row => {
      if (row.product_id) sold.set(row.product_id, (sold.get(row.product_id) || 0) + Number(row.qty));
    });
    const reserved = new Map<string, number>();
    (reservedData || []).forEach(row => reserved.set(row.product_id, (reserved.get(row.product_id) || 0) + Number(row.qty)));
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
      reservedQty: reserved.get(row.id) || 0,
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
    // sales.created_by points at auth.users, not profiles, so PostgREST cannot
    // embed the seller. One profiles fetch and a client-side map is cheaper
    // than a view, and matches how stock and sold counts are already joined.
    const items = 'sale_items(id,product_id,description,qty,unit_price,discount,line_total,products(sku,brand,categories(name)))';
    const select = `id,sold_at,subtotal,discount,total,payment_method,status,is_historical,created_by,customer_name,seller_name,seller_note,sale_payments(id,amount,payment_method,paid_at,note),${items}`;

    const [primary, { data: profileData }] = await Promise.all([
      supabase.from('sales').select(select).order('sold_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name'),
    ]);

    const { data, error } = primary;
    fail('Sales could not be loaded', error);
    const sellers = new Map((profileData || []).map(profile => [profile.id, profile.full_name]));
    return ((data || []) as unknown as SaleRow[]).map(row => {
      const items = row.sale_items.map(item => {
        const product = relatedProduct(item.products);
        return ({
        id: item.id,
        productId: item.product_id,
        description: item.description,
        sku: product?.sku || null,
        brand: product?.brand || null,
        category: categoryName(product?.categories || null) || null,
        qty: Number(item.qty),
        unitPrice: item.unit_price === null ? null : Number(item.unit_price),
        discount: item.discount === null ? null : Number(item.discount),
        lineTotal: item.line_total === null ? null : Number(item.line_total),
      }); });
      const first = row.sale_items[0];
      const firstProduct = relatedProduct(first?.products || null);
      const payments: SalePayment[] = row.sale_payments.map(payment => ({
        id: payment.id,
        amount: Number(payment.amount),
        paymentMethod: payment.payment_method,
        paidAt: payment.paid_at,
        note: payment.note,
      }));
      const amountPaid = payments.length ? payments.reduce((sum, payment) => sum + payment.amount, 0) : null;
      const balanceDue = row.total === null || amountPaid === null ? null : Math.max(0, Number(row.total) - amountPaid);
      const paymentStatus = row.total === null || amountPaid === null ? 'not-captured' : balanceDue === 0 ? 'paid' : amountPaid === 0 ? 'unpaid' : 'partial';
      return {
        id: row.id,
        date: row.sold_at.slice(0, 10),
        soldAt: row.sold_at,
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
        customerName: row.customer_name ?? null,
        sellerName: row.seller_name || (row.created_by ? sellers.get(row.created_by) || null : null),
        sellerNote: row.seller_note ?? null,
        payments,
        amountPaid,
        balanceDue,
        paymentStatus,
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

  async completeSale(lines, orderDiscount, paymentMethod, customerName, amountPaid, sellerName) {
    const { data, error } = await supabase.rpc('complete_sale_with_seller', { p_items: lines.map(line => ({ product_id: line.productId, qty: line.qty, unit_price: line.unitPrice, discount: line.discount })), p_order_discount: orderDiscount, p_payment_method: paymentMethod, p_customer_name: customerName, p_amount_paid: amountPaid, p_seller_name: sellerName });
    fail('Sale could not be completed', error);
    return String(data);
  },

  async getReservations() {
    const { data, error } = await supabase.from('reservations')
      .select('id,customer_name,note,status,reserved_at,expires_at,converted_sale_id,reservation_items(id,product_id,qty,products(name,sku))')
      .order('reserved_at', { ascending: false });
    fail('Reservations could not be loaded', error);
    type Row = { id: string; customer_name: string | null; note: string | null; status: Reservation['status']; reserved_at: string; expires_at: string | null; converted_sale_id: string | null; reservation_items: Array<{ id: string; product_id: string; qty: number; products: { name: string; sku: string } | Array<{ name: string; sku: string }> | null }> };
    return ((data || []) as unknown as Row[]).map(row => ({
      id: row.id,
      customerName: row.customer_name,
      note: row.note,
      status: row.status,
      reservedAt: row.reserved_at,
      expiresAt: row.expires_at,
      convertedSaleId: row.converted_sale_id,
      items: row.reservation_items.map(item => { const product = Array.isArray(item.products) ? item.products[0] : item.products; return { id: item.id, productId: item.product_id, productName: product?.name || 'Unknown product', sku: product?.sku || '—', qty: Number(item.qty) }; }),
    })) as Reservation[];
  },

  async createReservation(items, customerName, note, expiresAt) {
    const { data, error } = await supabase.rpc('create_reservation', { p_items: items, p_customer_name: customerName, p_note: note, p_expires_at: expiresAt });
    fail('Reservation could not be created', error);
    return String(data);
  },

  async cancelReservation(reservationId) {
    const { error } = await supabase.rpc('cancel_reservation', { p_reservation_id: reservationId });
    fail('Reservation could not be cancelled', error);
  },

  async convertReservation(reservationId) {
    const { data, error } = await supabase.rpc('convert_reservation_to_sale', { p_reservation_id: reservationId });
    fail('Reservation could not be pushed as a sale', error);
    return String(data);
  },

  async recordSalePayment(saleId, amount, paymentMethod, note) {
    const { data, error } = await supabase.rpc('record_sale_payment', { p_sale_id: saleId, p_amount: amount, p_payment_method: paymentMethod, p_note: note });
    fail('Payment could not be recorded', error);
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

  async getRiders() {
    const { data, error } = await supabase.from('team_riders').select('id,full_name,nickname,team,note,is_active,created_at').order('full_name');
    fail('Team riders could not be loaded', error);
    return (data || []).map(row => ({ id: row.id, fullName: row.full_name, nickname: row.nickname, team: row.team || 'Homies', note: row.note, isActive: row.is_active, createdAt: row.created_at }));
  },

  async createRider(fullName, nickname, note) {
    const { error } = await supabase.from('team_riders').insert({ full_name: fullName.trim(), nickname, note });
    fail('Rider could not be added', error);
  },

  async setRiderActive(riderId, isActive) {
    const { error } = await supabase.from('team_riders').update({ is_active: isActive }).eq('id', riderId);
    fail('Rider could not be updated', error);
  },

  async getAllocations() {
    const { data, error } = await supabase
      .from('rider_allocations')
      .select('id,rider_id,product_id,item_code,qty,allocated_at,note,is_historical,created_at,products(name,size)')
      .order('allocated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    fail('Allocations could not be loaded', error);
    type Row = { id: string; rider_id: string; product_id: string | null; item_code: string; qty: number; allocated_at: string | null; note: string | null; is_historical: boolean; created_at: string; products: { name: string; size: string | null } | Array<{ name: string; size: string | null }> | null };
    return ((data || []) as unknown as Row[]).map(row => {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      return {
        id: row.id,
        riderId: row.rider_id,
        productId: row.product_id,
        // Imported codes that match no product fall back to the raw code
        // rather than inventing a name for something we cannot identify.
        productName: product?.name || row.item_code,
        itemCode: row.item_code,
        size: product?.size || null,
        qty: Number(row.qty),
        allocatedAt: row.allocated_at,
        note: row.note,
        isHistorical: row.is_historical,
        createdAt: row.created_at,
      };
    });
  },

  // A live allocation writes the ledger entry first, then records the
  // allocation against it. Historical rows carry no movement and are never
  // created here — they only ever arrive through the seed migration.
  async allocateToRider(riderId, productId, qty, note) {
    const product = await supabase.from('products').select('sku').eq('id', productId).single();
    fail('Product could not be read', product.error);
    const movement = await supabase.from('stock_movements')
      .insert({ product_id: productId, delta: -Math.abs(qty), reason: 'allocation', note })
      .select('id')
      .single();
    fail('Stock could not be adjusted for this allocation', movement.error);
    const { error } = await supabase.from('rider_allocations').insert({
      rider_id: riderId,
      product_id: productId,
      item_code: product.data?.sku || '',
      qty: Math.abs(qty),
      allocated_at: new Date().toISOString().slice(0, 10),
      note,
      is_historical: false,
      movement_id: movement.data?.id,
    });
    fail('Gear could not be allocated', error);
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
