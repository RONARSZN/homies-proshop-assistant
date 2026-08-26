import { useEffect, useState } from 'react';
import Boxes from 'lucide-react/dist/esm/icons/boxes.mjs';
import Maximize2 from 'lucide-react/dist/esm/icons/maximize-2.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import Package from 'lucide-react/dist/esm/icons/package.mjs';
import Tag from 'lucide-react/dist/esm/icons/tag.mjs';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.mjs';
import {
  activeSkuCount, bestSellersInCategory, categoryBreakdown, decodePeriod, encodePeriod,
  formatPeso, inventoryValue, monthLabelOf, selectableMonths,
  periodLabelOf, productsWithZeroPriceInStock, salesForPeriod,
  sizeMixInCategory, totalsOf, RANGE_LABELS,
  type ChartRow, type RangeKey,
} from './domain';
import type { Product, Sale } from './types';
import { useShopData } from './useShopData';
import { usePeriod } from './usePeriod';

function Metric({ label, value, detail, Icon }: { label: string; value: string; detail: string; Icon: typeof Boxes }) {
  return <div className="kpi">
    <div className="kpi-top"><span>{label}</span><Icon size={16}/></div>
    <strong>{value}</strong>
    <div className="kpi-detail">{detail}</div>
  </div>;
}


/* Bars rather than a pie or a line: these are ranked magnitudes, and a bar
   is the one form that stays readable at six rows in a stacked tile. */
