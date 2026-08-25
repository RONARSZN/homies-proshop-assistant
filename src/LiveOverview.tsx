import { Boxes, Database, Package, Tag, TriangleAlert, TrendingUp } from 'lucide-react';
import { activeSkuCount, attentionCount, bestSellers, formatPeso, inventoryValue, productsWithZeroPriceInStock, reportingPeriod, statusFor } from './domain';
import { useShopData } from './useShopData';
import './live.css';

function Metric({ label, value, detail, Icon }: { label: string; value: string; detail: string; Icon: typeof Boxes }) { return <div className="kpi"><div className="kpi-top"><span>{label}</span><Icon size={16}/></div><strong>{value}</strong><div className="kpi-detail">{detail}</div></div>; }
function DataState({ children }: { children: React.ReactNode }) { return <div className="content"><div className="loading-state">{children}</div></div>; }

export function LiveOverview() {
  const { products, sales, snapshotDate, loading, error } = useShopData();
  if (loading) return <DataState><div className="eyebrow">Homies Proshop Assistant</div><h1>Loading shop snapshot…</h1><p>Reading the local source snapshot.</p></DataState>;
  if (error) return <DataState><div className="eyebrow">Data unavailable</div><h1>Shop snapshot unavailable.</h1><p>{error}</p></DataState>;
  const period = reportingPeriod(sales);
  const revenue = period.sales.reduce((sum, sale) => sum + (sale.price === null ? 0 : sale.qty * sale.price - (sale.discount || 0)), 0);
  const units = period.sales.reduce((sum, sale) => sum + sale.qty, 0);
  const zeroPrice = productsWithZeroPriceInStock(products);
  const best = bestSellers(products).slice(0, 6);
  return <div className="content">
    <div className="page-head"><div><div className="eyebrow">Source snapshot · {snapshotDate}</div><h1>Good morning, Mark.</h1><p>Accurate operational view from the captured workbook data.</p></div></div>
    <div className="source-banner"><Database size={15}/><span><strong>HOMIES MONITORING — Restructured {snapshotDate}</strong><small>Inventory View + Sales tabs · static read-only snapshot</small></span><b>Read-only snapshot</b></div>
    <div className="kpi-grid"><Metric label={`Revenue · ${period.label}`} value={formatPeso(revenue)} detail={`${period.sales.length} source transactions`} Icon={TrendingUp}/><Metric label={`Units · ${period.label}`} value={String(units)} detail="Sales tab" Icon={Package}/><Metric label="Inventory value" value={formatPeso(inventoryValue(products))} detail={zeroPrice ? `${zeroPrice} in-stock rows have no price` : 'Retail value · source view'} Icon={Boxes}/><Metric label="Active SKUs" value={String(activeSkuCount(products))} detail={`${products.length} source rows`} Icon={Tag}/><Metric label="Needs attention" value={String(attentionCount(products))} detail="Source status" Icon={TriangleAlert}/></div>
    <div className="dashboard-grid"><section className="card wide"><div className="card-head"><div><h2>Best sellers</h2><span>Ranked by units sold in source view</span></div></div><div className="rank-list">{best.map((product, index)=><div className="live-rank" key={`${product.sku}-${index}`}><b className="rank">{String(index + 1).padStart(2, '0')}</b><span className="rank-name"><strong>{product.name}</strong><small>{product.sku} · {statusFor(product)}</small></span><span className="rank-value"><strong>{product.sold}</strong><small>units</small></span></div>)}</div></section><section className="card"><div className="card-head"><div><h2>Data integrity</h2><span>What the source tells us</span></div></div><div className="integrity-list"><div><span>Rows in Inventory View</span><strong>{products.length}</strong></div><div><span>Sales rows captured</span><strong>{sales.length}</strong></div><div><span>Cost / margin</span><strong>Unavailable</strong></div><div><span>Latest sale period</span><strong>{period.label}</strong></div></div></section></div>
  </div>;
}
