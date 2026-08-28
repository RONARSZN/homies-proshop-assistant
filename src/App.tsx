import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Boxes from 'lucide-react/dist/esm/icons/boxes.mjs';
import Camera from 'lucide-react/dist/esm/icons/camera.mjs';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.mjs';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list.mjs';
import CalendarClock from 'lucide-react/dist/esm/icons/calendar-clock.mjs';
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
import Download from 'lucide-react/dist/esm/icons/download.mjs';
import Search from 'lucide-react/dist/esm/icons/search.mjs';
import Settings from 'lucide-react/dist/esm/icons/settings.mjs';
import ShoppingBag from 'lucide-react/dist/esm/icons/shopping-bag.mjs';
import Tag from 'lucide-react/dist/esm/icons/tag.mjs';
import Users from 'lucide-react/dist/esm/icons/users.mjs';
import CircleUserRound from 'lucide-react/dist/esm/icons/circle-user-round.mjs';
import UserCheck from 'lucide-react/dist/esm/icons/user-check.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import { AuthProvider, useAuth } from './AuthProvider';
import { AccessPortal } from './AccessPortal';
import { MyAccount } from './MyAccount';
import { Onboarding } from './Onboarding';
import { PendingScreen } from './PendingScreen';
import { RejectedScreen } from './RejectedScreen';
import { VerifyAccounts } from './VerifyAccounts';
import { DataProblems } from './DataProblems';
import { LiveOverview } from './LiveOverview';
import { TeamAllocation } from './TeamAllocation';
import { StaffHome, StaffHomeView } from './StaffHome';
import { byModelYearThenName, formatPeso, marginFor, modelYearOf, periodLabelOf, reportingPeriod, saleTime, salesForPeriod, saleTotal, statusFor, type Status } from './domain';
import { catalogPhoto } from './productPhotos';
import { shopRepository } from './repository';
import { ShopDataProvider, useShopData } from './useShopData';
import { PeriodProvider, usePeriod } from './usePeriod';
import { buildSalesSheet, downloadSheet, sheetFilename, type SheetSections } from './exportSheet';
import { availableOf } from './cart';
import { useCart } from './useCart';
import type { Category, Note, Period, Product, ProductInput, Sale, StockMovement } from './types';

const adminNav = [['/', 'Overview', LayoutDashboard], ['/inventory', 'Inventory', Boxes], ['/sales', 'Sales', Tag], ['/reservations', 'Reservations', CalendarClock], ['/team', 'Team', Users], ['/notes', 'Notes', ClipboardList]] as const;
const staffNav = [['/', 'Home', LayoutDashboard], ['/inventory', 'Inventory', Boxes], ['/reservations', 'Reservations', CalendarClock], ['/notes', 'Notes', ClipboardList]] as const;
const scrollPositions = new Map<string, number>();
const navigate = (path: string) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); };
const routeKey = () => window.location.pathname.replace(/\/$/, '') || '/';

function AuthenticatedApp() {
  const { session, profile, loading, signOut } = useAuth();
  const [path, setPath] = useState(routeKey());
  useEffect(() => {
    const update = () => setPath(routeKey());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  if (loading) return <main className="sign-in-page"><div className="loading-state"><div className="eyebrow">Homies Proshop Assistant</div><h1>Checking your session…</h1></div></main>;
  if (!session || !profile) return <AccessPortal onRegistered={() => navigate('/onboarding/phone')}/>;
  if (profile.status === 'pending') {
    if (path === '/onboarding/phone') return <Onboarding step="phone" onNext={() => navigate('/onboarding/avatar')} onSkip={() => navigate('/onboarding/avatar')}/>;
    if (path === '/onboarding/avatar') return <Onboarding step="avatar" onNext={() => navigate('/pending')} onSkip={() => navigate('/pending')}/>;
    if (path === '/account') return <MyAccount standalone onBack={() => navigate('/pending')}/>;
    return <PendingScreen fullName={profile.fullName} onAccount={() => navigate('/account')} onSignOut={() => void signOut()}/>;
  }
  if (profile.status === 'rejected') {
    if (path === '/account') return <MyAccount standalone onBack={() => navigate('/rejected')}/>;
    return <RejectedScreen onAccount={() => navigate('/account')}/>;
  }
  return <ShopDataProvider><PeriodProvider><Router /></PeriodProvider></ShopDataProvider>;
}

export function App() {
  return <AuthProvider><AuthenticatedApp /></AuthProvider>;
}

function Router() {
  const { profile } = useAuth();
  const [path, setPath] = useState(routeKey());
  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const onPopState = () => {
      scrollPositions.set(path, window.scrollY);
      setPath(routeKey());
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.history.scrollRestoration = previousRestoration;
    };
  }, [path]);
  useEffect(() => {
    window.scrollTo({ top: scrollPositions.get(path) ?? 0, behavior: 'instant' });
  }, [path]);
  const isAdmin = profile?.role === 'admin';
  const adminOnly = path === '/sales' || path === '/pos' || path.startsWith('/sales/') || path === '/data-problems' || path === '/team' || path === '/settings' || path === '/verify-accounts';
  let page: ReactNode;
  if (adminOnly && !isAdmin) page = <NotFound title="Page not available" copy="Your STAFF account does not have access to this workspace." back="/"/>;
  else if (path === '/') page = profile?.role === 'staff' ? <StaffHome onOpenProduct={id => navigate(`/inventory/${id}`)}/> : <LiveOverview />;
  else if (path === '/inventory') page = <Inventory />;
  else if (path.startsWith('/inventory/category/')) page = <CategoryInventory id={decodeURIComponent(path.slice('/inventory/category/'.length))} />;
  else if (path.startsWith('/inventory/')) page = <ProductDetail id={decodeURIComponent(path.slice('/inventory/'.length))} />;
  else if (path === '/sales' || path === '/pos') page = <SalesWorkspace />;
  else if (path === '/reservations') page = <Reservations />;
  else if (path.startsWith('/sales/')) page = <Transaction id={decodeURIComponent(path.slice('/sales/'.length))} />;
  else if (path === '/data-problems') page = <DataProblems />;
  else if (path === '/team') page = <TeamAllocation />;
  else if (path === '/notes') page = <Notes />;
  else if (path === '/account') page = <MyAccount />;
  else if (path === '/verify-accounts') page = <VerifyAccounts />;
  else if (path === '/settings') page = <SettingsPage />;
  else page = <NotFound title="Page not found" copy="That page does not exist." back="/" />;
  return <Shell path={path}>{page}</Shell>;
}

