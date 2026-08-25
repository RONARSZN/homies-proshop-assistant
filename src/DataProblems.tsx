import { ShieldAlert } from 'lucide-react';
import { buildDataQuality } from './dataQuality';
import { useShopData } from './useShopData';

function IssueList({ title, children, count }: { title: string; children: React.ReactNode; count: number }) {
  return <Card title={title} meta={`${count} computed issue${count === 1 ? '' : 's'}`}>{children}</Card>;
}
function Card({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return <section className="card wide"><div className="card-head"><div><h2>{title}</h2><span>{meta}</span></div></div>{children}</section>;
}
function rows(items: string[]) { return items.length ? <ul className="integrity-list">{items.map(item => <li key={item}>{item}</li>)}</ul> : <p className="empty-copy">No computed issues in this category.</p>; }

export function DataProblems() {
  const { products, sales, snapshotDate, loading, error } = useShopData();
  if (loading) return <div className="content"><div className="loading-state"><div className="eyebrow">Data quality</div><h1>Loading snapshot…</h1></div></div>;
  if (error) return <div className="content"><div className="loading-state"><div className="eyebrow">Data quality</div><h1>Snapshot unavailable.</h1></div></div>;
  const quality = buildDataQuality(products, sales, snapshotDate);
  const duplicateText = quality.duplicateGroups.map(group => `${group.sku}: ${group.kind === 'same-product' ? 'same product across multiple source rows' : 'different products share this SKU'} (${group.rows.length} rows)`);
  const freshnessText = quality.stale.daysBehind !== null && quality.stale.daysBehind < 0 ? [`Latest sale ${quality.stale.latestSale} is after snapshot ${quality.stale.snapshotDate}.`] : [];
  return <div className="content"><div className="page-head"><div><div className="eyebrow">Integrity · Computed from source arrays</div><h1>Data problems</h1><p>Review only. This page does not edit inventory, sales, or the source snapshot.</p></div></div><div className="inventory-summary"><div><span>Issue groups</span><strong>{quality.issueCount}</strong></div><div><span>Duplicate SKU groups</span><strong>{quality.duplicateGroups.length}</strong></div><div><span>Missing prices</span><strong>{quality.missingPriceRows.length}</strong></div><div><span>Orphan sales</span><strong>{quality.orphanSales.length}</strong></div></div><div className="data-problems-grid"><IssueList title="Duplicate SKU groups" count={quality.duplicateGroups.length}>{rows(duplicateText)}</IssueList><IssueList title="Completeness" count={quality.missingPriceRows.length + (quality.missingCostRows.length ? 1 : 0) + (quality.missingReceivedRows.length ? 1 : 0)}>{rows([quality.missingPriceRows.length ? `${quality.missingPriceRows.length} products have no selling price.` : '', quality.missingCostRows.length ? `${quality.missingCostRows.length} products have no unit cost.` : '', quality.missingReceivedRows.length ? `${quality.missingReceivedRows.length} products have no received date.` : ''].filter(Boolean))}</IssueList><IssueList title="Sales reconciliation" count={quality.reconciliation.length + quality.orphanSales.length}>{rows([...quality.reconciliation.map(row => `${row.sku}: product sold ${row.productSold}, summed sales quantity ${row.salesQty}.`), quality.orphanSales.length ? `${quality.orphanSales.length} sales rows reference SKUs absent from inventory.` : ''].filter(Boolean))}</IssueList><IssueList title="Freshness" count={freshnessText.length}>{rows(freshnessText)}</IssueList></div><div className="data-note"><ShieldAlert size={17} /><span>Computed counts are derived at runtime from the loaded source arrays. Resolve source issues upstream before relying on operational decisions.</span></div></div>;
}
