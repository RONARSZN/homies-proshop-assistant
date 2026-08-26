import { useMemo, useState } from 'react';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import Package from 'lucide-react/dist/esm/icons/package.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import { formatPeso } from './domain';
import { catalogPhoto } from './productPhotos';
import type { Product } from './types';
import { useShopData } from './useShopData';
import './staff-home.css';

export function StaffHome({ onOpenProduct }: { onOpenProduct: (productId: string) => void }) {
  const { products, loading, error } = useShopData();
  return <StaffHomeView products={products} loading={loading} error={error} onOpenProduct={onOpenProduct}/>;
}

export function StaffHomeView({ products, loading, error, onOpenProduct }: { products: Product[]; loading: boolean; error: string | null; onOpenProduct: (productId: string) => void }) {
  const [query, setQuery] = useState('');
  const search = query.trim();
  // Staff search the catalogue to answer "do we have this?" at the counter.
  // A styled-out size is a no, so items with nothing on hand never list.
  const results = useMemo(() => {
    if (!search) return [];
    const needle = search.toLowerCase();
    return products.filter(product => product.isActive && product.qty > 0 && `${product.name} ${product.brand} ${product.sku} ${product.size} ${product.color}`.toLowerCase().includes(needle));
  }, [products, search]);

  return <div className="content staff-home">
    <div className="staff-home-label">STAFF HOME / CATALOGUE</div>
    <section className="staff-greeting" aria-labelledby="staff-home-title">
      <span className="staff-greeting-index" aria-hidden="true">01</span>
      <h1 id="staff-home-title">Ano<br/>hanap mo?</h1>
    </section>

    <div className={`staff-catalog-search ${loading ? 'is-loading' : ''}`}>
      <Search size={20}/>
      <label className="sr-only" htmlFor="staff-catalog-search">Search all products</label>
      <input
        id="staff-catalog-search"
        placeholder="Search any product, SKU, or size…"
        value={query}
        disabled={loading}
        onChange={event => setQuery(event.target.value)}
      />
      {search && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={17}/></button>}
    </div>

    {error && <p className="staff-search-note" role="alert">{error}</p>}
    {search && !error && <div className="staff-search-results" aria-live="polite">
      <p className="staff-search-note">{results.length ? `${results.length} product${results.length === 1 ? '' : 's'} across the catalogue` : 'No products match that search.'}</p>
      {results.length ? <div className="staff-result-list">{results.map(product => { const photo = product.imageUrl || catalogPhoto(product); return <button type="button" key={product.id} className="staff-result" onClick={() => onOpenProduct(product.id)}>
        {/* Decorative: the product name sits beside it, so alt text would only
            make a screen reader say the same thing twice. */}
        {photo
          ? <img className="staff-result-photo" src={photo} alt=""/>
          : <span className="staff-result-photo empty" aria-hidden="true"><Package size={17}/></span>}
        <span className="staff-result-name"><strong>{product.name}</strong><small>{product.brand} · {product.size} · {product.sku}</small></span>
        <span className="staff-result-stock"><strong>{product.qty}</strong><small>remaining</small></span>
        <span className="staff-result-price">{formatPeso(product.price)}</span>
        <ArrowRight size={18}/>
      </button>; })}</div> : <div className="staff-no-results"><Package size={23}/><strong>Nothing found.</strong><span>Try a SKU, a size, or part of the product name.</span></div>}
    </div>}
  </div>;
}