function Shell({ path, children }: { path: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { loading, refresh, sales, products } = useShopData();
  const { period } = usePeriod();
  const [exporting, setExporting] = useState(false);
  const isAdmin = profile?.role === 'admin';
  const visibleNav = isAdmin ? adminNav : staffNav;
  const mobileNav = visibleNav.filter(([href]) => href === '/' || href === '/inventory' || href === '/reservations');
  const homeLabel = isAdmin ? 'Overview' : 'Home';
  const closeAndGo = (href: string) => { navigate(href); setMenuOpen(false); };
  return <div className="app-shell"><aside className={`sidebar ${menuOpen ? 'open' : ''}`}><div className="brand drawer-brand"><img className="brand-logo" src="/homies-logo.png" alt="#HOMIES" width="1654" height="651"/><span className="brand-word">PRO SHOP</span></div><div className="sidebar-label">Workspace</div><nav>{visibleNav.map(([href, label, Icon]) => <button key={href} className={path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''} onClick={() => closeAndGo(href)}><Icon size={17}/><span>{label}</span></button>)}</nav><div className="sidebar-bottom">{isAdmin && <><button onClick={() => closeAndGo('/verify-accounts')}><UserCheck size={17}/><span>Verify accounts</span></button><button onClick={() => { setExporting(true); setMenuOpen(false); }}><Download size={17}/><span>Export sheet</span></button><button onClick={() => closeAndGo('/data-problems')}><Database size={17}/><span>Data problems</span></button><button onClick={() => closeAndGo('/settings')}><Settings size={17}/><span>Settings</span></button></>}<button onClick={() => closeAndGo('/account')}><CircleUserRound size={17}/><span>My Account</span></button><div className="profile"><div className="avatar">{profile?.avatarUrl ? <img src={profile.avatarUrl} alt=""/> : profile?.fullName.slice(0, 1).toUpperCase()}</div><div><strong>{profile?.fullName}</strong><span>{profile?.role}</span></div></div><button onClick={() => void signOut()}><LogOut size={17}/><span>Sign out</span></button></div></aside>{menuOpen && <button className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)}/>}{exporting && <ExportDialog period={period} sales={sales} products={products} onClose={() => setExporting(false)}/>}<main className="main"><header className="topbar"><div className="topbar-left"><button className="mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={20}/></button><div className="breadcrumbs"><span>Homies Proshop</span><b>/</b><strong>{path === '/' ? homeLabel : path.split('/')[1]?.replace('-', ' ')}</strong></div></div><img className="topbar-brand" src="/homies-logo.png" alt="#HOMIES" width="1654" height="651"/><div className="top-actions"><span className="sync-dot"><i/> Live database</span><button className="refresh-button" aria-label="Refresh live data" disabled={loading} onClick={() => void refresh()}><RefreshCw size={15}/><span>{loading ? 'Refreshing' : 'Refresh'}</span></button></div></header>{children}</main><nav className="mobile-bottom">{mobileNav.map(([href, label, Icon]) => <button key={href} className={path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''} onClick={() => navigate(href)}><Icon size={18}/><span>{label}</span></button>)}<button aria-label="More" onClick={() => setMenuOpen(true)}><MoreHorizontal size={18}/><span>More</span></button></nav></div>;
}

/* The period comes from the shared context, so the export always matches the
   window the overview is showing, whichever route you trigger it from. */
function ExportDialog({ period, sales, products, onClose }: { period: Period; sales: Sale[]; products: Product[]; onClose: () => void }) {
  const label = periodLabelOf(period);
  const rows = salesForPeriod(sales, period);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = (sections: SheetSections) => {
    downloadSheet(buildSalesSheet(rows, products, label, sections), sheetFilename(label, sections));
    onClose();
  };

  return <div className="sheet-backdrop" onClick={onClose}>
    <div className="sheet export-sheet" role="dialog" aria-modal="true" aria-label="Export sheet" onClick={event => event.stopPropagation()}>
      <div className="sheet-head">
        <div><h2>Export sheet</h2><span>{label} · {rows.length} sale{rows.length === 1 ? '' : 's'}</span></div>
        <button className="sheet-close" onClick={onClose} aria-label="Close"><X size={18}/></button>
      </div>
      <div className="export-options">
        <button className="button button-dark" onClick={() => run({ sales: true, inventory: false })}>
          Sales only<small>{rows.length} sale{rows.length === 1 ? '' : 's'} in {label}</small>
        </button>
        <button className="button button-dark" onClick={() => run({ sales: false, inventory: true })}>
          Inventory only<small>{products.length} products, stock as at now</small>
        </button>
        <button className="button button-primary" onClick={() => run({ sales: true, inventory: true })}>
          Both<small>One sheet, two sections</small>
        </button>
      </div>
    </div>
  </div>;
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

  /* A photo captured at the counter is the truth about that item, so it always
     wins. The line-sheet tile stands in until someone takes one. */
  const photo = product.imageUrl || catalogPhoto(product);

  const tile = photo
    ? <img className={`product-photo ${size}`} src={photo} alt={`${product.name}, ${product.size}`}/>
    : <span className={`product-photo ${size} empty`} aria-hidden="true"><Camera size={size === 'hero' ? 21 : 16}/>{size === 'hero' && <b>Add photo</b>}</span>;

  if (!canManage) return photo ? tile : <span className={`product-photo ${size} empty`} role="img" aria-label="No photo captured"><Camera size={size === 'hero' ? 21 : 16}/>{size === 'hero' && <b>No photo</b>}</span>;

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
  return [...groups.values()].map(group => ({ ...group, variants: [...group.variants].sort((a, b) => a.size.localeCompare(b.size, undefined, { numeric: true }) || a.sku.localeCompare(b.sku)) })).sort(byModelYearThenName);
};

