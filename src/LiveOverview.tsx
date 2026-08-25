import Boxes from 'lucide-react/dist/esm/icons/boxes.mjs';
import Database from 'lucide-react/dist/esm/icons/database.mjs';
import Package from 'lucide-react/dist/esm/icons/package.mjs';
import Tag from 'lucide-react/dist/esm/icons/tag.mjs';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.mjs';
import { activeSkuCount, attentionCount, bestSellers, formatPeso, inventoryValue, productsWithZeroPriceInStock, reportingPeriod, saleTotal, statusFor } from './domain';
import { useShopData } from './useShopData';

function Metric({ label, value, detail, Icon }: { label: string; value: string; detail: string; Icon: typeof Boxes }) {
  return <div className="kpi"><div className="kpi-top"><span>{label}</span><Icon size={16}/></div><strong>{value}</strong><div className="kpi-detail">{detail}</div></div>;
}

function DataState({ children }: { children: React.ReactNode }) {
  return <div className="content"><div className="loading-state">{children}</div></div>;
}

export function LiveOverview() {
  const { products, sales, lastRefresh, loading, error } = useShopData();
  if (loading) return <DataState><div className="eyebrow">Homies Proshop Assistant</div><h1>Loading live shop data…</h1><p>Reading the operational database.</p></DataState>;
  if (error) return <DataState><div className="eyebrow">Data unavailable</div><h1>Live shop data unavailable.</h1><p>{error}</p></DataState>;
  const period = reportingPeriod(sales);
  const revenue = period.sales.reduce((sum, sale) => sum + (saleTotal(sale) || 0), 0);
  const units = period.sales.reduce((sum, sale) => sum + sale.qty, 0);
  const zeroPrice = productsWithZeroPriceInStock(products);
  const best = bestSellers(products).slice(0, 6);
  return <div className="content">
    <div className="page-head"><div><div className="eyebrow">Live operations · {lastRefresh ? new Date(lastRefresh).toLocaleString('en-PH') : 'connected'}</div><h1>Good morning.</h1><p>Current inventory and sales from the operational database.</p></div></div>
    <div className="source-banner"><Database size={15}/><span><strong>Supabase operational database</strong><small>Inventory, sales, and stock ledger refresh together.</small></span><b>Live data</b></div>
    <div className="kpi-grid"><Metric label={`Revenue · ${period.label}`} value={formatPeso(revenue)} detail={`${period.sales.length} transactions`} Icon={TrendingUp}/><Metric label={`Units · ${period.label}`} value={String(units)} detail="Completed sales" Icon={Package}/><Metric label="Inventory value" value={formatPeso(inventoryValue(products))} detail={zeroPrice ? `${zeroPrice} in-stock products have no price` : 'Current retail value'} Icon={Boxes}/><Metric label="Active SKUs" value={String(activeSkuCount(products))} detail={`${products.length} products`} Icon={Tag}/><Metric label="Needs attention" value={String(attentionCount(products))} detail="Current stock status" Icon={TriangleAlert}/></div>
    <div className="dashboard-grid"><section className="card wide"><div className="card-head"><div><h2>Best sellers</h2><span>Ranked by completed-sale units</span></div></div><div className="rank-list">{best.map((product, index)=><div className="live-rank" key={product.id}><b className="rank">{String(index + 1).padStart(2, '0')}</b><span className="rank-name"><strong>{product.name}</strong><small>{product.sku} · {statusFor(product)}</small></span><span className="rank-value"><strong>{product.sold}</strong><small>units</small></span></div>)}</div></section><section className="card"><div className="card-head"><div><h2>Data integrity</h2><span>Current database state</span></div></div><div className="integrity-list"><div><span>Products</span><strong>{products.length}</strong></div><div><span>Sales</span><strong>{sales.length}</strong></div><div><span>Products without cost</span><strong>{products.filter(product => product.cost === null).length}</strong></div><div><span>Latest sale period</span><strong>{period.label}</strong></div></div></section></div>
  </div>;
}
