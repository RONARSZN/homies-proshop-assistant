import { useState } from 'react';
import Boxes from 'lucide-react/dist/esm/icons/boxes.mjs';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list.mjs';
import Database from 'lucide-react/dist/esm/icons/database.mjs';
import Package from 'lucide-react/dist/esm/icons/package.mjs';
import Tag from 'lucide-react/dist/esm/icons/tag.mjs';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.mjs';
import {
  activeSkuCount, bestSellersInCategory, formatPeso, inventoryValue,
  monthKeyOf, monthLabelOf, monthTotals, productsWithZeroPriceInStock, rangeStart,
  salesByCategoryInMonth, sizeMixInCategory, RANGE_LABELS,
  type ChartRow, type RangeKey,
} from './domain';
import type { Product, Sale } from './types';
import { useShopData } from './useShopData';

function Metric({ label, value, detail, Icon }: { label: string; value: string; detail: string; Icon: typeof Boxes }) {
  return <div className="kpi">
    <div className="kpi-top"><span>{label}</span><Icon size={16}/></div>
    <strong>{value}</strong>
    <div className="kpi-detail">{detail}</div>
  </div>;
}


const RANGE_KEYS: RangeKey[] = ['1m', '3m', '6m', '12m', 'all'];

/* Bars rather than a pie or a line: these are ranked magnitudes, and a bar
   is the one form that stays readable at six rows in a quarter-width card. */
function BarChart({ rows, unit }: { rows: ChartRow[]; unit: string }) {
  const max = Math.max(...rows.map(row => row.qty), 1);
  return <div className="bar-chart">{rows.map(row => <div className="bar-row" key={row.key}>
    <span className="bar-label" title={row.title || row.label}>{row.label}</span>
    <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max((row.qty / max) * 100, 3)}%` }}/></span>
    <b className="bar-value">{row.qty}<small>{row.qty === 1 ? unit : `${unit}s`}</small></b>
  </div>)}</div>;
}

function ChartCard({ title, sales, products, category, mode }: {
  title: string; sales: Sale[]; products: Product[]; category: string; mode: 'sellers' | 'sizes';
}) {
  const [range, setRange] = useState<RangeKey>('6m');
  const start = rangeStart(range);
  const selectId = `range-${mode}-${category}`;
  const sellers = mode === 'sellers' ? bestSellersInCategory(sales, category, start) : [];
  const sizes = mode === 'sizes' ? sizeMixInCategory(sales, products, category, start) : { rows: [], unlinked: 0 };
  const rows = mode === 'sellers' ? sellers : sizes.rows;

  return <section className="card chart-card">
    <div className="card-head">
      <div><h2>{title}</h2><span>{RANGE_LABELS[range]}</span></div>
      <label className="range-select">
        <span className="sr-only">Range for {title}</span>
        <select id={selectId} value={range} onChange={event => setRange(event.target.value as RangeKey)}>
          {RANGE_KEYS.map(key => <option key={key} value={key}>{RANGE_LABELS[key]}</option>)}
        </select>
      </label>
    </div>
    {rows.length
      ? <BarChart rows={rows} unit=" unit"/>
      : <p className="empty-copy">Nothing sold in this window.</p>}
    {mode === 'sizes' && sizes.unlinked > 0 &&
      <p className="chart-note">{sizes.unlinked} unit{sizes.unlinked === 1 ? '' : 's'} not linked to a product, so unsized.</p>}
  </section>;
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
    </div>

    <div className="chart-grid">
      <ChartCard title="Best selling boards" sales={sales} products={products} category="BOARDS" mode="sellers"/>
      <ChartCard title="Best selling boots" sales={sales} products={products} category="BINDINGS" mode="sellers"/>
      <ChartCard title="Board sizes sold" sales={sales} products={products} category="BOARDS" mode="sizes"/>
      <ChartCard title="Boot sizes sold" sales={sales} products={products} category="BINDINGS" mode="sizes"/>
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