/* At the counter the size is half the identity of the item: two rows reading
   the same product name are a different sale. Size rides with the name
   wherever a sale line is picked or reviewed. An uncaptured size is '—', which
   would read as a typo appended to the name, so it drops out instead. */
const sizedName = (name: string, size: string | null | undefined) => size && size !== '—' ? `${name} · ${size}` : name;

/* Photo-first card. The whole tile is the way into the product page, so the
   photo and the name share one button; the size pills sit outside it, because
   a button nested inside a button is invalid and screen readers drop it. */
function ProductGroupCard({ group, canManage, displayName, categoryLabel }: { group: ProductGroup; canManage: boolean; displayName?: string; categoryLabel?: string }) {
  const [selectedId, setSelectedId] = useState(group.variants[0].id);
  const selected = group.variants.find(product => product.id === selectedId) || group.variants[0];
  const remaining = group.variants.reduce((sum, product) => sum + product.qty, 0);
  const status = statusFor(selected);
  const photo = selected.imageUrl || catalogPhoto(selected);
  const badge = status === 'Out of Stock' ? 'OUT' : status === 'Low Stock' ? 'LOW' : null;
  return <article className="pcard">
    <button type="button" className="pcard-open" onClick={() => navigate(`/inventory/${selected.id}`)}>
      <span className="pcard-photo">
        {photo
          ? <img src={photo} alt="" loading="lazy"/>
          : <span className="pcard-photo-empty"><b>{selected.sku}</b><small>no photo yet</small></span>}
        {badge && <span className={`pcard-badge is-${badge.toLowerCase()}`}>{badge}</span>}
      </span>
      <span className="pcard-title">
        {categoryLabel && <small className="pcard-cat">{categoryLabel}</small>}
        <strong>{displayName || group.name}</strong>
        <small className="pcard-brand">{group.brand}{group.color !== '—' ? ` · ${group.color}` : ''}</small>
      </span>
    </button>
    {group.variants.length > 1 && <div className="pcard-sizes" role="group" aria-label={`Select a size of ${group.name}`}>
      {group.variants.map(product => <button
        key={product.id}
        type="button"
        className={`pcard-size ${product.id === selected.id ? 'is-on' : ''} ${product.qty === 0 ? 'is-empty' : ''}`}
        aria-pressed={product.id === selected.id}
        onClick={() => setSelectedId(product.id)}
      >{product.size}</button>)}
    </div>}
    <div className="pcard-facts">
      <div className="pcard-fact"><span>Size {selected.size}</span><strong>{selected.qty} left</strong></div>
      <div className="pcard-fact"><span>All sizes</span><strong>{remaining}</strong></div>
      <div className="pcard-fact"><span>Price</span><strong>{formatPeso(selected.price)}</strong></div>
    </div>
    {selected.reservedQty > 0 && <span className="reserved-indicator">Reserved {selected.reservedQty}</span>}
    {canManage && <button className="button button-dark pcard-edit" onClick={() => navigate(`/inventory/${selected.id}`)}>Edit item</button>}
  </article>;
}

/* The category tile borrows a photo from the first product in it that has one.
   Photos are matched per style against a 28-card line sheet, so a category
   with nothing photographed is a real case and gets a designed empty tile
   rather than a grey box. */
function categoryPhoto(items: Product[]): string | null {
  for (const item of items) {
    const photo = item.imageUrl || catalogPhoto(item);
    if (photo) return photo;
  }
  return null;
}

function InventoryModeToggle({ mode, onChange }: { mode: 'search' | 'categories'; onChange: (next: 'search' | 'categories') => void }) {
  return <div className="mode-toggle" role="group" aria-label="Inventory view">
    <button type="button" className={mode === 'search' ? 'is-on' : ''} aria-pressed={mode === 'search'} onClick={() => onChange('search')}>Search</button>
    <button type="button" className={mode === 'categories' ? 'is-on' : ''} aria-pressed={mode === 'categories'} onClick={() => onChange('categories')}>Categories</button>
  </div>;
}

