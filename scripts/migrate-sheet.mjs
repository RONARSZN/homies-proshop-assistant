import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const sourcePath = process.env.MIGRATION_SOURCE_PATH || 'scripts/migration-source.json';
const validateOnly = process.argv.includes('--validate-only');

function stableUuid(kind, value) {
  const bytes = Buffer.from(createHash('sha256').update(`homies:${kind}:${value}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function nullableText(value) {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text || null;
}

function nullablePositiveNumber(value) {
  if (value === null || value === undefined || value === '' || value === '-') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function excelDate(serial) {
  const date = new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86400000);
  return `${date.toISOString().slice(0, 10)}T12:00:00+08:00`;
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const inventoryRows = source.inventoryRows;
const salesRows = source.salesRows;

if (!Array.isArray(inventoryRows) || inventoryRows.length !== 354) {
  throw new Error(`Expected 354 inventory rows, received ${inventoryRows?.length ?? 'invalid input'}.`);
}
if (!Array.isArray(salesRows) || salesRows.length !== 137) {
  throw new Error(`Expected 137 sales rows, received ${salesRows?.length ?? 'invalid input'}.`);
}

const products = inventoryRows.map((row, index) => {
  const [sourceRow, sku, name, category, brand, size, colour, onHand, unitCost, sellingPrice, supplier, receivedAt] = row;
  return {
    id: stableUuid('product', `${sourceRow}:${sku}`),
    movement_id: stableUuid('opening', `${sourceRow}:${sku}`),
    source_row: sourceRow,
    sku: String(sku).trim(),
    name: String(name).trim(),
    category: String(category).trim(),
    brand: nullableText(brand),
    size: nullableText(size),
    colour: nullableText(colour),
    on_hand: Number(onHand),
    unit_cost: nullablePositiveNumber(unitCost),
    selling_price: nullablePositiveNumber(sellingPrice),
    supplier: nullableText(supplier),
    received_at: nullableText(receivedAt),
    source_index: index + 2,
  };
});

const duplicateSkus = products.map(product => product.sku).filter((sku, index, all) => all.indexOf(sku) !== index);
if (duplicateSkus.length) throw new Error(`Duplicate SKUs remain: ${[...new Set(duplicateSkus)].join(', ')}`);
if (products.some(product => !product.sku || !product.name || !product.category || !Number.isInteger(product.on_hand))) {
  throw new Error('Required product data is missing or an on-hand quantity is not an integer.');
}

const productsBySku = new Map(products.map(product => [product.sku, product]));
const sales = salesRows.map((row, index) => {
  const [sheetRow, dateSerial, rawSku, qty, rawTotal] = row;
  const sku = String(rawSku).trim();
  const product = productsBySku.get(sku);
  return {
    id: stableUuid('sale', `${sheetRow}:${dateSerial}:${sku}`),
    item_id: stableUuid('sale-item', `${sheetRow}:${dateSerial}:${sku}`),
    sold_at: excelDate(dateSerial),
    product_id: product?.id ?? null,
    description: product?.name ?? sku,
    raw_sku: sku,
    qty: Number(qty),
    total: nullablePositiveNumber(rawTotal),
    source_index: index + 1,
  };
});

const orphanSales = sales.filter(sale => sale.product_id === null);
const missingAmountSales = sales.filter(sale => sale.total === null);
const discrepancies = [
  { sku: '26sap156', productSold: 2, salesQty: 1 },
  { sku: '25figher910', productSold: 1, salesQty: 2 },
  { sku: '25lugfocintrolstn55', productSold: 1, salesQty: 2 },
  { sku: '25vfocbengrxl', productSold: 2, salesQty: 3 },
  { sku: '18gotntl', productSold: 1, salesQty: 2 },
  { sku: '18watbrs', productSold: 0, salesQty: 1 },
];

console.log(JSON.stringify({
  rowsRead: { products: products.length, sales: sales.length },
  orphanSales: orphanSales.length,
  missingAmountSales: missingAmountSales.map(sale => sale.raw_sku),
  reconciledAway: discrepancies,
}, null, 2));

if (validateOnly) process.exit(0);

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: inserted, error: migrationError } = await supabase.rpc('run_initial_migration', { p_products: products, p_sales: sales });
if (migrationError) throw migrationError;

const { data: stockRows, error: stockError } = await supabase.from('product_stock').select('product_id,on_hand');
if (stockError) throw stockError;
const actualStock = new Map(stockRows.map(row => [row.product_id, row.on_hand]));
const mismatches = products.filter(product => actualStock.get(product.id) !== product.on_hand);
if (mismatches.length) {
  console.error(JSON.stringify(mismatches.map(product => ({ sku: product.sku, expected: product.on_hand, actual: actualStock.get(product.id) })), null, 2));
  throw new Error(`${mismatches.length} stock balances failed verification.`);
}

console.log(JSON.stringify({ inserted, skipped: 0, failed: 0, stockBalancesVerified: products.length }, null, 2));
