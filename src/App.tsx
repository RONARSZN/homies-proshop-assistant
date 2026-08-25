import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Boxes from 'lucide-react/dist/esm/icons/boxes.mjs';
import Camera from 'lucide-react/dist/esm/icons/camera.mjs';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right.mjs';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.mjs';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list.mjs';
import Database from 'lucide-react/dist/esm/icons/database.mjs';
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard.mjs';
import LogOut from 'lucide-react/dist/esm/icons/log-out.mjs';
import Menu from 'lucide-react/dist/esm/icons/menu.mjs';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal.mjs';
import Package from 'lucide-react/dist/esm/icons/package.mjs';
import Pin from 'lucide-react/dist/esm/icons/pin.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Printer from 'lucide-react/dist/esm/icons/printer.mjs';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import Settings from 'lucide-react/dist/esm/icons/settings.mjs';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart.mjs';
import Tag from 'lucide-react/dist/esm/icons/tag.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import { AuthProvider, useAuth } from './AuthProvider';
import { DataProblems } from './DataProblems';
import { LiveOverview } from './LiveOverview';
import { attentionCount, formatPeso, marginFor, reportingPeriod, saleTotal, statusFor, type Status } from './domain';
import { shopRepository } from './repository';
import { ShopDataProvider, useShopData } from './useShopData';
import type { CartLine, Category, Note, Product, ProductInput, StockMovement } from './types';

const nav = [['/', 'Overview', LayoutDashboard], ['/inventory', 'Inventory', Boxes], ['/sales', 'Sales', Tag], ['/pos', 'POS', ShoppingCart], ['/notes', 'Notes', ClipboardList]] as const;
// The phone capsule carries four destinations, not five: at 390px a fifth
// target leaves no room for labels, and icon-only navigation is guesswork.
// Notes is the least used at a counter, so it lives behind More.
const mobileNav = nav.filter(([href]) => href !== '/notes');
const navigate = (path: string) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); };
const routeKey = () => window.location.pathname.replace(/\/$/, '') || '/';

function SignIn() {
  const { signIn, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); void signIn(email.trim(), password); };
  return <main className="sign-in-page"><form className="sign-in-card" onSubmit={submit}><div className="brand"><div className="brand-mark">H</div><div><strong>#HOMIES</strong><span>PRO SHOP / OPS</span></div></div><div className="eyebrow">Authorized team access</div><h1>Sign in</h1><p>Inventory, sales, and stock changes are protected by your shop role.</p><label>Email<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button></form></main>;
}

function AuthenticatedApp() {
  const { session, profile, loading } = useAuth();
  if (loading) return <main className="sign-in-page"><div className="loading-state"><div className="eyebrow">Homies Proshop Assistant</div><h1>Checking your session…</h1></div></main>;
  if (!session || !profile) return <SignIn />;
  return <ShopDataProvider><Router /></ShopDataProvider>;
}

export function App() {
  return <AuthProvider><AuthenticatedApp /></AuthProvider>;
}

function Router() {
  const [path, setPath] = useState(routeKey());
  useEffect(() => { const onPopState = () => setPath(routeKey()); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState); }, []);
  let page: ReactNode;
  if (path === '/') page = <LiveOverview />;
  else if (path === '/inventory') page = <Inventory />;
  else if (path.startsWith('/inventory/category/')) page = <CategoryInventory id={decodeURIComponent(path.slice('/inventory/category/'.length))} />;
  else if (path.startsWith('/inventory/')) page = <ProductDetail id={decodeURIComponent(path.slice('/inventory/'.length))} />;
  else if (path === '/sales') page = <Sales />;
  else if (path.startsWith('/sales/')) page = <Transaction id={decodeURIComponent(path.slice('/sales/'.length))} />;
  else if (path === '/pos') page = <Pos />;
  else if (path === '/data-problems') page = <DataProblems />;
  else if (path === '/notes') page = <Notes />;
  else if (path === '/settings') page = <SettingsPage />;
  else page = <NotFound title="Page not found" copy="That page does not exist." back="/" />;
  return <Shell path={path}>{page}</Shell>;
}