function Inventory() {
  const { products, categories, loading, error } = useShopData();
  const { profile } = useAuth();
  const [mode, setMode] = useState<'search' | 'categories'>('search');
  const [adding, setAdding] = useState(false);
  const canManage = profile?.role === 'admin';
  const toggle = <InventoryModeToggle mode={mode} onChange={setMode}/>;

  /* Search is the question the counter actually asks, so admins open on the
     same catalogue screen staff get — minus the rule that hides a styled-out
     size, because for an admin that row is usually the reason they came. */
  if (mode === 'search') return <StaffHomeView
    products={products}
    loading={loading}
    error={error}
    eyebrow="OPERATIONS / INVENTORY"
    includeOutOfStock
    beforeSearch={toggle}
    onOpenProduct={id => navigate(`/inventory/${id}`)}
  />;

  if (loading) return <LoadingState/>;
  if (error) return <ErrorState error={error}/>;
  const totalRemaining = products.reduce((sum, product) => sum + product.qty, 0);
  const allGroups = groupProducts(products);
  return <div className="content">
    <PageHead eyebrow="Operations · Inventory" title="Inventory" copy="Open a category to browse by style and size." action={canManage && <button className="button button-primary" onClick={() => setAdding(value => !value)}><Plus size={16}/>{adding ? 'Close form' : 'Add new item'}</button>}/>
    {toggle}
    {adding && <NewProductForm categories={categories} onCancel={() => setAdding(false)}/>}
    <div className="inventory-summary">
      <div><span>Total remaining</span><strong>{totalRemaining}</strong></div>
      <div><span>Product styles</span><strong>{allGroups.length}</strong></div>
      <div><span>Categories</span><strong>{categories.length}</strong></div>
    </div>
    <div className="cat-grid">{categories.map(category => {
      const items = products.filter(product => product.categoryId === category.id);
      const styles = groupProducts(items);
      const onHand = items.reduce((sum, product) => sum + product.qty, 0);
      const photo = categoryPhoto(items);
      return <button className="cat-tile" key={category.id} onClick={() => navigate(`/inventory/category/${category.id}`)}>
        <span className="cat-tile-photo">
          {photo ? <img src={photo} alt="" loading="lazy"/> : <span className="cat-tile-empty"><Boxes size={22}/></span>}
          <span className="cat-tile-count">{onHand}</span>
        </span>
        <span className="cat-tile-name">{friendlyCategory(category.name)}</span>
        <span className="cat-tile-meta">{styles.length} styles · {items.length} sizes</span>
      </button>;
    })}</div>
  </div>;
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
  const canManage = profile?.role === 'admin';
  const remaining = items.reduce((sum, product) => sum + product.qty, 0);
  const boardYearPattern = /^(\d{4})\s+/;
  const boardGroupsByYear = new Map<string, ProductGroup[]>();
  if (category.name === 'BOARDS') filtered.forEach(group => {
    const year = modelYearOf(group.name) || 'Other';
    boardGroupsByYear.set(year, [...(boardGroupsByYear.get(year) || []), group]);
  });
  /* 'Other' sorts last by hand. Left to the string compare it beats '2026',
     so undated boards would head the page above the current season. */
  const boardYears = [...boardGroupsByYear].map(([year, yearGroups]) => ({ year, groups: yearGroups })).sort((a, b) => {
    if (a.year === 'Other') return 1;
    if (b.year === 'Other') return -1;
    return b.year.localeCompare(a.year, undefined, { numeric: true });
  });
  const productGroups = category.name === 'BOARDS'
    ? <div className="product-year-list">{boardYears.map(section => <section className="product-year-section" key={section.year}><div className="product-year-head"><h2>{section.year}</h2><span>{section.groups.length} style{section.groups.length === 1 ? '' : 's'}</span></div><div className="product-group-grid">{section.groups.map(group => <ProductGroupCard key={group.key} group={group} canManage={canManage} displayName={group.name.replace(boardYearPattern, '')}/>)}</div></section>)}</div>
    : <div className="product-group-grid">{filtered.map(group => <ProductGroupCard key={group.key} group={group} canManage={canManage}/>)}</div>;
  return <div className="content"><button className="back-link" onClick={() => navigate('/inventory')}>← Back to categories</button><PageHead eyebrow="Inventory · Category" title={friendlyCategory(category.name)} copy={`${groups.length} product styles · ${items.length} size variants. Choose a size, then edit that exact inventory item.`} action={canManage && <button className="button button-primary" onClick={() => setAdding(value => !value)}><Plus size={16}/>{adding ? 'Close form' : 'Add new item'}</button>}/>{adding && <NewProductForm categories={categories} defaultCategoryId={category.id} onCancel={() => setAdding(false)}/>}<div className="category-summary"><div><span>Total remaining</span><strong>{remaining}</strong></div><div><span>Product styles</span><strong>{groups.length}</strong></div></div><div className="toolbar category-toolbar"><div className="search"><Search size={17}/><label className="sr-only" htmlFor="category-search">Search this category</label><input id="category-search" placeholder={`Search ${friendlyCategory(category.name).toLowerCase()}…`} value={query} onChange={event => setQuery(event.target.value)}/></div></div>{filtered.length ? productGroups : <div className="empty-state"><Package size={24}/><strong>No products match this search.</strong></div>}<div className="table-footer"><span>Showing {filtered.length} of {groups.length} product styles</span></div></div>;
}

/* `template` carries an existing item in so a new size can be added without
   retyping its identity. The inventory screens group variants by category,
   name, brand, and colour, so a typo in any of those splits the new size onto
   a card of its own instead of filing it under the style it belongs to.
   Copying those fields is what keeps the group intact; SKU and size are left
   empty because they are the only things that must differ. */
const blank = (value: string) => value === '—' ? '' : value;

function NewProductForm({ categories, defaultCategoryId, template, onCancel }: { categories: Category[]; defaultCategoryId?: string; template?: Product; onCancel: () => void }) {
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
  return <Card title={template ? `Add another size of ${template.name}` : 'Add new inventory item'} meta="Admin" wide><form className="product-form new-product-form" onSubmit={submit}>{template && <p className="form-message">Name, brand, and colour are copied from {template.sku} so the new size files under the same product. Give it its own SKU and size.</p>}<label>SKU<input name="sku" placeholder="Unique item code" required autoFocus={!!template}/></label><label>Product name<input name="name" placeholder="Exact product name" defaultValue={template?.name} required/></label><label>Category<select name="category" defaultValue={template?.categoryId || defaultCategoryId || categories[0]?.id} required>{categories.map(item => <option key={item.id} value={item.id}>{friendlyCategory(item.name)}</option>)}</select></label><label>Brand<input name="brand" placeholder="Optional" defaultValue={template && blank(template.brand)}/></label><label>Size<input name="size" placeholder="Optional"/></label><label>Colour<input name="color" placeholder="Optional" defaultValue={template && blank(template.color)}/></label><label>Unit cost<input name="cost" type="number" min="0.01" step="0.01" placeholder="Optional" defaultValue={template?.cost ?? ''}/></label><label>Selling price<input name="price" type="number" min="0.01" step="0.01" placeholder="Optional" defaultValue={template?.price ?? ''}/></label><label>Supplier<input name="supplier" placeholder="Optional" defaultValue={template && blank(template.supplier)}/></label><label>Date received<input name="received" type="date"/></label><label>Opening quantity<input name="openingQuantity" type="number" min="0" step="1" defaultValue="0" required/></label><div className="form-actions"><button type="button" className="button button-dark" onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Adding item…' : 'Add item'}</button></div></form>{message && <p className="form-error" role="alert">{message}</p>}</Card>;
}

