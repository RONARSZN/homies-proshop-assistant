import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert.mjs';
import { buildDataQuality } from './dataQuality';
import { useShopData } from './useShopData';

function IssueList({ title, children, count }: { title: string; children: React.ReactNode; count: number }) {
  return <section className="card wide"><div className="card-head"><div><h2>{title}</h2><span>{count} computed issue{count === 1 ? '' : 's'}</span></div></div>{children}</section>;
}

function rows(items: string[]) {
  return items.length ? <ul className="integrity-list">{items.map(item => <li key={item}>{item}</li>)}</ul> : <p className="empty-copy">Nothing to resolve here.</p>;
}

export function DataProblems() {
  const { products, sales, loading, error } = useShopData();
  if (loading) return <div className="content"><div className="loading-state"><div className="eyebrow">Data quality</div><h1>Loading live data…</h1></div></div>;
  if (error) return <div className="content"><div className="loading-state"><div className="eyebrow">Data quality</div><h1>Live data unavailable.</h1></div></div>;
  const quality = buildDataQuality(products, sales);
  const duplicateText = quality.duplicateGroups.map(group => `${group.sku}: ${group.rows.length} products share this SKU.`);
  const priceText = quality.missingPriceRows.map(product => `${product.name} (${product.sku}) has no selling price.`);
  const unmatchedText = quality.unmatchedSales.map(sale => `Sale ${sale.id.slice(0, 8)} on ${sale.date} has a line with no product.`);
  return <div className="content">
    <div className="page-head"><div><div className="eyebrow">Integrity · Live records</div><h1>Data problems</h1><p>Only issues that can still be acted on. Unit cost, received dates, and imported sales history are not tracked.</p></div></div>
    <div className="inventory-summary">
      <div><span>Open issues</span><strong>{quality.issueCount}</strong></div>
      <div className="warn"><span>Duplicate SKUs</span><strong>{quality.duplicateGroups.length}</strong></div>
      <div><span>Missing prices</span><strong>{quality.missingPriceRows.length}</strong></div>
      <div><span>Unmatched sale lines</span><strong>{quality.unmatchedSales.length}</strong></div>
    </div>
    <div className="data-problems-grid">
      <IssueList title="Duplicate SKUs" count={quality.duplicateGroups.length}>{rows(duplicateText)}</IssueList>
      <IssueList title="Missing selling price" count={quality.missingPriceRows.length}>{rows(priceText)}</IssueList>
      <IssueList title="Unmatched sale lines" count={quality.unmatchedSales.length}>{rows(unmatchedText)}</IssueList>
    </div>
    <div className="data-note"><ShieldAlert size={17}/><span>Counts come from the live database. Sales rung up in this app always reference a product; only imported Google Sheet history is exempt, and it is excluded here.</span></div>
  </div>;
}