function Shell({ path, children }: { path: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { loading, refresh } = useShopData();
  return <div className="app-shell"><aside className={`sidebar ${menuOpen ? 'open' : ''}`}><div className="brand"><div className="brand-mark">H</div><div><strong>#HOMIES</strong><span>PRO SHOP / OPS</span></div></div><div className="sidebar-label">Workspace</div><nav>{nav.map(([href, label, Icon]) => <button key={href} className={path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''} onClick={() => { navigate(href); setMenuOpen(false); }}><Icon size={17}/><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><button onClick={() => navigate('/data-problems')}><Database size={17}/><span>Data problems</span></button><button onClick={() => navigate('/settings')}><Settings size={17}/><span>Settings</span></button><div className="profile"><div className="avatar">{profile?.fullName.slice(0, 1).toUpperCase()}</div><div><strong>{profile?.fullName}</strong><span>{profile?.role}</span></div></div><button onClick={() => void signOut()}><LogOut size={17}/><span>Sign out</span></button></div></aside>{menuOpen && <button className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)}/>}<main className="main"><header className="topbar"><button className="mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={20}/></button><div className="breadcrumbs"><span>Homies Proshop</span><b>/</b><strong>{path === '/' ? 'Overview' : path.split('/')[1]?.replace('-', ' ')}</strong></div><div className="top-actions"><span className="sync-dot"><i/> Live database</span><button className="refresh-button" aria-label="Refresh live data" disabled={loading} onClick={() => void refresh()}><RefreshCw size={15}/><span>{loading ? 'Refreshing' : 'Refresh'}</span></button></div></header>{children}</main><nav className="mobile-bottom">{mobileNav.map(([href, label, Icon]) => <button key={href} className={path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''} onClick={() => navigate(href)}><Icon size={18}/><span>{label === 'Overview' ? 'Home' : label}</span></button>)}<button aria-label="More" onClick={() => setMenuOpen(true)}><MoreHorizontal size={18}/><span>More</span></button></nav></div>;
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status status-${status.toLowerCase().replaceAll(' ', '-')}`}><i/>{status}</span>;
}

/* A value the source never captured is not the same as an empty cell or a
   zero. It gets a deliberate dashed chip so the gap reads as known. */
function FieldValue({ value }: { value: string }) {
  const missing = !value || value === '—';
  return missing ? <span className="not-captured">Not captured</span> : <strong>{value}</strong>;
}

/* Every product starts without a photo, so the empty state is the common one:
   a dashed tile that invites a capture rather than a broken-image box. */
function ProductPhoto({ product, size, canManage, onSaved }: { product: Product; size: 'thumb' | 'hero'; canManage: boolean; onSaved?: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inputId = `photo-${product.id}-${size}`;

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true); setMessage('');
    try { await shopRepository.setProductPhoto(product.id, file); await onSaved?.(); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Photo could not be saved.'); }
    finally { setBusy(false); }
  }

  async function clear() {
    if (!product.imagePath) return;
    setBusy(true); setMessage('');
    try { await shopRepository.removeProductPhoto(product.id, product.imagePath); await onSaved?.(); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Photo could not be removed.'); }
    finally { setBusy(false); }
  }

  const tile = product.imageUrl
    ? <img className={`product-photo ${size}`} src={product.imageUrl} alt={`${product.name}, ${product.size}`}/>
    : <span className={`product-photo ${size} empty`} aria-hidden="true"><Camera size={size === 'hero' ? 21 : 16}/>{size === 'hero' && <b>Add photo</b>}</span>;

  if (!canManage) return product.imageUrl ? tile : <span className={`product-photo ${size} empty`} role="img" aria-label="No photo captured"><Camera size={size === 'hero' ? 21 : 16}/>{size === 'hero' && <b>No photo</b>}</span>;

  return <div className={`photo-control ${size}`}>
    <label htmlFor={inputId} className="photo-drop">
      {tile}
      <span className="sr-only">{product.imageUrl ? `Replace photo for ${product.name}` : `Add photo for ${product.name}`}</span>
    </label>
    <input id={inputId} className="sr-only" type="file" accept="image/*" capture="environment" disabled={busy} onChange={pick}/>
    {size === 'hero' && product.imagePath && <button type="button" className="photo-remove" onClick={() => void clear()} disabled={busy}>Remove</button>}
    {busy && <span className="photo-busy">Saving…</span>}
    {message && <p className="form-error" role="alert">{message}</p>}
  </div>;
}

function LoadingState() { return <div className="content"><div className="loading-state"><div className="eyebrow">Live operations</div><h1>Loading data…</h1></div></div>; }
function ErrorState({ error }: { error: string }) { return <div className="content"><div className="loading-state"><div className="eyebrow">Data unavailable</div><h1>Live database unavailable.</h1><p>{error}</p></div></div>; }
function PageHead({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy?: string; action?: ReactNode }) { return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{copy && <p>{copy}</p>}</div>{action}</div>; }
function Card({ title, meta, children, wide = false }: { title: string; meta?: string; children: ReactNode; wide?: boolean }) { return <section className={`card ${wide ? 'wide' : ''}`}><div className="card-head"><div><h2>{title}</h2>{meta && <span>{meta}</span>}</div></div>{children}</section>; }

type ProductGroup = { key: string; name: string; brand: string; color: string; variants: Product[] };
const productGroupKey = (product: Product) => [product.categoryId, product.name, product.brand, product.color].map(value => value.trim().toLowerCase()).join('|');
const groupProducts = (products: Product[]): ProductGroup[] => {
  const groups = new Map<string, ProductGroup>();
  products.forEach(product => {
    const key = productGroupKey(product);
    const group = groups.get(key) || { key, name: product.name, brand: product.brand, color: product.color, variants: [] };
    group.variants.push(product);
    groups.set(key, group);
  });
  return [...groups.values()].map(group => ({ ...group, variants: [...group.variants].sort((a, b) => a.size.localeCompare(b.size, undefined, { numeric: true }) || a.sku.localeCompare(b.sku)) })).sort((a, b) => a.name.localeCompare(b.name));
};

function ProductGroupCard({ group, canManage, displayName, categoryLabel }: { group: ProductGroup; canManage: boolean; displayName?: string; categoryLabel?: string }) {
  const [selectedId, setSelectedId] = useState(group.variants[0].id);
  const selected = group.variants.find(product => product.id === selectedId) || group.variants[0];
  const remaining = group.variants.reduce((sum, product) => sum + product.qty, 0);
  return <article className="product-group-card">{categoryLabel && <span className="group-category">{categoryLabel}</span>}<div className="product-group-head"><ProductPhoto product={selected} size="thumb" canManage={false}/><div><strong>{displayName || group.name}</strong><small>{group.brand}{group.color !== '—' ? ` · ${group.color}` : ''}</small></div><span className="group-remaining"><strong>{remaining}</strong><small>total remaining</small></span></div><div className="variant-control"><label htmlFor={`variant-${group.key}`}>Select size</label><select id={`variant-${group.key}`} value={selected.id} onChange={event => setSelectedId(event.target.value)}>{group.variants.map(product => <option key={product.id} value={product.id}>{product.size} · {product.sku}</option>)}</select></div><div className="variant-details"><div><span>Selected size</span><strong>{selected.size}</strong></div><div><span>Remaining</span><strong>{selected.qty}</strong></div><div><span>Price</span><strong>{formatPeso(selected.price)}</strong></div><StatusBadge status={statusFor(selected)}/></div>{canManage && <button className="button button-dark edit-variant" onClick={() => navigate(`/inventory/${selected.id}`)}>Edit selected item</button>}</article>;
}

const matchesQuery = (group: ProductGroup, query: string) =>
  `${group.name} ${group.brand} ${group.color} ${group.variants.map(product => `${product.sku} ${product.size}`).join(' ')}`.toLowerCase().includes(query.toLowerCase());

function Inventory() {
  const { products, categories, loading, error } = useShopData();
  const { profile } = useAuth();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  if (loading) return <LoadingState/>;
  if (error) return <ErrorState error={error}/>;
  const canManage = profile?.role === 'owner' || profile?.role === 'manager';
  const totalRemaining = products.reduce((sum, product) => sum + product.qty, 0);
  const allGroups = groupProducts(products);
  const search = query.trim();
  // Searching spans the whole catalogue. The most common counter question is
  // "do we have this in 148?", and answering it should not require knowing
  // which category the product was filed under.
  const results = search ? allGroups.filter(group => matchesQuery(group, search)) : [];
  const categoryOf = new Map(categories.map(category => [category.id, friendlyCategory(category.name)]));
  return <div className="content"><PageHead eyebrow="Operations · Inventory" title="Inventory" copy="Search the whole catalogue, or open a category to browse by size." action={canManage && <button className="button button-primary" onClick={() => setAdding(value => !value)}><Plus size={16}/>{adding ? 'Close form' : 'Add new item'}</button>}/>{adding && <NewProductForm categories={categories} onCancel={() => setAdding(false)}/>}<div className="toolbar"><div className="search"><Search size={17}/><label className="sr-only" htmlFor="inventory-search">Search all products</label><input id="inventory-search" placeholder="Search any product, SKU, or size…" value={query} onChange={event => setQuery(event.target.value)}/>{search && <button className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={16}/></button>}</div></div>{search ? <><div className="result-note">{results.length ? `${results.length} product style${results.length === 1 ? '' : 's'} across the catalogue` : 'No products match that search.'}</div>{results.length ? <div className="product-group-grid">{results.map(group => <ProductGroupCard key={group.key} group={group} canManage={canManage} categoryLabel={categoryOf.get(group.variants[0].categoryId)}/>)}</div> : <div className="empty-state"><Package size={24}/><strong>Nothing found.</strong><span>Try a SKU, a size, or part of the product name.</span></div>}</> : <><div className="inventory-summary"><div><span>Total remaining</span><strong>{totalRemaining}</strong></div><div><span>Product styles</span><strong>{allGroups.length}</strong></div><div className="warn"><span>Need attention</span><strong>{attentionCount(products)}</strong></div><div><span>Categories</span><strong>{categories.length}</strong></div></div><div className="category-catalog">{categories.map(category => { const items = products.filter(product => product.categoryId === category.id); const styles = groupProducts(items); const onHand = items.reduce((sum, product) => sum + product.qty, 0); return <button className="category-card" key={category.id} onClick={() => navigate(`/inventory/category/${category.id}`)}><span className="category-card-icon"><Boxes size={21}/></span><span className="category-card-copy"><strong>{friendlyCategory(category.name)}</strong><small>{styles.length} styles · {items.length} size variants</small></span><span className="category-card-value"><strong>{onHand}</strong><small>remaining · {attentionCount(items)} need attention</small></span><ArrowRight size={18}/></button>; })}</div></>}</div>;
}

const friendlyCategory = (name: string) => name === 'BINDINGS' ? 'Boots / Bindings' : name === 'OUTWEAR' ? 'Outerwear' : name.charAt(0) + name.slice(1).toLowerCase();

function CategoryInventory({ id }: { id: string }) {
  const { products, categories, loading, error } = useShopData();
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  if (loading) return <LoadingState/>;
  if (error) return <ErrorState error={error}/>;
  const category = categories.find(item => item.id === id);
  if (!category) return <NotFound title="Category not found" copy="That inventory category does not exist." back="/inventory"/>;
  const items = products.filter(product => product.categoryId === id);
  const groups = groupProducts(items);
  const filtered = groups.filter(group => `${group.name} ${group.brand} ${group.color} ${group.variants.map(product => `${product.sku} ${product.size}`).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const canManage = profile?.role === 'owner' || profile?.role === 'manager';
  const remaining = items.reduce((sum, product) => sum + product.qty, 0);
  const boardYearPattern = /^(\d{4})\s+/;
  const boardGroupsByYear = new Map<string, ProductGroup[]>();
  if (category.name === 'BOARDS') filtered.forEach(group => {
    const year = group.name.match(boardYearPattern)?.[1] || 'Other';
    boardGroupsByYear.set(year, [...(boardGroupsByYear.get(year) || []), group]);
  });
  const boardYears = [...boardGroupsByYear].map(([year, yearGroups]) => ({ year, groups: yearGroups })).sort((a, b) => b.year.localeCompare(a.year, undefined, { numeric: true }));
  const productGroups = category.name === 'BOARDS'
    ? <div className="product-year-list">{boardYears.map(section => <section className="product-year-section" key={section.year}><div className="product-year-head"><h2>{section.year}</h2><span>{section.groups.length} style{section.groups.length === 1 ? '' : 's'}</span></div><div className="product-group-grid">{section.groups.map(group => <ProductGroupCard key={group.key} group={group} canManage={canManage} displayName={group.name.replace(boardYearPattern, '')}/>)}</div></section>)}</div>
    : <div className="product-group-grid">{filtered.map(group => <ProductGroupCard key={group.key} group={group} canManage={canManage}/>)}</div>;
  return <div className="content"><button className="back-link" onClick={() => navigate('/inventory')}>← Back to categories</button><PageHead eyebrow="Inventory · Category" title={friendlyCategory(category.name)} copy={`${groups.length} product styles · ${items.length} size variants. Choose a size, then edit that exact inventory item.`} action={canManage && <button className="button button-primary" onClick={() => setAdding(value => !value)}><Plus size={16}/>{adding ? 'Close form' : 'Add new item'}</button>}/>{adding && <NewProductForm categories={categories} defaultCategoryId={category.id} onCancel={() => setAdding(false)}/>}<div className="category-summary"><div><span>Total remaining</span><strong>{remaining}</strong></div><div><span>Product styles</span><strong>{groups.length}</strong></div><div><span>Need attention</span><strong>{attentionCount(items)}</strong></div></div><div className="toolbar category-toolbar"><div className="search"><Search size={17}/><label className="sr-only" htmlFor="category-search">Search this category</label><input id="category-search" placeholder={`Search ${friendlyCategory(category.name).toLowerCase()}…`} value={query} onChange={event => setQuery(event.target.value)}/></div></div>{filtered.length ? productGroups : <div className="empty-state"><Package size={24}/><strong>No products match this search.</strong></div>}<div className="table-footer"><span>Showing {filtered.length} of {groups.length} product styles</span></div></div>;
}

function NewProductForm({ categories, defaultCategoryId, onCancel }: { categories: Category[]; defaultCategoryId?: string; onCancel: () => void }) {
  const { refresh } = useShopData();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nullableText = (name: string) => String(form.get(name) || '').trim() || null;
    const nullableNumber = (name: string) => { const value = String(form.get(name) || '').trim(); return value ? Number(value) : null; };
    const openingQuantity = Number(form.get('openingQuantity') || 0);
    if (!Number.isInteger(openingQuantity) || openingQuantity < 0) { setMessage('Opening quantity must be zero or a positive whole number.'); return; }
    const values: ProductInput = { sku: String(form.get('sku') || '').trim(), name: String(form.get('name') || '').trim(), categoryId: String(form.get('category') || ''), brand: nullableText('brand'), size: nullableText('size'), color: nullableText('color'), cost: nullableNumber('cost'), price: nullableNumber('price'), supplier: nullableText('supplier'), received: nullableText('received'), openingQuantity };
    setSaving(true);
    setMessage('');
    try { const productId = await shopRepository.createProduct(values); await refresh(); navigate(`/inventory/${productId}`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Product could not be created.'); setSaving(false); }
  }
  return <Card title="Add new inventory item" meta="Manager or owner" wide><form className="product-form new-product-form" onSubmit={submit}><label>SKU<input name="sku" placeholder="Unique item code" required/></label><label>Product name<input name="name" placeholder="Exact product name" required/></label><label>Category<select name="category" defaultValue={defaultCategoryId || categories[0]?.id} required>{categories.map(item => <option key={item.id} value={item.id}>{friendlyCategory(item.name)}</option>)}</select></label><label>Brand<input name="brand" placeholder="Optional"/></label><label>Size<input name="size" placeholder="Optional"/></label><label>Colour<input name="color" placeholder="Optional"/></label><label>Unit cost<input name="cost" type="number" min="0.01" step="0.01" placeholder="Optional"/></label><label>Selling price<input name="price" type="number" min="0.01" step="0.01" placeholder="Optional"/></label><label>Supplier<input name="supplier" placeholder="Optional"/></label><label>Date received<input name="received" type="date"/></label><label>Opening quantity<input name="openingQuantity" type="number" min="0" step="1" defaultValue="0" required/></label><div className="form-actions"><button type="button" className="button button-dark" onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Adding item…' : 'Add item'}</button></div></form>{message && <p className="form-error" role="alert">{message}</p>}</Card>;
}

function ProductDetail({ id }: { id: string }) {
  const { products, categories, loading, error, refresh } = useShopData();
  const { profile } = useAuth();
  const product = products.find(item => item.id === id);
  if (loading) return <LoadingState/>;
  if (error) return <ErrorState error={error}/>;
  if (!product) return <NotFound title="Product not found" copy="That product is not in the live database." back="/inventory"/>;
  return <div className="content"><button className="back-link" onClick={() => navigate('/inventory')}>← Back to inventory</button><PageHead eyebrow="Inventory · Live product" title={product.name} copy={`${product.brand} · ${product.sku}`}/><div className="detail-grid"><Card title="Item overview" meta={product.category}><div className="item-hero"><ProductPhoto product={product} size="hero" canManage={profile?.role === 'owner' || profile?.role === 'manager'} onSaved={refresh}/><div><StatusBadge status={statusFor(product)}/><h2>{product.name}</h2><p>{product.brand} · {product.category}</p></div></div><div className="detail-fields">{([['SKU', product.sku], ['Size', product.size], ['Color', product.color], ['Supplier', product.supplier], ...(product.received ? [['Date received', product.received]] : [])] as string[][]).map(([label, value]) => <div key={label}><span>{label}</span><FieldValue value={value}/></div>)}</div></Card><Card title="Stock & pricing" meta="PHP"><div className="big-stock"><span>Current stock</span><strong>{product.qty}</strong><StatusBadge status={statusFor(product)}/></div><div className="detail-fields two">{/* Cost and margin appear only when a cost has actually been entered.
    The shop does not track cost, so a permanent empty row is noise. */}
{([['Selling price', formatPeso(product.price)], ...(product.cost === null ? [] : [['Unit cost', formatPeso(product.cost)], ['Unit margin', formatPeso(marginFor(product))]]), ['Inventory value', formatPeso(product.qty * (product.price || 0))], ['Units sold', String(product.sold)]] as string[][]).map(([label, value]) => <div key={label}><span>{label}</span><FieldValue value={value}/></div>)}</div></Card></div><StockPanel product={product} onSaved={refresh}/>{profile && (profile.role === 'owner' || profile.role === 'manager') && <ProductEditor product={product} categories={categories} onSaved={refresh}/>}</div>;
}

function StockPanel({ product, onSaved }: { product: Product; onSaved: () => Promise<void> }) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [reason, setReason] = useState<'receipt' | 'adjustment' | 'write_off'>('receipt');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const load = () => shopRepository.getMovements(product.id).then(setMovements).catch(error => setMessage(error instanceof Error ? error.message : 'Movement history unavailable.'));
  useEffect(() => { void load(); }, [product.id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const raw = Number(amount);
    if (!Number.isInteger(raw) || raw === 0) { setMessage('Enter a non-zero whole number.'); return; }
    const delta = reason === 'write_off' ? -Math.abs(raw) : reason === 'receipt' ? Math.abs(raw) : raw;
    try { await shopRepository.addMovement(product.id, delta, reason, note.trim() || null); setAmount(''); setNote(''); setMessage('Stock movement saved.'); await Promise.all([load(), onSaved()]); } catch (error) { setMessage(error instanceof Error ? error.message : 'Stock movement failed.'); }
  }
  return <Card title="Stock movements" meta="Append-only ledger" wide><form className="movement-form" onSubmit={submit}><select value={reason} onChange={event => setReason(event.target.value as typeof reason)}><option value="receipt">Receive stock</option><option value="adjustment">Count adjustment (+/-)</option><option value="write_off">Write off damage</option></select><input type="number" step="1" placeholder="Quantity" value={amount} onChange={event => setAmount(event.target.value)} required/><input placeholder="Note (optional)" value={note} onChange={event => setNote(event.target.value)}/><button className="button button-primary">Save movement</button></form>{message && <p className="form-message" role="status">{message}</p>}<div className="movement-list">{movements.map(item => <div key={item.id}><span>{new Date(item.createdAt).toLocaleString('en-PH')}</span><strong>{item.reason.replace('_', ' ')}</strong><b className={item.delta < 0 ? 'negative' : ''}>{item.delta > 0 ? '+' : ''}{item.delta}</b><small>{item.note || 'No note'}</small></div>)}</div></Card>;
}

function ProductEditor({ product, categories, onSaved }: { product: Product; categories: Category[]; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const number = (name: string) => { const value = String(form.get(name) || '').trim(); return value ? Number(value) : null; };
    try { await shopRepository.updateProduct(product.id, { sku: String(form.get('sku')), name: String(form.get('name')), categoryId: String(form.get('category')), brand: String(form.get('brand')).trim() || null, size: String(form.get('size')).trim() || null, color: String(form.get('color')).trim() || null, cost: number('cost'), price: number('price'), supplier: String(form.get('supplier')).trim() || null, received: String(form.get('received')).trim() || null, isActive: form.get('active') === 'on' }); setMessage('Product updated.'); await onSaved(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Product update failed.'); }
  }
  return <Card title="Product management" meta="Manager or owner" wide><button className="button button-dark" onClick={() => setOpen(value => !value)}>{open ? 'Close editor' : 'Edit product'}</button>{open && <form className="product-form" onSubmit={submit}><label>SKU<input name="sku" defaultValue={product.sku} required/></label><label>Name<input name="name" defaultValue={product.name} required/></label><label>Category<select name="category" defaultValue={product.categoryId}>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Brand<input name="brand" defaultValue={product.brand === '—' ? '' : product.brand}/></label><label>Size<input name="size" defaultValue={product.size === '—' ? '' : product.size}/></label><label>Colour<input name="color" defaultValue={product.color === '—' ? '' : product.color}/></label><label>Unit cost<input name="cost" type="number" min="0.01" step="0.01" defaultValue={product.cost ?? ''}/></label><label>Selling price<input name="price" type="number" min="0.01" step="0.01" defaultValue={product.price ?? ''}/></label><label>Supplier<input name="supplier" defaultValue={product.supplier === '—' ? '' : product.supplier}/></label><label>Date received<input name="received" type="date" defaultValue={product.received}/></label><label className="checkbox"><input name="active" type="checkbox" defaultChecked={product.isActive}/>Active product</label><button className="button button-primary">Save product</button></form>}{message && <p className="form-message">{message}</p>}</Card>;
}

function Sales() {
  const { sales, loading, error } = useShopData();
  if (loading) return <LoadingState/>;
  if (error) return <ErrorState error={error}/>;
  const period = reportingPeriod(sales.filter(sale => sale.status === 'completed'));
  const revenue = period.sales.reduce((sum, sale) => sum + (saleTotal(sale) || 0), 0);
  return <div className="content"><PageHead eyebrow={`Operations · Sales · ${period.label}`} title="Sales" copy="Completed and voided transactions from the live database." action={<button className="button button-primary" onClick={() => navigate('/pos')}><ShoppingCart size={16}/>New sale</button>}/><div className="inventory-summary"><div><span>Revenue</span><strong>{formatPeso(revenue)}</strong></div><div><span>Units sold</span><strong>{period.sales.reduce((sum, sale) => sum + sale.qty, 0)}</strong></div><div><span>Transactions</span><strong>{period.sales.length}</strong></div><div><span>All records</span><strong>{sales.length}</strong></div></div><div className="card"><div className="sales-list">{sales.map(sale => <button key={sale.id} onClick={() => navigate(`/sales/${sale.id}`)}><span className="sale-date">{sale.date}</span><span><strong>{sale.product}</strong><small>{sale.id.slice(0, 8)} · {sale.qty} unit{sale.qty === 1 ? '' : 's'} · {sale.status}</small></span><strong>{formatPeso(sale.total)}</strong><ChevronDown size={15}/></button>)}</div></div></div>;
}

function Transaction({ id }: { id: string }) {
  const { sales, loading, error, refresh } = useShopData();
  const { profile } = useAuth();
  const [message, setMessage] = useState('');
  if (loading) return <LoadingState/>;
  if (error) return <ErrorState error={error}/>;
  const sale = sales.find(item => item.id === id);
  if (!sale) return <NotFound title="Transaction not found" copy="That sale does not exist." back="/sales"/>;
  async function voidSale() { if (!confirm('Void this sale and return its stock?')) return; try { await shopRepository.voidSale(id); setMessage('Sale voided and stock returned.'); await refresh(); } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Void failed.'); } }
  return <div className="content print-receipt"><button className="back-link no-print" onClick={() => navigate('/sales')}>← Back to sales</button><PageHead eyebrow="Sales · Transaction" title={sale.id.slice(0, 8).toUpperCase()} copy={`${sale.date} · ${sale.status}`} action={<button className="button button-dark no-print" onClick={() => window.print()}><Printer size={16}/>Print</button>}/><Card title="Receipt" meta={sale.paymentMethod || 'Payment method unavailable'}><div className="receipt-parties"><div><span>Customer</span><strong>{sale.customerName || 'Walk-in'}</strong></div><div><span>Sold by</span><strong>{sale.sellerName || (sale.isHistorical ? 'Imported record' : 'Unknown')}</strong></div></div><div className="transaction-row header"><span>Product</span><span>Qty</span><span>Unit price</span><span>Total</span></div>{sale.items.map(item => <div className="transaction-row" key={item.id}><span><strong>{item.description}</strong><small>{item.sku || 'Historical unmatched item'}</small></span><span>{item.qty}</span><span>{formatPeso(item.unitPrice)}</span><strong>{formatPeso(item.lineTotal)}</strong></div>)}<div className="transaction-total"><span>Subtotal</span><strong>{formatPeso(sale.subtotal)}</strong><span>Discount</span><strong>{formatPeso(sale.discount)}</strong><span>Total</span><strong>{formatPeso(sale.total)}</strong></div></Card>{profile?.role === 'owner' && sale.status === 'completed' && !sale.isHistorical && <button className="button button-dark no-print" onClick={() => void voidSale()}>Void sale</button>}{message && <p className="form-message">{message}</p>}</div>;
}

function Pos() {
  const { products, refresh } = useShopData();
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerName, setCustomerName] = useState('');
  const [message, setMessage] = useState('');
  // Nothing is listed until something is typed. An empty query used to match
  // every product, filling the panel with twelve arbitrary items before the
  // sale had even started.
  const search = query.trim();
  const matches = search ? products.filter(product => product.isActive && product.qty > 0 && product.price !== null && `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase())).slice(0, 12) : [];
  const subtotal = cart.reduce((sum, line) => sum + line.qty * line.unitPrice - line.discount, 0);
  const total = Math.max(0, subtotal - orderDiscount);
  function add(product: Product) { if (product.price === null) return; setCart(current => { const found = current.find(line => line.productId === product.id); return found ? current.map(line => line.productId === product.id ? { ...line, qty: line.qty + 1 } : line) : [...current, { productId: product.id, qty: 1, unitPrice: product.price!, discount: 0 }]; }); }
  function update(productId: string, changes: Partial<CartLine>) { setCart(current => current.map(line => line.productId === productId ? { ...line, ...changes } : line).filter(line => line.qty > 0)); }
  async function complete() { setMessage(''); if (!cart.length) { setMessage('Add at least one product.'); return; } try { const saleId = await shopRepository.completeSale(cart, orderDiscount, paymentMethod, customerName.trim() || null); setCart([]); setOrderDiscount(0); setCustomerName(''); await refresh(); navigate(`/sales/${saleId}`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Sale failed.'); } }
  return <div className="content"><PageHead eyebrow="Counter POS" title="Ring up a sale" copy="Availability is checked again inside the database transaction."/><div className="pos-layout"><Card title="Find products" meta={search ? `${matches.length} match${matches.length === 1 ? '' : 'es'}` : 'In stock and priced'}><div className="search"><Search size={17}/><input aria-label="Search products" placeholder="Search product or SKU…" value={query} onChange={event => setQuery(event.target.value)}/>{search && <button className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={16}/></button>}</div>{search ? (matches.length ? <div className="pos-results">{matches.map(product => <button key={product.id} onClick={() => add(product)}><span><strong>{product.name}</strong><small>{product.sku} · {product.qty} available</small></span><b>{formatPeso(product.price)}</b></button>)}</div> : <p className="empty-copy">No product in stock matches that.</p>) : <p className="empty-copy">Search by product name or SKU to add a line.</p>}</Card><Card title="Current sale" meta={`${cart.length} lines`}><div className="cart-lines">{cart.map(line => { const product = products.find(item => item.id === line.productId)!; return <div key={line.productId}><span><strong>{product.name}</strong><small>{product.sku} · {product.qty} available</small></span><label>Qty<input type="number" min="0" step="1" value={line.qty} onChange={event => update(line.productId, { qty: Number(event.target.value) })}/></label><label>Line discount<input type="number" min="0" step="0.01" value={line.discount} onChange={event => update(line.productId, { discount: Number(event.target.value) })}/></label><b>{formatPeso(line.qty * line.unitPrice - line.discount)}</b></div>; })}</div>{!cart.length && <p className="empty-copy">No products added.</p>}<div className="pos-checkout"><label>Customer name <em>optional</em><input placeholder="Walk-in" value={customerName} onChange={event => setCustomerName(event.target.value)}/></label><div className="checkout-seller"><span>Sold by</span><strong>{profile?.fullName || 'You'}</strong></div><label>Order discount<input type="number" min="0" max={subtotal} step="0.01" value={orderDiscount} onChange={event => setOrderDiscount(Number(event.target.value))}/></label><label>Payment method<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option>Cash</option><option>GCash</option><option>Card</option><option>Bank transfer</option><option>Other</option></select></label><div><span>Total</span><strong>{formatPeso(total)}</strong></div><button className="button button-primary" onClick={() => void complete()}>Complete sale</button>{message && <p className="form-error" role="alert">{message}</p>}</div></Card></div></div>;
}

const NOTE_KEY = 'homies-proshop-notes';
const readNotes = (): Note[] => { try { const value = localStorage.getItem(NOTE_KEY); return value ? JSON.parse(value) as Note[] : []; } catch { return []; } };
function Notes() {
  const [notes, setNotes] = useState<Note[]>(readNotes);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<'All' | 'Pinned'>('All');
  useEffect(() => { localStorage.setItem(NOTE_KEY, JSON.stringify(notes)); }, [notes]);
  const visible = notes.filter(note => filter === 'All' || note.pinned);
  const add = () => { if (!draft.trim()) return; setNotes(current => [{ id: Date.now(), text: draft.trim(), date: new Date().toISOString().slice(0, 10), pinned: false, archived: false }, ...current]); setDraft(''); };
  return <div className="content"><PageHead eyebrow="Operations · Device notes" title="Keep the thread." copy="Notes remain on this device and are not inventory records."/><div className="notes-layout"><div className="note-compose"><label htmlFor="note-input">New operational note</label><textarea id="note-input" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Write a note…"/><div><span>{draft.length} characters</span><button className="button button-primary" onClick={add}>Add note</button></div></div><div className="notes-head"><h2>Notes</h2><select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option>All</option><option>Pinned</option></select></div><div className="note-list">{visible.map(note => <article key={note.id} className={note.pinned ? 'pinned' : ''}><button className="note-pin" aria-label={note.pinned ? 'Unpin note' : 'Pin note'} onClick={() => setNotes(current => current.map(item => item.id === note.id ? { ...item, pinned: !item.pinned } : item))}><Pin size={15}/></button><div><p>{note.text}</p><span>{note.date}</span></div><div className="note-actions"><button aria-label="Delete note" onClick={() => setNotes(current => current.filter(item => item.id !== note.id))}>×</button></div></article>)}{!visible.length && <div className="empty-state"><ClipboardList size={24}/><strong>No notes yet.</strong></div>}</div></div></div>;
}

function SettingsPage() {
  const { profile } = useAuth();
  return <div className="content"><PageHead eyebrow="Workspace" title="Settings" copy="Current connection and access details."/><div className="settings-panel"><div className="source-card"><div className="source-icon"><Database size={16}/></div><div><strong>Supabase operational database</strong><span>Live inventory, sales, and append-only stock ledger</span></div><span className="status status-in-stock"><i/>Connected</span></div><div className="setting-list"><div className="setting-row"><div><strong>Signed in as</strong><span>{profile?.fullName}</span></div><b>{profile?.role}</b></div><div className="setting-row"><div><strong>Inventory authority</strong><span>Derived from stock movements</span></div><b>Ledger</b></div></div></div></div>;
}

function NotFound({ title, copy, back }: { title: string; copy: string; back: string }) {
  return <div className="content"><div className="empty-state"><Package size={28}/><strong>{title}</strong><span>{copy}</span><button className="button button-primary" onClick={() => navigate(back)}>Go back</button></div></div>;
}