function ProductDetail({ id }: { id: string }) {
  const { products, categories, loading, error, refresh } = useShopData();
  const { profile } = useAuth();
  // Declared above the early returns below: the loading and not-found paths
  // must not change how many hooks this component calls.
  const [addingSize, setAddingSize] = useState(false);
  const product = products.find(item => item.id === id);
  if (loading) return <LoadingState/>;
  if (error) return <ErrorState error={error}/>;
  if (!product) return <NotFound title="Product not found" copy="That product is not in the live database." back="/inventory"/>;
  const canManage = profile?.role === 'admin';
  const available = product.qty > product.reservedQty;
  /* Other sizes of the same style. Same key the inventory grid groups by, so
     the two screens always agree on what counts as one product. */
  const siblings = products
    .filter(item => productGroupKey(item) === productGroupKey(product))
    .sort((a, b) => a.size.localeCompare(b.size, undefined, { numeric: true }) || a.sku.localeCompare(b.sku));
  /* Line-sheet tiles are matched per style, so every size of one board points
     at the same file. A rail of eight identical thumbnails is worse than no
     rail, so it lists distinct images only and hides itself below two. */
  const views: Array<{ id: string; photo: string; size: string }> = [];
  siblings.forEach(item => {
    const photo = item.imageUrl || catalogPhoto(item);
    if (photo && !views.some(view => view.photo === photo)) views.push({ id: item.id, photo, size: item.size });
  });
  return <div className="content product-page">
    <button className="back-link" onClick={() => navigate('/inventory')}>← Back to inventory</button>
    <div className="product-page-head"><div><div className="eyebrow">Shop · Product detail</div><p className="product-breadcrumb">{product.category} / {product.brand}</p></div><span className="product-code">{product.sku}</span></div>
    <section className="product-showcase">
      <div className="product-gallery card"><div className="gallery-kicker">{product.color !== '—' ? product.color : 'Product view'}</div><div className="gallery-stage"><ProductPhoto product={product} size="hero" canManage={canManage} onSaved={refresh}/>{views.length > 1 && <div className="gallery-rail" role="group" aria-label="Other views">{views.map(view => <button key={view.id} type="button" className={`gallery-thumb ${view.id === product.id ? 'is-on' : ''}`} aria-current={view.id === product.id} onClick={() => navigate(`/inventory/${view.id}`)}><img src={view.photo} alt={`Size ${view.size}`} loading="lazy"/></button>)}</div>}</div><div className="gallery-caption"><span>HOMIES PROSHOP</span><span>{product.category}</span></div></div>
      <div className="product-buy card"><div className="product-buy-brand">{product.brand}</div><h1>{product.name}</h1><p className="product-buy-subtitle">{product.size !== '—' ? `Size ${product.size}` : 'Size not captured'}{product.color !== '—' ? ` · ${product.color}` : ''}</p>{siblings.length > 1 && <div className="detail-sizes" role="group" aria-label="Other sizes of this product">{siblings.map(item => <button key={item.id} type="button" className={`pcard-size ${item.id === product.id ? 'is-on' : ''} ${item.qty === 0 ? 'is-empty' : ''}`} aria-current={item.id === product.id} onClick={() => navigate(`/inventory/${item.id}`)}>{item.size}</button>)}</div>}<div className="product-price">{formatPeso(product.price)}</div><div className="product-availability"><StatusBadge status={statusFor(product)}/><span>{available ? `${product.qty} available` : 'Currently unavailable'}</span></div><div className="product-spec-row"><span>SKU</span><strong>{product.sku}</strong></div><div className="product-spec-row"><span>Category</span><strong>{product.category}</strong></div>{canManage && <div className="product-buy-actions"><button className="button button-primary product-sale-button" disabled={!available} onClick={() => navigate('/pos')}><ShoppingBag size={17}/>{available ? 'Add to sale' : 'Out of stock'}</button><button className="button button-dark" onClick={() => document.querySelector('.product-management')?.scrollIntoView({ behavior: 'smooth' })}>Edit details</button></div>}<p className="product-note">Live stock is checked from the shop database. Reserved units are excluded from the available count.</p></div>
    </section>
    <div className="detail-grid"><Card title="Item overview" meta={product.category}><div className="detail-fields">{([['SKU', product.sku], ['Size', product.size], ['Color', product.color], ['Supplier', product.supplier], ...(product.received ? [['Date received', product.received]] : [])] as string[][]).map(([label, value]) => <div key={label}><span>{label}</span><FieldValue value={value}/></div>)}</div></Card><Card title="Stock & pricing" meta="PHP"><div className="big-stock"><span>Current stock</span><strong>{product.qty}</strong><StatusBadge status={statusFor(product)}/></div><div className="detail-fields two">{([['Selling price', formatPeso(product.price)], ...(product.cost === null ? [] : [['Unit cost', formatPeso(product.cost)], ['Unit margin', formatPeso(marginFor(product))]]), ['Inventory value', formatPeso(product.qty * (product.price || 0))], ['Units sold', String(product.sold)]] as string[][]).map(([label, value]) => <div key={label}><span>{label}</span><FieldValue value={value}/></div>)}</div></Card></div>
    {canManage && <><StockPanel product={product} onSaved={refresh}/>{addingSize
      ? <NewProductForm categories={categories} template={product} onCancel={() => setAddingSize(false)}/>
      : <button className="button button-dark" onClick={() => setAddingSize(true)}><Plus size={16}/>Add another size</button>}<div className="product-management"><ProductEditor product={product} categories={categories} onSaved={refresh}/></div></>}
  </div>;
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
  return <Card title="Product management" meta="Admin" wide><button className="button button-dark" onClick={() => setOpen(value => !value)}>{open ? 'Close editor' : 'Edit product'}</button>{open && <form className="product-form" onSubmit={submit}><label>SKU<input name="sku" defaultValue={product.sku} required/></label><label>Name<input name="name" defaultValue={product.name} required/></label><label>Category<select name="category" defaultValue={product.categoryId}>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Brand<input name="brand" defaultValue={product.brand === '—' ? '' : product.brand}/></label><label>Size<input name="size" defaultValue={product.size === '—' ? '' : product.size}/></label><label>Colour<input name="color" defaultValue={product.color === '—' ? '' : product.color}/></label><label>Unit cost<input name="cost" type="number" min="0.01" step="0.01" defaultValue={product.cost ?? ''}/></label><label>Selling price<input name="price" type="number" min="0.01" step="0.01" defaultValue={product.price ?? ''}/></label><label>Supplier<input name="supplier" defaultValue={product.supplier === '—' ? '' : product.supplier}/></label><label>Date received<input name="received" type="date" defaultValue={product.received}/></label><label className="checkbox"><input name="active" type="checkbox" defaultChecked={product.isActive}/>Active product</label><button className="button button-primary">Save product</button></form>}{message && <p className="form-message">{message}</p>}</Card>;
}

