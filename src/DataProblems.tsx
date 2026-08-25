import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.mjs';
import { buildDataQuality } from './dataQuality';
import { useShopData } from './useShopData';

function IssueList({ title, children, count }: { title: string; children: React.ReactNode; count: number }) {
  return <section className="card wide"><div className="card-head"><div><h2>{title}</h2><span>{count} computed issue{count === 1 ? '' : 's'}</span></div></div>{children}</section>;
}

function rows(items: string[]) {
  return items.length ? <ul className="integrity-list">{items.map(item => <li key={item}>{item}</li>)}</ul> : <p className="empty-copy">No computed issues in this category.</p>;
}

export function DataProblems() {
  const { products, sales, loading, error } = useShopData();
  if (loading) return <div className="content"><div className="loading-state"><div className="eyebrow">Data quality</div><h1>Loading live data…</h1></div></div>;
  if (error) return <div className="content"><div className="loading-state"><div className="eyebrow">Data quality</div><h1>Live data unavailable.</h1></div></div>;
  const quality = buildDataQuality(products, sales);
  const duplicateText = quality.duplicateGroups.map(group => `${group.sku}: ${group.rows.length} products share this SKU.`);
  return <div className="content"><div className="page-head"><div><div className="eyebrow">Integrity · Live records</div><h1>Data problems</h1><p>Current completeness and unmatched historical sales.</p></div></div><div className="inventory-summary"><div><span>Issue groups</span><strong>{quality.issueCount}</strong></div><div><span>Duplicate SKUs</span><strong>{quality.duplicateGroups.length}</strong></div><div><span>Missing prices</span><strong>{quality.missingPriceRows.length}</strong></div><div><span>Orphan sales</span><strong>{quality.orphanSales.length}</strong></div></div><div className="data-problems-grid"><IssueList title="Duplicate SKUs" count={quality.duplicateGroups.length}>{rows(duplicateText)}</IssueList><IssueList title="Completeness" count={quality.missingPriceRows.length + quality.missingCostRows.length + quality.missingReceivedRows.length}>{rows([quality.missingPriceRows.length ? `${quality.missingPriceRows.length} products have no selling price.` : '', quality.missingCostRows.length ? `${quality.missingCostRows.length} products have no unit cost.` : '', quality.missingReceivedRows.length ? `${quality.missingReceivedRows.length} products have no received date.` : ''].filter(Boolean))}</IssueList><IssueList title="Historical sales" count={quality.orphanSales.length}>{rows([quality.orphanSales.length ? `${quality.orphanSales.length} historical sales remain unmatched to products.` : ''].filter(Boolean))}</IssueList></div><div className="data-note"><ShieldAlert size={17}/><span>These counts come directly from the operational database. Missing values remain unknown until reviewed.</span></div></div>;
}
