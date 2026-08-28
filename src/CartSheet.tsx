import Minus from 'lucide-react/dist/esm/icons/minus.mjs';
import Package from 'lucide-react/dist/esm/icons/package.mjs';
import Plus from 'lucide-react/dist/esm/icons/plus.mjs';
import X from 'lucide-react/dist/esm/icons/x.mjs';
import { availableOf, lineTotal } from './cart';
import { formatPeso } from './domain';
import { catalogPhoto } from './productPhotos';
import { useCart } from './useCart';
import { useShopData } from './useShopData';

/* The reference's cart sheet, in the app's own dialog. A line names a product
   by id only, so the sheet resolves it against live shop data every render —
   which also means a product deleted or emptied since it was added shows its
   real availability here rather than at checkout. */
export function CartSheet({ onCheckout }: { onCheckout: () => void }) {
  const { lines, open, subtotal, count, setQty, remove, closeCart } = useCart();
  const { products } = useShopData();
  if (!open) return null;
  const discount = lines.reduce((sum, line) => sum + line.discount, 0);
  return <div className="sheet-backdrop" onClick={closeCart}>
    <div className="sheet cart-sheet" role="dialog" aria-modal="true" aria-label="Current sale" onClick={event => event.stopPropagation()}>
      <div className="sheet-head">
        <div><h2>Current sale</h2><span>{count} unit{count === 1 ? '' : 's'} · {lines.length} line{lines.length === 1 ? '' : 's'}</span></div>
        <button className="sheet-close" onClick={closeCart} aria-label="Close"><X size={18}/></button>
      </div>

      {lines.length === 0
        ? <div className="empty-state"><Package size={24}/><strong>Nothing added yet.</strong><span>Add a product from the catalogue to start a sale.</span></div>
        : <div className="cart-lines-sheet">{lines.map(line => {
            const product = products.find(item => item.id === line.productId);
            if (!product) return <div className="cart-line is-missing" key={line.productId}>
              <span className="cart-line-name"><strong>Item no longer in the catalogue</strong><small>{line.productId.slice(0, 8)}</small></span>
              <button className="cart-line-remove" aria-label="Remove missing item" onClick={() => remove(line.productId)}><X size={15}/></button>
            </div>;
            const photo = product.imageUrl || catalogPhoto(product);
            const available = availableOf(product);
            return <div className="cart-line" key={line.productId}>
              {/* Decorative: the product name sits beside it. */}
              {photo ? <img className="cart-line-photo" src={photo} alt=""/> : <span className="cart-line-photo empty" aria-hidden="true"><Package size={16}/></span>}
              <span className="cart-line-name">
                <strong>{product.name}</strong>
                <small>{[product.size !== '—' ? `Size ${product.size}` : null, product.color !== '—' ? product.color : null, product.sku].filter(Boolean).join(' · ')}</small>
                {line.qty > available && <em className="cart-line-warn">Only {available} available</em>}
              </span>
              <span className="cart-step" role="group" aria-label={`Quantity of ${product.name}`}>
                <button type="button" aria-label="One fewer" onClick={() => setQty(line.productId, line.qty - 1)}><Minus size={14}/></button>
                <b>{String(line.qty).padStart(2, '0')}</b>
                <button type="button" aria-label="One more" disabled={line.qty >= available} onClick={() => setQty(line.productId, line.qty + 1)}><Plus size={14}/></button>
              </span>
              <span className="cart-line-total">{formatPeso(lineTotal(line))}</span>
              <button className="cart-line-remove" aria-label={`Remove ${product.name}`} onClick={() => remove(line.productId)}><X size={15}/></button>
            </div>;
          })}</div>}

      <div className="cart-totals">
        <div><span>Sub-total</span><strong>{formatPeso(subtotal + discount)}</strong></div>
        <div><span>Line discounts</span><strong>{discount ? `−${formatPeso(discount)}` : formatPeso(0)}</strong></div>
        <div className="is-total"><span>Total</span><strong>{formatPeso(subtotal)}</strong></div>
      </div>
      <button className="button button-primary cart-checkout" disabled={!lines.length} onClick={() => { closeCart(); onCheckout(); }}>
        Go to checkout
      </button>
      <p className="cart-note">Customer, seller, payment method and amount received are captured at the counter before the sale is completed.</p>
    </div>
  </div>;
}