function SalesWorkspace() {
  const { loading, error } = useShopData();
  const [showRecords, setShowRecords] = useState(false);
  if (loading) return <LoadingState/>;
  if (error) return <ErrorState error={error}/>;
  return <div className="content"><PageHead eyebrow="Operations · Sales" title="Sales" copy="Ring up a sale, then reveal the records only when you need them." action={<button className="button button-dark" aria-expanded={showRecords} onClick={() => setShowRecords(value => !value)}>{showRecords ? 'Hide sale records' : 'Show sale records'}</button>}/><Pos embedded/>{showRecords && <SalesRecords/>}</div>;
}

function SalesRecords() {
  const { sales, loading, error } = useShopData();
  if (loading) return <LoadingState/>;
  if (error) return <ErrorState error={error}/>;
  const period = reportingPeriod(sales.filter(sale => sale.status === 'completed'));
  const revenue = period.sales.reduce((sum, sale) => sum + (saleTotal(sale) || 0), 0);
  return <section className="sales-records"><div className="card-head"><div><h2>Sale records</h2><span>Completed and voided transactions · {period.label}</span></div></div><div className="inventory-summary"><div><span>Revenue</span><strong>{formatPeso(revenue)}</strong></div><div><span>Units sold</span><strong>{period.sales.reduce((sum, sale) => sum + sale.qty, 0)}</strong></div><div><span>Transactions</span><strong>{period.sales.length}</strong></div><div><span>All records</span><strong>{sales.length}</strong></div></div><div className="card"><div className="sales-list">{sales.map(sale => <button key={sale.id} onClick={() => navigate(`/sales/${sale.id}`)}><span className="sale-date">{sale.date}{saleTime(sale) && <small>{saleTime(sale)}</small>}</span><span><strong>{sale.product}</strong><small>{sale.id.slice(0, 8)} · {sale.qty} unit{sale.qty === 1 ? '' : 's'} · {sale.status} · {sale.paymentStatus} · {sale.sellerName || 'Unknown seller'}</small></span><strong>{formatPeso(sale.total)}</strong><ChevronDown size={15}/></button>)}</div></div></section>;
}

function Transaction({ id }: { id: string }) {
  const { sales, products, loading, error, refresh } = useShopData();
  const { profile } = useAuth();
  const [message, setMessage] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNote, setPaymentNote] = useState('');
  if (loading) return <LoadingState/>;
  if (error) return <ErrorState error={error}/>;
  const sale = sales.find(item => item.id === id);
  if (!sale) return <NotFound title="Transaction not found" copy="That sale does not exist." back="/sales"/>;
  async function voidSale() { if (!confirm('Void this sale and return its stock?')) return; try { await shopRepository.voidSale(id); setMessage('Sale voided and stock returned.'); await refresh(); } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Void failed.'); } }
  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setMessage('Enter a payment amount greater than zero.'); return; }
    try { await shopRepository.recordSalePayment(id, amount, paymentMethod, paymentNote.trim() || null); setPaymentAmount(''); setPaymentNote(''); setMessage('Payment recorded.'); await refresh(); } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Payment could not be recorded.'); }
  }
  const canRecordPayment = profile?.role === 'admin' && sale.status === 'completed' && !sale.isHistorical && sale.balanceDue !== null && sale.balanceDue > 0;
  /* Sale lines store the product name as it was at the time, not the size, so
     the size is read back off the product. Imported rows with no product link
     simply have none to show. */
  const sizeOf = new Map(products.map(product => [product.id, product.size]));
  return <div className="content print-receipt"><button className="back-link no-print" onClick={() => navigate('/sales')}>← Back to sales</button><PageHead eyebrow="Sales · Transaction" title={sale.id.slice(0, 8).toUpperCase()} copy={`${sale.date}${saleTime(sale) ? ` · ${saleTime(sale)}` : " · time not recorded on import"} · ${sale.status}`} action={<button className="button button-dark no-print" onClick={() => window.print()}><Printer size={16}/>Print</button>}/><Card title="Receipt" meta={sale.paymentMethod || 'Payment method unavailable'}><div className="receipt-parties"><div><span>Customer</span><strong>{sale.customerName || 'Walk-in'}</strong></div><div><span>Sold by</span><strong>{sale.sellerName || sale.sellerNote || (sale.isHistorical ? 'Imported record' : 'Unknown')}</strong>{!sale.sellerName && sale.sellerNote && <small className="from-sheet">from source sheet</small>}</div><div><span>Payment status</span><strong className={`payment-status payment-${sale.paymentStatus}`}>{sale.paymentStatus === 'not-captured' ? 'Not captured' : sale.paymentStatus}</strong></div></div><div className="transaction-row header"><span>Product</span><span>Qty</span><span>Unit price</span><span>Total</span></div>{sale.items.map(item => { const size = item.productId ? sizeOf.get(item.productId) : null; return <div className="transaction-row" key={item.id}><span><strong>{sizedName(item.description, size)}</strong><small>{[size && size !== '—' ? `Size ${size}` : null, item.sku || 'Historical unmatched item'].filter(Boolean).join(' · ')}</small></span><span>{item.qty}</span><span>{formatPeso(item.unitPrice)}</span><strong>{formatPeso(item.lineTotal)}</strong></div>; })}<div className="transaction-total"><span>Subtotal</span><strong>{formatPeso(sale.subtotal)}</strong><span>Discount</span><strong>{formatPeso(sale.discount)}</strong><span>Total</span><strong>{formatPeso(sale.total)}</strong><span>Paid</span><strong>{formatPeso(sale.amountPaid)}</strong><span>Balance due</span><strong>{formatPeso(sale.balanceDue)}</strong></div>{sale.payments.length > 0 && <div className="payment-history"><strong>Payment history</strong>{sale.payments.map(payment => <div key={payment.id}><span>{payment.paidAt.slice(0, 10)} · {payment.paymentMethod}</span><b>{formatPeso(payment.amount)}</b></div>)}</div>}</Card>{canRecordPayment && <Card title="Record payment" meta={`Balance due ${formatPeso(sale.balanceDue ?? 0)}`}><form className="payment-form" onSubmit={recordPayment}><label>Amount received<input type="number" min="0.01" max={sale.balanceDue ?? undefined} step="0.01" value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)} required/></label><label>Payment method<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option>Cash</option><option>GCash</option><option>Card</option><option>Bank transfer</option><option>Other</option></select></label><label>Note <em>optional</em><input value={paymentNote} onChange={event => setPaymentNote(event.target.value)} placeholder="e.g. second deposit"/></label><button className="button button-primary">Save payment</button></form></Card>}{profile?.role === 'admin' && sale.status === 'completed' && !sale.isHistorical && <button className="button button-dark no-print" onClick={() => void voidSale()}>Void sale</button>}{message && <p className="form-message">{message}</p>}</div>;
}

