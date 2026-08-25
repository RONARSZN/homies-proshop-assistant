import { useEffect, useState, type FormEvent } from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import Users from 'lucide-react/dist/esm/icons/users.mjs';
import { useAuth } from './AuthProvider';
import { shopRepository } from './repository';
import { useShopData } from './useShopData';
import type { RiderAllocation, TeamRider } from './types';

const navigate = (path: string) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); };

/**
 * Gear handed to a sponsored rider. Not a sale — no revenue and no customer —
 * but it leaves the shop, so it is recorded as a stock movement and the
 * on-hand count falls exactly as it would for a sale.
 */
export function TeamAllocation() {
  const { products, loading, error, refresh } = useShopData();
  const { profile } = useAuth();
  const canManage = profile?.role === 'owner' || profile?.role === 'manager';

  const [riders, setRiders] = useState<TeamRider[]>([]);
  const [allocations, setAllocations] = useState<RiderAllocation[]>([]);
  const [panelError, setPanelError] = useState('');
  const [message, setMessage] = useState('');
  const [addingRider, setAddingRider] = useState(false);
  const [busy, setBusy] = useState(false);
  const [riderId, setRiderId] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');

  const load = async () => {
    try {
      const [riderRows, allocationRows] = await Promise.all([shopRepository.getRiders(), shopRepository.getAllocations()]);
      setRiders(riderRows);
      setAllocations(allocationRows);
      setPanelError('');
    } catch (caught) {
      setPanelError(caught instanceof Error ? caught.message : 'Team data could not be loaded.');
    }
  };
  useEffect(() => { void load(); }, []);

  if (loading) return <div className="content"><div className="loading-state"><div className="eyebrow">Team</div><h1>Loading team data…</h1></div></div>;
  if (error) return <div className="content"><div className="loading-state"><div className="eyebrow">Data unavailable</div><h1>Live database unavailable.</h1><p>{error}</p></div></div>;

  const search = productQuery.trim().toLowerCase();
  const matches = search
    ? products.filter(product => product.isActive && product.qty > 0 && `${product.name} ${product.sku}`.toLowerCase().includes(search)).slice(0, 8)
    : [];
  const selectedProduct = products.find(product => product.id === productId) || null;
  const unitsFor = (id: string) => allocations.filter(item => item.riderId === id).reduce((sum, item) => sum + item.qty, 0);
  const activeRiders = riders.filter(rider => rider.isActive);
  const totalUnits = allocations.reduce((sum, item) => sum + item.qty, 0);

  async function addRider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get('fullName') || '').trim();
    if (!fullName) { setMessage('A rider name is required.'); return; }
    setBusy(true); setMessage('');
    try {
      await shopRepository.createRider(fullName, String(form.get('nickname') || '').trim() || null, String(form.get('note') || '').trim() || null);
      setAddingRider(false);
      await load();
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Rider could not be added.'); }
    finally { setBusy(false); }
  }

  async function allocate(event: FormEvent) {
    event.preventDefault();
    const amount = Number(qty);
    if (!riderId) { setMessage('Choose a rider.'); return; }
    if (!selectedProduct) { setMessage('Choose a product to allocate.'); return; }
    if (!Number.isInteger(amount) || amount < 1) { setMessage('Quantity must be a whole number of at least one.'); return; }
    if (amount > selectedProduct.qty) { setMessage(`Only ${selectedProduct.qty} in stock.`); return; }
    setBusy(true); setMessage('');
    try {
      await shopRepository.allocateToRider(riderId, selectedProduct.id, amount, note.trim() || null);
      setProductId(''); setProductQuery(''); setQty('1'); setNote('');
      setMessage('Gear allocated and stock updated.');
      await Promise.all([load(), refresh()]);
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Allocation failed.'); }
    finally { setBusy(false); }
  }

  return <div className="content">
    <div className="page-head">
      <div><div className="eyebrow">Operations · Team</div><h1>Team allocation</h1><p>Gear handed to team riders. Stock falls the same way it does for a sale, but nothing is charged.</p></div>
      {canManage && <button className="button button-primary" onClick={() => setAddingRider(value => !value)}><Plus size={16}/>{addingRider ? 'Close form' : 'Add rider'}</button>}
    </div>

    {panelError && <div className="data-note" role="alert">{panelError}</div>}

    <div className="inventory-summary">
      <div><span>Active riders</span><strong>{activeRiders.length}</strong></div>
      <div><span>Units allocated</span><strong>{totalUnits}</strong></div>
      <div><span>Allocations</span><strong>{allocations.length}</strong></div>
    </div>

    {addingRider && canManage && <section className="card wide">
      <div className="card-head"><div><h2>Add rider</h2><span>Owner or manager</span></div></div>
      <form className="product-form" onSubmit={addRider}>
        <label>Rider name<input name="fullName" placeholder="Full name" required/></label>
        <label>Nickname<input name="nickname" placeholder="Optional"/></label>
        <label>Note<input name="note" placeholder="Optional"/></label>
        <div className="form-actions"><button type="button" className="button button-dark" onClick={() => setAddingRider(false)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Adding…' : 'Add rider'}</button></div>
      </form>
    </section>}

    <div className="team-layout">
      <section className="card">
        <div className="card-head"><div><h2>Allocate gear</h2><span>{canManage ? 'Owner or manager' : 'View only'}</span></div></div>
        {!canManage && <p className="empty-copy">Your role can view allocations but not record them.</p>}
        {canManage && (activeRiders.length === 0
          ? <p className="empty-copy">Add a rider first.</p>
          : <form className="allocate-form" onSubmit={allocate}>
              <label htmlFor="allocate-rider">Rider</label>
              <select id="allocate-rider" value={riderId} onChange={event => setRiderId(event.target.value)}>
                <option value="">Choose a rider…</option>
                {activeRiders.map(rider => <option key={rider.id} value={rider.id}>{rider.fullName}{rider.nickname ? ` (${rider.nickname})` : ''}</option>)}
              </select>

              <label htmlFor="allocate-product">Product</label>
              {selectedProduct
                ? <div className="chosen-product"><span><strong>{selectedProduct.name}</strong><small>{selectedProduct.sku} · {selectedProduct.size} · {selectedProduct.qty} in stock</small></span><button type="button" className="button" onClick={() => { setProductId(''); setProductQuery(''); }}>Change</button></div>
                : <>
                    <input id="allocate-product" placeholder="Search product or SKU…" value={productQuery} onChange={event => setProductQuery(event.target.value)}/>
                    {search && (matches.length
                      ? <div className="pos-results">{matches.map(product => <button type="button" key={product.id} onClick={() => setProductId(product.id)}><span><strong>{product.name}</strong><small>{product.sku} · {product.qty} in stock</small></span></button>)}</div>
                      : <p className="empty-copy">No product in stock matches that.</p>)}
                  </>}

              <label htmlFor="allocate-qty">Quantity</label>
              <input id="allocate-qty" type="number" min="1" step="1" value={qty} onChange={event => setQty(event.target.value)}/>

              <label htmlFor="allocate-note">Note</label>
              <input id="allocate-note" placeholder="Optional — event, season, reason" value={note} onChange={event => setNote(event.target.value)}/>

              <button className="button button-primary" disabled={busy}>{busy ? 'Allocating…' : 'Allocate gear'}</button>
            </form>)}
        {message && <p className="form-message" role="status">{message}</p>}
      </section>

      <section className="card">
        <div className="card-head"><div><h2>Riders</h2><span>{riders.length} on the team</span></div></div>
        {riders.length === 0
          ? <div className="empty-state"><Users size={24}/><strong>No riders yet.</strong><span>Add a rider to start allocating gear.</span></div>
          : <div className="rider-list">{riders.map(rider => <div key={rider.id} className={rider.isActive ? '' : 'inactive'}>
              <span className="rider-name"><strong>{rider.fullName}</strong><small>{rider.nickname || (rider.isActive ? 'Active' : 'Inactive')}</small></span>
              <span className="rider-units"><strong>{unitsFor(rider.id)}</strong><small>units</small></span>
              {canManage && <button className="button" onClick={() => void shopRepository.setRiderActive(rider.id, !rider.isActive).then(load)}>{rider.isActive ? 'Deactivate' : 'Reactivate'}</button>}
            </div>)}</div>}
      </section>
    </div>

    <section className="card wide">
      <div className="card-head"><div><h2>Recent allocations</h2><span>{allocations.length} recorded</span></div></div>
      {allocations.length === 0
        ? <p className="empty-copy">Nothing allocated yet.</p>
        : <div className="movement-list">{allocations.slice(0, 25).map(item => {
            const rider = riders.find(entry => entry.id === item.riderId);
            return <div key={item.id}>
              <span>{new Date(item.createdAt).toLocaleString('en-PH')}</span>
              <strong>{rider?.fullName || 'Unknown rider'}</strong>
              <b className="negative">−{item.qty}</b>
              <small><button className="text-link" onClick={() => navigate(`/inventory/${item.productId}`)}>{item.productName}</button> · {item.sku}{item.note ? ` · ${item.note}` : ''}</small>
            </div>;
          })}</div>}
    </section>
  </div>;
}
