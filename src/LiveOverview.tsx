import { Boxes, Database, Download, Package, Tag, TriangleAlert, TrendingUp } from 'lucide-react';
import { liveProducts, liveSales } from './data/live-data';
import './live.css';

const php = (n:number) => n ? `₱${Math.round(n).toLocaleString('en-PH')}` : '—';
const status = (p:typeof liveProducts[number]) => (p.sourceStatus || '').toLowerCase();
const monthSales = liveSales.filter(s => s.date.startsWith('2026-08'));
const monthRevenue = monthSales.reduce((n,s) => n + s.qty * Number(s.price || 0) - s.discount, 0);
const monthUnits = monthSales.reduce((n,s) => n + s.qty, 0);
const inventoryValue = liveProducts.reduce((n,p) => n + p.qty * p.price, 0);
const active = liveProducts.filter(p => p.qty > 0).length;
const attention = liveProducts.filter(p => /out of stock|restock|low stock/i.test(p.sourceStatus || '')).length;

function Metric({label,value,detail,Icon}:{label:string;value:string;detail:string;Icon:typeof Boxes}) { return <div className="kpi"><div className="kpi-top"><span>{label}</span><Icon size={16}/></div><strong>{value}</strong><div className="kpi-detail">{detail}</div></div>; }

export function LiveOverview({onAssistant}:{onAssistant:()=>void}) {
  const best = [...liveProducts].sort((a,b)=>b.sold-a.sold).slice(0,6);
  return <div className="content">
    <div className="page-head"><div><div className="eyebrow">Source synced · HOMIES MONITORING</div><h1>Good morning, Mark.</h1><p>Accurate snapshot from the restructured operational workbook.</p></div><button className="button"><Download size={15}/>Export report</button></div>
    <div className="source-banner"><Database size={15}/><span><strong>HOMIES MONITORING — Restructured 2026-08-19</strong><small>Inventory View + Sales tabs · missing source fields remain unclassified</small></span><b>Read-only snapshot</b></div>
    <div className="kpi-grid"><Metric label="August revenue" value={php(monthRevenue)} detail={`${monthSales.length} source transactions`} Icon={TrendingUp}/><Metric label="August units" value={String(monthUnits)} detail="Sales tab" Icon={Package}/><Metric label="Inventory value" value={php(inventoryValue)} detail="Retail value · Inventory View" Icon={Boxes}/><Metric label="Active SKUs" value={String(active)} detail={`${liveProducts.length} source rows`} Icon={Tag}/><Metric label="Needs attention" value={String(attention)} detail="Source status" Icon={TriangleAlert}/></div>
    <div className="dashboard-grid"><section className="card wide"><div className="card-head"><div><h2>Best sellers</h2><span>Ranked by units sold in source view</span></div></div><div className="rank-list">{best.map((p,i)=><div className="live-rank" key={p.sku}><b className="rank">{String(i+1).padStart(2,'0')}</b><span className="rank-name"><strong>{p.name}</strong><small>{p.sku} · {p.sourceStatus || 'No status'}</small></span><span className="rank-value"><strong>{p.sold}</strong><small>units</small></span></div>)}</div></section><section className="card"><div className="card-head"><div><h2>Data integrity</h2><span>What the source tells us</span></div></div><div className="integrity-list"><div><span>Rows in Inventory View</span><strong>{liveProducts.length}</strong></div><div><span>Sales rows captured</span><strong>{liveSales.length}</strong></div><div><span>Unclassified fields</span><strong>Brand · category · cost</strong></div><div><span>Next step</span><strong>Map source columns</strong></div></div><button className="button button-dark" onClick={onAssistant}>Ask about the data <span>→</span></button></section></div>
  </div>;
}