function Reservations() {
  const { products, reservations, loading, error, refresh } = useShopData();
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<Array<{ productId: string; qty: number }>>([]);
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [message, setMessage] = useState('');
  if (loading) return <LoadingState/>;
  if (error) return <ErrorState error={error}/>;
  const search = query.trim().toLowerCase();
  const available = (product: Product) => Math.max(0, product.qty - product.reservedQty);
  const matches = search ? products.filter(product => product.isActive && available(product) > 0 && `${product.name} ${product.sku}`.toLowerCase().includes(search)).slice(0, 10) : [];
  const active = reservations.filter(reservation => reservation.status === 'reserved');
  function add(product: Product) {
    const limit = available(product);
    if (!limit) return;
    setLines(current => { const existing = current.find(line => line.productId === product.id); if (existing) return current.map(line => line.productId === product.id ? { ...line, qty: Math.min(limit, line.qty + 1) } : line); return [...current, { productId: product.id, qty: 1 }]; });
  }
  function change(productId: string, qty: number) { const product = products.find(item => item.id === productId); const limit = product ? available(product) : 0; setLines(current => current.map(line => line.productId === productId ? { ...line, qty: Math.min(limit, Math.max(0, qty)) } : line).filter(line => line.qty > 0)); }
  async function create() { setMessage(''); if (!lines.length) { setMessage('Add at least one item to reserve.'); return; } try { await shopRepository.createReservation(lines, customerName.trim() || null, note.trim() || null, expiresAt || null); setLines([]); setCustomerName(''); setNote(''); setExpiresAt(''); setQuery(''); setMessage('Reservation created. Stock remains available until it is pushed as a sale.'); await refresh(); } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Reservation could not be created.'); } }
  async function cancel(id: string) { if (!confirm('Cancel this reservation and release its held quantity?')) return; try { await shopRepository.cancelReservation(id); setMessage('Reservation cancelled and quantity released.'); await refresh(); } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Reservation could not be cancelled.'); } }
  async function pushAsSale(id: string) { if (!confirm('Push this reservation as a sale? This will deduct the held quantity from inventory.')) return; try { const saleId = await shopRepository.convertReservation(id); await refresh(); navigate(`/sales/${saleId}`); } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Reservation could not be pushed as a sale.'); } }
  return <div className="content"><PageHead eyebrow="Operations · Reservations" title="Reservations" copy="Hold stock for a customer without changing on-hand inventory."/><div className="reservation-layout"><Card title="New reservation" meta="Held quantity is not deducted"><div className="search"><Search size={17}/><label className="sr-only" htmlFor="reservation-search">Search products</label><input id="reservation-search" placeholder="Search product or SKU…" value={query} onChange={event => setQuery(event.target.value)}/>{search && <button className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={16}/></button>}</div>{search && <div className="pos-results">{matches.map(product => <button key={product.id} onClick={() => add(product)}><span><strong>{product.name}</strong><small>{product.sku} · {available(product)} available</small></span><b>{formatPeso(product.price)}</b></button>)}{!matches.length && <p className="empty-copy">No available product matches that.</p>}</div>}<div className="reservation-items">{lines.map(line => { const product = products.find(item => item.id === line.productId); if (!product) return null; return <div className="reservation-item" key={line.productId}><span><strong>{product.name}</strong><small>{product.sku} · {product.size}</small></span><label>Qty<input type="number" min="1" max={available(product)} value={line.qty} onChange={event => change(line.productId, Number(event.target.value))}/></label><button className="icon-button" aria-label={`Remove ${product.name}`} onClick={() => change(line.productId, 0)}><X size={15}/></button></div>; })}</div>{!lines.length && <p className="empty-copy">Search and add items to hold for a customer.</p>}<div className="reservation-form"><label>Customer name<input placeholder="Customer or contact name" value={customerName} onChange={event => setCustomerName(event.target.value)}/></label><label>Note <em>optional</em><input placeholder="Pickup details or context" value={note} onChange={event => setNote(event.target.value)}/></label><label>Expiry date <em>optional</em><input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)}/></label><button className="button button-primary" onClick={() => void create()}>Create reservation</button>{message && <p className="form-message" role="status">{message}</p>}</div></Card><Card title="Open reservations" meta={`${active.length} open`}><div className="reservation-list">{active.map(reservation => <article className="reservation-card" key={reservation.id}><div className="reservation-card-head"><div><strong>{reservation.customerName || 'Unnamed customer'}</strong><small>Reserved {new Date(reservation.reservedAt).toLocaleDateString('en-PH')}{reservation.expiresAt ? ` · Expires ${reservation.expiresAt}` : ''}</small></div><span className="reserved-indicator">Reserved</span></div><div className="reservation-card-items">{reservation.items.map(item => <span key={item.id}>{item.productName} · {item.sku} × {item.qty}</span>)}</div>{reservation.note && <p>{reservation.note}</p>}<div className="reservation-actions"><button className="button button-dark" onClick={() => void cancel(reservation.id)}>Cancel</button>{profile?.role === 'admin' && <button className="button button-primary" onClick={() => void pushAsSale(reservation.id)}>Push as sale</button>}</div></article>)}{!active.length && <div className="empty-state"><CalendarClock size={24}/><strong>No open reservations.</strong><span>Reserved items will appear here with a clear held-stock indicator.</span></div>}</div></Card></div></div>;
}

function Pos({ embedded = false }: { embedded?: boolean }) {
  const { products, refresh } = useShopData();
  const [query, setQuery] = useState('');
  const { lines: cart, subtotal, add, setQty, setDiscount, clear } = useCart();
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerName, setCustomerName] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [message, setMessage] = useState('');
  // Nothing is listed until something is typed. An empty query used to match
  // every product, filling the panel with twelve arbitrary items before the
  // sale had even started.
  const search = query.trim();
  const matches = search ? products.filter(product => product.isActive && availableOf(product) > 0 && product.price !== null && `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase())).slice(0, 12) : [];
  const total = Math.max(0, subtotal - orderDiscount);
  const amountPaidValue = amountPaid.trim() === '' ? total : Number(amountPaid);
  async function complete() { setMessage(''); if (!cart.length) { setMessage('Add at least one product.'); return; } if (!Number.isFinite(amountPaidValue) || amountPaidValue < 0 || amountPaidValue > total) { setMessage('Amount received must be between ₱0 and the sale total.'); return; } try { const saleId = await shopRepository.completeSale(cart, orderDiscount, paymentMethod, customerName.trim() || null, amountPaidValue, sellerName.trim() || null); clear(); setOrderDiscount(0); setCustomerName(''); setSellerName(''); setAmountPaid(''); await refresh(); navigate(`/sales/${saleId}`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Sale failed.'); } }
  return <div className={embedded ? 'pos-workspace-panel' : 'content'}>{!embedded && <PageHead eyebrow="Counter POS" title="Ring up a sale" copy="Availability is checked again inside the database transaction."/>}<div className="pos-layout"><Card title="Find products" meta={search ? `${matches.length} match${matches.length === 1 ? '' : 'es'}` : 'In stock and priced'}><div className="search"><Search size={17}/><input aria-label="Search products" placeholder="Search product or SKU…" value={query} onChange={event => setQuery(event.target.value)}/>{search && <button className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={16}/></button>}</div>{search ? (matches.length ? <div className="pos-results">{matches.map(product => <button key={product.id} onClick={() => add(product)}><span><strong>{sizedName(product.name, product.size)}</strong><small>{product.sku} · {availableOf(product)} available{product.reservedQty ? ` · ${product.reservedQty} reserved` : ''}</small></span><b>{formatPeso(product.price)}</b></button>)}</div> : <p className="empty-copy">No available product matches that.</p>) : <p className="empty-copy">Search by product name or SKU to add a line.</p>}</Card><Card title="Current sale" meta={`${cart.length} lines`}><div className="cart-lines">{cart.map(line => { const product = products.find(item => item.id === line.productId)!; return <div key={line.productId}><span><strong>{sizedName(product.name, product.size)}</strong><small>{product.sku} · {availableOf(product)} available{product.reservedQty ? ` · ${product.reservedQty} reserved` : ''}</small></span><label>Qty<input type="number" min="0" max={availableOf(product)} step="1" value={line.qty} onChange={event => setQty(line.productId, Number(event.target.value))}/></label><label>Line discount<input type="number" min="0" step="0.01" value={line.discount} onChange={event => setDiscount(line.productId, Number(event.target.value))}/></label><b>{formatPeso(line.qty * line.unitPrice - line.discount)}</b></div>; })}</div>{!cart.length && <p className="empty-copy">No products added.</p>}<div className="pos-checkout"><label>Customer name <em>optional</em><input placeholder="Walk-in" value={customerName} onChange={event => setCustomerName(event.target.value)}/></label><label>Seller name <em>optional</em><input placeholder="Who sold the item?" value={sellerName} onChange={event => setSellerName(event.target.value)}/></label><label>Order discount<input type="number" min="0" max={subtotal} step="0.01" value={orderDiscount} onChange={event => setOrderDiscount(Number(event.target.value))}/></label><label>Payment method<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option>Cash</option><option>GCash</option><option>Card</option><option>Bank transfer</option><option>Other</option></select></label><label>Amount received <em>leave blank for full payment</em><input type="number" min="0" max={total} step="0.01" placeholder={total ? String(total) : '0'} value={amountPaid} onChange={event => setAmountPaid(event.target.value)}/></label><div><span>Balance due</span><strong>{formatPeso(Math.max(0, total - amountPaidValue))}</strong></div><button className="button button-primary" onClick={() => void complete()}>Complete sale</button>{message && <p className="form-error" role="alert">{message}</p>}</div></Card></div></div>;
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
