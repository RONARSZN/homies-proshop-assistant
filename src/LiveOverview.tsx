import Boxes from 'lucide-react/dist/esm/icons/boxes.mjs';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list.mjs';
import Database from 'lucide-react/dist/esm/icons/database.mjs';
import Package from 'lucide-react/dist/esm/icons/package.mjs';
import Tag from 'lucide-react/dist/esm/icons/tag.mjs';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.mjs';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.mjs';
import {
  activeSkuCount, attentionCount, formatPeso, inventoryValue,
  monthKeyOf, monthLabelOf, monthTotals, productsWithZeroPriceInStock, salesByCategoryInMonth,
} from './domain';
import { useShopData } from './useShopData';

function Metric({ label, value, detail, Icon }: { label: string; value: string; detail: string; Icon: typeof Boxes }) {
  return <div className="kpi">
    <div className="kpi-top"><span>{label}</span><Icon size={16}/></div>
    <strong>{value}</strong>
    <div className="kpi-detail">{detail}</div>
  </div>;
}

function DataState({ children }: { children: React.ReactNode }) {
  return <div className="content"><div className="loading-state">{children}</div></div>;
}

export function LiveOverview() {
  const { products, sales, lastRefresh, loading, error } = useShopData();
  if (loading) return <DataState><div className="eyebrow">Homies Proshop Assistant</div><h1>Loading live shop data…</h1><p>Reading the operational database.</p></DataState>;
  if (error) return <DataState><div className="eyebrow">Data unavailable</div><h1>Live shop data unavailable.</h1><p>{error}</p></DataState>;

  // Present calendar month, not the month of the most recent sale. A quiet
  // month should read as a quiet month, not silently roll back to whenever
  // trading last happened.
  const monthKey = monthKeyOf(new Date());
  const monthLabel = monthLabelOf(monthKey);
  const month = monthTotals(sales, monthKey);

  const zeroPrice = productsWithZeroPriceInStock(products);
  const categorySales = salesByCategoryInMonth(sales, monthKey);
  const averageSale = month.transactions ? formatPeso(month.revenue / month.transactions) : '—';

  return <div className="content">
    <div className="page-head"><div>
      <div className="eyebrow">Live operations · {lastRefresh ? new Date(lastRefresh).toLocaleString('en-PH') : 'connected'}</div>
      <h1>{monthLabel}</h1>
      <p>Trading so far this month. Stock figures are current.</p>
    </div></div>

    <div className="source-banner"><Database size={15}/><span><strong>Supabase operational database</strong><small>Inventory, sales, and stock ledger refresh together.</small></span><b>Live data</b></div>

    <div className="kpi-grid">
      <Metric label={`Revenue · ${monthLabel}`} value={formatPeso(month.revenue)} detail={`Average sale ${averageSale}`} Icon={TrendingUp}/>
      <Metric label="Units sold" value={String(month.units)} detail="Completed sales only" Icon={Package}/>
      <Metric label="Transactions" value={String(month.transactions)} detail="Completed sales only" Icon={ClipboardList}/>
      <Metric label="Inventory value" value={formatPeso(inventoryValue(products))} detail={zeroPrice ? `${zeroPrice} in-stock products have no price` : 'Current retail value'} Icon={Boxes}/>
      <Metric label="Active SKUs" value={String(activeSkuCount(products))} detail={`${products.length} products`} Icon={Tag}/>
      <Metric label="Needs attention" value={String(attentionCount(products))} detail="Current stock status" Icon={TriangleAlert}/>
    </div>

    <section className="card">
      <div className="card-head"><div><h2>Sales by category</h2><span>Total sales in {monthLabel}</span></div></div>
      {month.transactions === 0
        ? <p className="empty-copy">No sales recorded yet in {monthLabel}.</p>
        : <div className="rank-list">{categorySales.map((item, index) => <div className="live-rank" key={item.category}>
            <b className="rank">{String(index + 1).padStart(2, '0')}</b>
            <span className="rank-name"><strong>{item.category}</strong><small>{item.transactions} transaction{item.transactions === 1 ? '' : 's'} · {item.units} unit{item.units === 1 ? '' : 's'}</small></span>
            <span className="rank-value"><strong>{formatPeso(item.revenue)}</strong><small>sales</small></span>
          </div>)}</div>}
    </section>
  </div>;
}