function BarChart({ rows, unit }: { rows: ChartRow[]; unit: string }) {
  const max = Math.max(...rows.map(row => row.qty), 1);
  return <div className="bar-chart">{rows.map(row => <div className="bar-row" key={row.key}>
    <span className="bar-label" title={row.title || row.label}>{row.label}</span>
    <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max((row.qty / max) * 100, 3)}%` }}/></span>
    <b className="bar-value">{row.qty}<small>{row.qty === 1 ? unit : `${unit}s`}</small></b>
  </div>)}</div>;
}

/* Every card reads the page's period. One control, so two cards can never
   disagree about the window they are describing. */
function ChartCard({ title, rows, products, category, mode, periodLabel }: {
  title: string; rows: Sale[]; products: Product[];
  category: string; mode: 'sellers' | 'sizes'; periodLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const sellers = mode === 'sellers' ? bestSellersInCategory(rows, category) : [];
  const sizes: { rows: ChartRow[]; unlinked: number } =
    mode === 'sizes' ? sizeMixInCategory(rows, products, category) : { rows: [], unlinked: 0 };
  const bars = mode === 'sellers' ? sellers : sizes.rows;

  // Only the seller cards hide anything: they show an item code, and the
  // product name behind it is a hover title, which a phone cannot reveal.
  const canExpand = mode === 'sellers' && bars.length > 0;
  const full = expanded ? bestSellersInCategory(rows, category, 40) : [];

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  return <section className="card chart-card">
    <div className="card-head">
      <div><h2>{title}</h2><span>{periodLabel}</span></div>
      {canExpand && <button className="expand-button" onClick={() => setExpanded(true)} aria-haspopup="dialog">
        <Maximize2 size={14}/>Full list
      </button>}
    </div>
    {bars.length
      ? <BarChart rows={bars} unit=" unit"/>
      : <p className="empty-copy">Nothing sold in this period.</p>}
    {mode === 'sizes' && sizes.unlinked > 0 &&
      <p className="chart-note">{sizes.unlinked} unit{sizes.unlinked === 1 ? '' : 's'} not linked to a product, so unsized.</p>}

    {expanded && <div className="sheet-backdrop" onClick={() => setExpanded(false)}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`${title}, ${periodLabel}`} onClick={event => event.stopPropagation()}>
        <div className="sheet-head">
          <div><h2>{title}</h2><span>{periodLabel} · {full.length} item{full.length === 1 ? '' : 's'}</span></div>
          <button className="sheet-close" onClick={() => setExpanded(false)} aria-label="Close"><X size={18}/></button>
        </div>
        <div className="sheet-list">{full.map((row, index) => <div key={row.key}>
          <b className="rank">{String(index + 1).padStart(2, '0')}</b>
          <span className="sheet-name">
            <strong>{row.title ? row.title.replace(` · ${row.label}`, '') : row.label}</strong>
            <small>{row.label}</small>
          </span>
          <span className="sheet-qty"><strong>{row.qty}</strong><small>{row.qty === 1 ? 'unit' : 'units'}</small></span>
        </div>)}</div>
      </div>
    </div>}
  </section>;
}

function DataState({ children }: { children: React.ReactNode }) {
  return <div className="content"><div className="loading-state">{children}</div></div>;
}

export function LiveOverview() {
  const { products, sales, lastRefresh, loading, error } = useShopData();
  // Defaults to the present calendar month, not the month of the most recent
  // sale: a quiet month should read as quiet rather than silently rolling
  // back to whenever trading last happened. From there it is selectable.
  const { period, setPeriod } = usePeriod();
  if (loading) return <DataState><div className="eyebrow">Homies Proshop Assistant</div><h1>Loading live shop data…</h1><p>Reading the operational database.</p></DataState>;
  if (error) return <DataState><div className="eyebrow">Data unavailable</div><h1>Live shop data unavailable.</h1><p>{error}</p></DataState>;
  const monthLabel = periodLabelOf(period);
  const rows = salesForPeriod(sales, period);
  const month = totalsOf(rows);

  const zeroPrice = productsWithZeroPriceInStock(products);
  const categorySales = categoryBreakdown(rows);
  const averageSale = month.transactions ? formatPeso(month.revenue / month.transactions) : '—';
  const months = selectableMonths(sales);

  return <div className="content">
    <div className="page-head">
      <div>
        <div className="eyebrow">Live operations · {lastRefresh ? new Date(lastRefresh).toLocaleString('en-PH') : 'connected'}</div>
        <div className="title-row"><h1 className="sr-only">Overview — {monthLabel}</h1><span className="live-pill"><i/>Live data</span><label className="period-select"><span className="sr-only">Reporting period</span><select value={encodePeriod(period)} onChange={event => setPeriod(decodePeriod(event.target.value))}><optgroup label="Range">{(['1m', '3m', '6m', '12m', 'all'] as RangeKey[]).map(key => <option key={key} value={`range:${key}`}>{RANGE_LABELS[key]}</option>)}</optgroup><optgroup label="Month">{months.map(key => <option key={key} value={`month:${key}`}>{monthLabelOf(key)}</option>)}</optgroup></select></label></div>
        <p>Sales figures follow the period above. Stock figures are always current.</p>
      </div>
    </div>

    <div className="kpi-grid">
      <Metric label={`Revenue · ${monthLabel}`} value={formatPeso(month.revenue)} detail={`Average sale ${averageSale}`} Icon={TrendingUp}/>
      <Metric label="Units sold" value={String(month.units)} detail="Completed sales only" Icon={Package}/>
      <Metric label="Inventory value" value={formatPeso(inventoryValue(products))} detail={zeroPrice ? `${zeroPrice} in-stock products have no price` : 'Stock now, not the period'} Icon={Boxes}/>
      <Metric label="Active SKUs" value={String(activeSkuCount(products))} detail={`${products.length} products · stock now`} Icon={Tag}/>
    </div>

    <div className="chart-grid">
      <ChartCard title="Best selling boards" rows={rows} products={products} category="BOARDS" mode="sellers" periodLabel={monthLabel}/>
      <ChartCard title="Best selling boots" rows={rows} products={products} category="BINDINGS" mode="sellers" periodLabel={monthLabel}/>
      <ChartCard title="Best selling vests" rows={rows} products={products} category="VESTS" mode="sellers" periodLabel={monthLabel}/>
      <ChartCard title="Board sizes sold" rows={rows} products={products} category="BOARDS" mode="sizes" periodLabel={monthLabel}/>
      <ChartCard title="Boot sizes sold" rows={rows} products={products} category="BINDINGS" mode="sizes" periodLabel={monthLabel}/>
      <ChartCard title="Vest sizes sold" rows={rows} products={products} category="VESTS" mode="sizes" periodLabel={monthLabel}/>
    </div>

    <section className="card">
      <div className="card-head"><div><h2>Sales by category</h2><span>Total sales · {monthLabel}</span></div></div>
      {month.transactions === 0
        ? <p className="empty-copy">No sales recorded in {monthLabel}.</p>
        : <div className="rank-list">{categorySales.map((item, index) => <div className="live-rank" key={item.category}>
            <b className="rank">{String(index + 1).padStart(2, '0')}</b>
            <span className="rank-name"><strong>{item.category}</strong><small>{item.transactions} transaction{item.transactions === 1 ? '' : 's'} · {item.units} unit{item.units === 1 ? '' : 's'}</small></span>
            <span className="rank-value"><strong>{formatPeso(item.revenue)}</strong><small>sales</small></span>
          </div>)}</div>}
    </section>
  </div>;
}
