# Storefront Presentation & Cart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present shop products in the three-screen storefront shape of the Trendora reference — photo-first browse cards, a hero-and-sheet product page, and a cart sheet that checks out — rendered entirely in the existing counter-poster visual language.

**Architecture:** A new `CartProvider` (context + `localStorage`) becomes the single owner of `CartLine[]`; the existing `Pos` component stops holding its own cart state and reads the shared one, so a line added from a product card or product page is the same line the counter checks out. A `usePins` hook backs the reference's heart control as a device-local staff shortlist. The three screens are re-laid-out in place — `ProductGroupCard`, `ProductDetail`, and a new `CartSheet` — reusing the app's existing `.sheet-backdrop`/`.sheet` dialog primitives so nothing new is invented visually.

**Tech Stack:** React 19 + TypeScript 7, Vite 8, plain CSS (`styles.css` then `inventory.css`), Supabase JS 2, lucide-react icons. Vitest + jsdom are added by Task 1 — the repo currently has no test runner.

**Spec:** This document is self-contained; it was written from the reference screenshot supplied in-session plus these four decisions the user made:
1. Scope: all three reference screens, **and add a working cart function**.
2. Card density: **keep everything, restyle** — no information is dropped from `ProductGroupCard`, it is re-laid-out photo-first.
3. The reference's heart becomes a **Pin** (device-local shortlist); detail actions stay Add-to-sale plus Edit details.
4. **No chip rail** — the existing Search/Categories toggle and category page stay as they are.

## Global Constraints

- **Visual language is fixed.** Bone ground `--canvas: #EDE8DE`, one oxblood `--red: #9a0002`, one accent `--ember: #E4622B`. **No soft shadows, no gradients.** Corners are `--r-card: 4px` / `--r-tile: 4px`; only controls take `--r-pill: 999px`. Do not import the reference's pastel palette or its 20px radii.
- **Type:** `Archivo` for prose/headings, `var(--mono)` (`DM Mono`) for every number, code, SKU, and uppercase micro-label.
- **Money** is always rendered through `formatPeso` from `./domain` — never hand-formatted.
- **No new dependencies** beyond `vitest` + `jsdom` + `@testing-library/react` in Task 1. No CSS framework, no state library, no router library.
- **Sheet CSS lives in `inventory.css`, not `styles.css`.** `main.tsx` imports `inventory.css` after `styles.css` on purpose so equal-specificity overrides win. New rules that override a shared rule go in `inventory.css`.
- **iOS insets:** anything pinned to the bottom must clear both the bottom nav and the home indicator — `bottom: calc(62px + env(safe-area-inset-bottom, 0px))`.
- **Buttons never nest.** A card is opened by one `<button class="pcard-open">`; every other control on the card is a sibling of it, never a child.
- **Availability** for anything sellable is `product.qty - product.reservedQty`, and a product with `price === null` is not sellable.
- **Lint gate:** `npm run lint` (which is `tsc -b --pretty false`) must pass at the end of every task.
- **Dev server:** start with the Browser pane's `preview_start` using `{ name: "proshop" }` (from `.claude/launch.json`). Never run `npm run dev` through Bash.

## Open assumption (flagged, not blocking)

`/sales` and `/pos` are admin-only today (`App.tsx:99`), and `completeSale` is the admin's job. This plan therefore shows the cart button and cart sheet **to admins only**, and staff keep Pins as their "remember this item" tool. If the shop wants staff to build a basket that an admin then rings up, that is a one-line change in Task 6 (`{isAdmin && <CartButton/>}` → always render) plus a staff-facing checkout message; it is called out again at that step.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/cart.ts` | **Create.** Pure cart functions — add/update/remove a line, totals. No React, no storage. The only place cart arithmetic lives. |
| `src/cart.test.ts` | **Create.** Tests for the above. |
| `src/useCart.tsx` | **Create.** `CartProvider` + `useCart()`. Holds `CartLine[]`, persists to `localStorage`, owns the open/closed state of the cart sheet. |
| `src/useCart.test.tsx` | **Create.** Tests for persistence and provider behaviour. |
| `src/usePins.ts` | **Create.** `usePins()` — device-local pinned product ids in `localStorage`, with cross-component sync. |
| `src/usePins.test.ts` | **Create.** Tests for the above. |
| `src/CartSheet.tsx` | **Create.** Reference screen 3 — the cart dialog. Presentation only; all maths comes from `cart.ts`. |
| `src/cart.css` | **Create.** Styles for the cart button, badge, and sheet. |
| `src/main.tsx` | **Modify.** Mount `CartProvider`; import `cart.css` after `inventory.css`. |
| `src/App.tsx` | **Modify.** `Shell` gains the cart button + `CartSheet`; `Pos` reads the shared cart; `ProductGroupCard` and `ProductDetail` are re-laid-out. |
| `src/inventory.css` | **Modify.** Restyled `.pcard` block; new product-detail hero/sheet rules. |
| `package.json` | **Modify.** Add `test` script and the three dev dependencies. |
| `vitest.config.ts` | **Create.** jsdom environment. |

`App.tsx` is already 608 lines and holds every route. This plan does **not** restructure it — the codebase's established pattern is one big `App.tsx` with small focused siblings, and `CartSheet` follows that pattern by being extracted as its own file the way `StaffHome`, `LiveOverview`, and `MyAccount` already are.

---

## Task 1: Test harness

There is no test runner in this repo. The cart is real arithmetic against real money and stock, so it gets tests; the CSS work in later tasks is verified in the browser instead.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/cart.test.ts` (placeholder, replaced in Task 2)

- [ ] **Step 1: Install the runner**

```bash
npm install -D vitest@3 jsdom@26 @testing-library/react@16
```

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"` (keep the existing entries):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, include: ['src/**/*.test.{ts,tsx}'] },
});
```

- [ ] **Step 4: Write a smoke test that fails**

Create `src/cart.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cartSubtotal } from './cart';

describe('cart', () => {
  it('totals an empty cart as zero', () => {
    expect(cartSubtotal([])).toBe(0);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

```bash
npm test
```

Expected: FAIL — `Failed to resolve import "./cart"`.

- [ ] **Step 6: Add `vitest` types so `tsc -b` still passes**

In `tsconfig.json`, add `"vitest/globals"` to `compilerOptions.types` (create the array if absent) and make sure `src/**/*.test.ts` is inside the existing `include`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.json src/cart.test.ts
git commit -m "test: add vitest with a jsdom environment"
```

---

## Task 2: Pure cart functions

**Files:**
- Create: `src/cart.ts`
- Modify: `src/cart.test.ts`

**Interfaces:**
- Consumes: `CartLine` from `./types` — `{ productId: string; qty: number; unitPrice: number; discount: number }` (already exists, `types.ts:152`).
- Produces:
  - `addLine(lines: CartLine[], product: Product, qty?: number): CartLine[]`
  - `setLineQty(lines: CartLine[], productId: string, qty: number): CartLine[]`
  - `setLineDiscount(lines: CartLine[], productId: string, discount: number): CartLine[]`
  - `removeLine(lines: CartLine[], productId: string): CartLine[]`
  - `lineTotal(line: CartLine): number`
  - `cartSubtotal(lines: CartLine[]): number`
  - `cartCount(lines: CartLine[]): number`
  - `availableOf(product: Product): number`

- [ ] **Step 1: Write the failing tests**

Replace `src/cart.test.ts` entirely:

```ts
import { describe, expect, it } from 'vitest';
import { addLine, availableOf, cartCount, cartSubtotal, lineTotal, removeLine, setLineDiscount, setLineQty } from './cart';
import type { CartLine, Product } from './types';

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1', sku: 'SKU1', name: 'Board', category: 'BOARDS', categoryId: 'c1',
  brand: 'Ronix', size: '142', color: 'Black', cost: 100, price: 200,
  supplier: '—', received: null, isActive: true, qty: 5, reservedQty: 1,
  sold: 0, imageUrl: null, ...over,
} as Product);

describe('availableOf', () => {
  it('excludes reserved units', () => {
    expect(availableOf(product({ qty: 5, reservedQty: 1 }))).toBe(4);
  });
  it('never reports a negative count', () => {
    expect(availableOf(product({ qty: 1, reservedQty: 4 }))).toBe(0);
  });
});

describe('addLine', () => {
  it('adds a new line at the product price', () => {
    expect(addLine([], product())).toEqual([{ productId: 'p1', qty: 1, unitPrice: 200, discount: 0 }]);
  });
  it('increments an existing line instead of duplicating it', () => {
    const once = addLine([], product());
    expect(addLine(once, product())).toEqual([{ productId: 'p1', qty: 2, unitPrice: 200, discount: 0 }]);
  });
  it('caps the quantity at what is available', () => {
    const lines = addLine([], product({ qty: 2, reservedQty: 0 }), 9);
    expect(lines[0].qty).toBe(2);
  });
  it('refuses a product with no price', () => {
    expect(addLine([], product({ price: null }))).toEqual([]);
  });
  it('refuses a product with nothing available', () => {
    expect(addLine([], product({ qty: 1, reservedQty: 1 }))).toEqual([]);
  });
});

describe('setLineQty', () => {
  const lines: CartLine[] = [{ productId: 'p1', qty: 2, unitPrice: 200, discount: 0 }];
  it('changes the quantity', () => {
    expect(setLineQty(lines, 'p1', 3)[0].qty).toBe(3);
  });
  it('drops the line when the quantity reaches zero', () => {
    expect(setLineQty(lines, 'p1', 0)).toEqual([]);
  });
  it('drops the line on a negative quantity rather than storing one', () => {
    expect(setLineQty(lines, 'p1', -2)).toEqual([]);
  });
});

describe('setLineDiscount', () => {
  it('never lets a discount exceed the line value', () => {
    const lines: CartLine[] = [{ productId: 'p1', qty: 2, unitPrice: 200, discount: 0 }];
    expect(setLineDiscount(lines, 'p1', 900)[0].discount).toBe(400);
  });
  it('clamps a negative discount to zero', () => {
    const lines: CartLine[] = [{ productId: 'p1', qty: 1, unitPrice: 200, discount: 0 }];
    expect(setLineDiscount(lines, 'p1', -5)[0].discount).toBe(0);
  });
});

describe('totals', () => {
  const lines: CartLine[] = [
    { productId: 'p1', qty: 2, unitPrice: 200, discount: 50 },
    { productId: 'p2', qty: 1, unitPrice: 120, discount: 0 },
  ];
  it('totals one line net of its discount', () => {
    expect(lineTotal(lines[0])).toBe(350);
  });
  it('sums every line', () => {
    expect(cartSubtotal(lines)).toBe(470);
  });
  it('counts units, not lines', () => {
    expect(cartCount(lines)).toBe(3);
  });
  it('totals an empty cart as zero', () => {
    expect(cartSubtotal([])).toBe(0);
  });
});

describe('removeLine', () => {
  it('removes only the named product', () => {
    const lines: CartLine[] = [
      { productId: 'p1', qty: 1, unitPrice: 200, discount: 0 },
      { productId: 'p2', qty: 1, unitPrice: 120, discount: 0 },
    ];
    expect(removeLine(lines, 'p1').map(line => line.productId)).toEqual(['p2']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Failed to resolve import "./cart"`.

- [ ] **Step 3: Write the implementation**

Create `src/cart.ts`:

```ts
import type { CartLine, Product } from './types';

/* Reserved units are held for a named customer, so they are not on the shelf
   to sell. Every screen that offers a product for sale asks this, so the sum
   lives here rather than being re-derived at each call site. */
export const availableOf = (product: Product): number => Math.max(0, product.qty - product.reservedQty);

/* A cart line is keyed by product id — one row per exact size, because a size
   is its own product row with its own stock and price. Adding a product that
   is already in the cart raises its quantity instead of opening a second row,
   which is what a counter expects when the same board is scanned twice. */
export function addLine(lines: CartLine[], product: Product, qty = 1): CartLine[] {
  const available = availableOf(product);
  if (product.price === null || available === 0) return lines;
  const existing = lines.find(line => line.productId === product.id);
  if (!existing) return [...lines, { productId: product.id, qty: Math.min(qty, available), unitPrice: product.price, discount: 0 }];
  return lines.map(line => line.productId === product.id
    ? { ...line, qty: Math.min(line.qty + qty, available) }
    : line);
}

/* Zero is the remove gesture: the stepper's minus at one unit and the sheet's
   ✕ are the same operation, so they share one path and a zero-quantity line
   can never be stored. */
export function setLineQty(lines: CartLine[], productId: string, qty: number): CartLine[] {
  if (qty <= 0) return removeLine(lines, productId);
  return lines.map(line => line.productId === productId ? { ...line, qty } : line);
}

export function setLineDiscount(lines: CartLine[], productId: string, discount: number): CartLine[] {
  return lines.map(line => line.productId === productId
    ? { ...line, discount: Math.min(Math.max(0, discount), line.qty * line.unitPrice) }
    : line);
}

export const removeLine = (lines: CartLine[], productId: string): CartLine[] => lines.filter(line => line.productId !== productId);

export const lineTotal = (line: CartLine): number => line.qty * line.unitPrice - line.discount;
export const cartSubtotal = (lines: CartLine[]): number => lines.reduce((sum, line) => sum + lineTotal(line), 0);
export const cartCount = (lines: CartLine[]): number => lines.reduce((sum, line) => sum + line.qty, 0);
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test
```

Expected: PASS, 15 tests.

- [ ] **Step 5: Check the Product shape used in the test fixture is real**

```bash
sed -n '1,60p' src/types.ts
```

If any field in the test's `product()` helper does not exist on `Product`, or a required field is missing, fix the fixture to match `types.ts` and re-run `npm test`.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint && npm test
```

```bash
git add src/cart.ts src/cart.test.ts
git commit -m "feat: add pure cart arithmetic with availability caps"
```

---

## Task 3: Shared cart provider

Today the cart is `useState` inside `Pos` (`App.tsx:568`), so "Add to sale" on a product page can only navigate to `/pos` and hope. This task moves ownership up so any screen can add a line.

**Files:**
- Create: `src/useCart.tsx`
- Create: `src/useCart.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `addLine`, `setLineQty`, `setLineDiscount`, `removeLine`, `cartSubtotal`, `cartCount` from `./cart` (Task 2).
- Produces: `CartProvider({ children }: { children: ReactNode })` and

```ts
useCart(): {
  lines: CartLine[];
  count: number;
  subtotal: number;
  open: boolean;
  add: (product: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  setDiscount: (productId: string, discount: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
}
```

- [ ] **Step 1: Write the failing tests**

Create `src/useCart.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CartProvider, useCart } from './useCart';
import type { Product } from './types';

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1', sku: 'SKU1', name: 'Board', category: 'BOARDS', categoryId: 'c1',
  brand: 'Ronix', size: '142', color: 'Black', cost: 100, price: 200,
  supplier: '—', received: null, isActive: true, qty: 5, reservedQty: 0,
  sold: 0, imageUrl: null, ...over,
} as Product);

let cart: ReturnType<typeof useCart>;
function Probe() {
  cart = useCart();
  return <span data-testid="count">{cart.count}</span>;
}
const mount = () => render(<CartProvider><Probe/></CartProvider>);

beforeEach(() => window.localStorage.clear());

describe('CartProvider', () => {
  it('starts empty', () => {
    mount();
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('adds a product and counts its units', () => {
    mount();
    act(() => cart.add(product()));
    act(() => cart.add(product()));
    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(cart.subtotal).toBe(400);
  });

  it('persists the cart across a remount', () => {
    const first = mount();
    act(() => cart.add(product()));
    first.unmount();
    mount();
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('clears the cart and the stored copy', () => {
    mount();
    act(() => cart.add(product()));
    act(() => cart.clear());
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(window.localStorage.getItem('homies.cart')).toBe('[]');
  });

  it('survives corrupt stored data', () => {
    window.localStorage.setItem('homies.cart', 'not json');
    mount();
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('opens and closes the sheet', () => {
    mount();
    expect(cart.open).toBe(false);
    act(() => cart.openCart());
    expect(cart.open).toBe(true);
    act(() => cart.closeCart());
    expect(cart.open).toBe(false);
  });

  it('throws when used outside the provider', () => {
    expect(() => render(<Probe/>)).toThrow(/CartProvider/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- useCart
```

Expected: FAIL — `Failed to resolve import "./useCart"`.

- [ ] **Step 3: Write the implementation**

Create `src/useCart.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { addLine, cartCount, cartSubtotal, removeLine, setLineDiscount, setLineQty } from './cart';
import type { CartLine, Product } from './types';

const STORAGE_KEY = 'homies.cart';

/* The counter loses its network and its tab. A cart half-built when the phone
   sleeps has to still be there on wake, so the lines are mirrored to local
   storage on every change. Storage is per device on purpose — this is one
   staffer's basket at one till, not shop state. */
function readStored(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line: unknown): line is CartLine =>
      !!line && typeof line === 'object'
      && typeof (line as CartLine).productId === 'string'
      && Number.isFinite((line as CartLine).qty)
      && Number.isFinite((line as CartLine).unitPrice));
  } catch {
    return [];
  }
}

export interface CartState {
  lines: CartLine[];
  count: number;
  subtotal: number;
  open: boolean;
  add: (product: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  setDiscount: (productId: string, discount: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readStored);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); } catch { /* private mode; the cart still works in memory */ }
  }, [lines]);

  const add = useCallback((product: Product, qty = 1) => setLines(current => addLine(current, product, qty)), []);
  const setQty = useCallback((productId: string, qty: number) => setLines(current => setLineQty(current, productId, qty)), []);
  const setDiscount = useCallback((productId: string, discount: number) => setLines(current => setLineDiscount(current, productId, discount)), []);
  const remove = useCallback((productId: string) => setLines(current => removeLine(current, productId)), []);
  const clear = useCallback(() => setLines([]), []);
  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => setOpen(false), []);

  const value = useMemo<CartState>(() => ({
    lines, count: cartCount(lines), subtotal: cartSubtotal(lines), open,
    add, setQty, setDiscount, remove, clear, openCart, closeCart,
  }), [lines, open, add, setQty, setDiscount, remove, clear, openCart, closeCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const state = useContext(CartContext);
  if (!state) throw new Error('useCart must be used inside CartProvider.');
  return state;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- useCart
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Mount the provider**

In `src/main.tsx`, add the import beside the others:

```tsx
import { CartProvider } from './useCart';
```

and wrap `<App />`:

```tsx
    <ErrorBoundary>
      <InstallPrompt />
      <UpdateBanner />
      <CartProvider>
        <App />
      </CartProvider>
    </ErrorBoundary>
```

- [ ] **Step 6: Lint and commit**

```bash
npm run lint && npm test
```

```bash
git add src/useCart.tsx src/useCart.test.tsx src/main.tsx
git commit -m "feat: own the cart in a provider that survives a reload"
```

---

## Task 4: Point the POS at the shared cart

The POS keeps every checkout field it has. Only the source of `cart` changes, so a line added anywhere shows up at the till.

**Files:**
- Modify: `src/App.tsx:565-586` (the `Pos` component)

**Interfaces:**
- Consumes: `useCart()` from `./useCart` (Task 3), `cartSubtotal`/`availableOf` from `./cart` (Task 2).
- Produces: nothing new. `Pos` keeps its `{ embedded }` prop and its behaviour.

- [ ] **Step 1: Add the imports**

At the top of `src/App.tsx`, beside the existing local imports:

```tsx
import { availableOf } from './cart';
import { useCart } from './useCart';
```

- [ ] **Step 2: Replace the cart state in `Pos`**

Delete this line from `Pos`:

```tsx
  const [cart, setCart] = useState<CartLine[]>([]);
```

and put this in its place:

```tsx
  const { lines: cart, subtotal, add, setQty, setDiscount, clear } = useCart();
```

- [ ] **Step 3: Delete the now-duplicated local helpers**

Remove these three from `Pos` — `cart.ts` and the provider own them now:

```tsx
  const subtotal = cart.reduce((sum, line) => sum + line.qty * line.unitPrice - line.discount, 0);
  function add(product: Product) { /* … */ }
  function update(productId: string, changes: Partial<CartLine>) { /* … */ }
```

Keep `const total = Math.max(0, subtotal - orderDiscount);` exactly as it is.

- [ ] **Step 4: Repoint the two `update(...)` call sites**

In the "Current sale" card, the quantity input's handler becomes:

```tsx
onChange={event => setQty(line.productId, Number(event.target.value))}
```

and the line-discount input's handler becomes:

```tsx
onChange={event => setDiscount(line.productId, Number(event.target.value))}
```

Also change the two `product.qty - product.reservedQty` expressions in that card to `availableOf(product)`.

- [ ] **Step 5: Repoint the reset in `complete()`**

In `complete()`, replace `setCart([]);` with `clear();`. Leave every other reset (`setOrderDiscount(0)`, `setCustomerName('')`, `setSellerName('')`, `setAmountPaid('')`) untouched.

- [ ] **Step 6: Fix the search-result filter to use the shared helper**

In `Pos`, the `matches` filter's `product.qty - product.reservedQty > 0` becomes `availableOf(product) > 0`.

- [ ] **Step 7: Verify the unused `CartLine` import is gone**

```bash
npm run lint
```

Expected: PASS. If it reports `CartLine` is declared but never used, drop `CartLine` from the `./types` import list on `App.tsx:43`.

- [ ] **Step 8: Verify in the browser**

Start the dev server with the Browser pane: `preview_start` with `{ "name": "proshop" }`. Sign in as an admin, go to `/sales`, search a product, add it, change its quantity, and confirm the totals move. Then reload the page and confirm the line is still there — that is the new behaviour, and it is the proof the provider is wired.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: let the POS read the shared cart"
```

---

## Task 5: Pin shortlist

The reference's heart. A pin is one staffer's "come back to this" on one device — it is not shop state, so it needs no migration and no column.

**Files:**
- Create: `src/usePins.ts`
- Create: `src/usePins.test.ts`

**Interfaces:**
- Produces: `usePins(): { pinned: Set<string>; isPinned: (id: string) => boolean; toggle: (id: string) => void }`

- [ ] **Step 1: Write the failing tests**

Create `src/usePins.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePins } from './usePins';

beforeEach(() => window.localStorage.clear());

describe('usePins', () => {
  it('starts with nothing pinned', () => {
    const { result } = renderHook(() => usePins());
    expect(result.current.isPinned('p1')).toBe(false);
  });

  it('pins and unpins the same id', () => {
    const { result } = renderHook(() => usePins());
    act(() => result.current.toggle('p1'));
    expect(result.current.isPinned('p1')).toBe(true);
    act(() => result.current.toggle('p1'));
    expect(result.current.isPinned('p1')).toBe(false);
  });

  it('persists a pin across a remount', () => {
    const first = renderHook(() => usePins());
    act(() => first.result.current.toggle('p1'));
    first.unmount();
    const second = renderHook(() => usePins());
    expect(second.result.current.isPinned('p1')).toBe(true);
  });

  it('keeps two mounted hooks in step', () => {
    const a = renderHook(() => usePins());
    const b = renderHook(() => usePins());
    act(() => a.result.current.toggle('p1'));
    expect(b.result.current.isPinned('p1')).toBe(true);
  });

  it('survives corrupt stored data', () => {
    window.localStorage.setItem('homies.pins', '{ nope');
    const { result } = renderHook(() => usePins());
    expect(result.current.pinned.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- usePins
```

Expected: FAIL — `Failed to resolve import "./usePins"`.

- [ ] **Step 3: Write the implementation**

Create `src/usePins.ts`:

```ts
import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'homies.pins';
const listeners = new Set<() => void>();

/* Every card on a grid calls this hook, so the pinned set is one module-level
   value with a subscription rather than per-component state. Pinning on one
   card has to repaint the same product's card on the detail page behind it,
   and useState in each card cannot do that. */
let snapshot: Set<string> = read();

function read(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id: unknown) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function write(next: Set<string>) {
  snapshot = next;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* private mode; pins stay in memory */ }
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function usePins() {
  const pinned = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  const toggle = useCallback((id: string) => {
    const next = new Set(snapshot);
    if (!next.delete(id)) next.add(id);
    write(next);
  }, []);
  const isPinned = useCallback((id: string) => pinned.has(id), [pinned]);
  return { pinned, isPinned, toggle };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- usePins
```

Expected: PASS, 5 tests.

Note: the module-level `snapshot` is read once at import. `beforeEach` clearing storage does not reset it, so if the "starts with nothing pinned" test fails after another test has pinned something, add a reset export used only by tests:

```ts
export const __resetPinsForTest = () => write(new Set());
```

and call it in `beforeEach`.

- [ ] **Step 5: Lint and commit**

```bash
npm run lint && npm test
```

```bash
git add src/usePins.ts src/usePins.test.ts
git commit -m "feat: add a device-local pin shortlist"
```

---

## Task 6: Cart button and cart sheet

Reference screen 3, in the app's own dialog language: the existing `.sheet-backdrop` / `.sheet` / `.sheet-head` / `.sheet-close` primitives that `ExportDialog` and `LiveOverview` already use. The reference's "Delivery Fee" row has no counter equivalent, so that slot carries **Discount** — which the POS already has as a real concept — and Checkout hands off to `/sales`, where the customer, seller, payment method, and amount-received fields live.

**Files:**
- Create: `src/CartSheet.tsx`
- Create: `src/cart.css`
- Modify: `src/main.tsx` (import `cart.css` last)
- Modify: `src/App.tsx` (`Shell`, around `App.tsx:129`)

**Interfaces:**
- Consumes: `useCart()` (Task 3), `useShopData()`, `formatPeso` from `./domain`, `catalogPhoto` from `./productPhotos`, `lineTotal`/`availableOf` from `./cart` (Task 2).
- Produces: `CartSheet({ onCheckout }: { onCheckout: () => void })` — renders nothing when the cart is closed.

- [ ] **Step 1: Write `CartSheet.tsx`**

```tsx
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
```

- [ ] **Step 2: Write `cart.css`**

```css
/* ------------------------------------------------------------------
   Cart — the reference's basket sheet in counter-poster language.
   Reuses .sheet-backdrop / .sheet / .sheet-head / .sheet-close from
   styles.css; only what the cart adds is written here.
   ------------------------------------------------------------------ */

/* ------------------------------------------------------- topbar button */

.cart-button {
  position: relative;
  display: inline-flex; align-items: center; gap: 8px;
  min-height: 44px; padding: 0 15px;
  border: 1px solid var(--line-2); border-radius: var(--r-pill);
  background: var(--surface); color: var(--ink);
  font-size: 13px; font-weight: 700;
}
.cart-button:hover { background: var(--surface-2); }
.cart-button.has-items { border-color: var(--red); color: var(--red); }
/* The count is the reason to look at this control, so it rides the corner the
   way the reference does rather than sitting inside the label. */
.cart-count {
  position: absolute; top: -5px; right: -4px;
  min-width: 20px; height: 20px; padding: 0 5px;
  display: grid; place-items: center;
  border-radius: var(--r-pill);
  background: var(--red); color: var(--paper);
  font: 500 11px var(--mono); font-variant-numeric: tabular-nums;
}

/* ---------------------------------------------------------- cart sheet */

.cart-sheet { width: min(520px, 100%); }
.cart-lines-sheet { overflow-y: auto; display: grid; padding-right: 6px; }
.cart-line {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto auto 34px;
  gap: 12px; align-items: center;
  padding: 12px 0; border-top: 1px solid var(--line);
}
.cart-line:first-child { border-top: 0; }
.cart-line-photo {
  width: 44px; height: 44px; flex: none;
  border-radius: var(--r-tile); object-fit: cover; background: var(--photo-bg);
}
.cart-line-photo.empty {
  display: grid; place-items: center;
  background: transparent; border: 1px dashed var(--dash); color: var(--muted);
}
.cart-line-name { min-width: 0; }
.cart-line-name strong { display: block; font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }
.cart-line-name small { display: block; margin-top: 3px; color: var(--muted); font: 400 11px var(--mono); }
.cart-line-warn { display: block; margin-top: 3px; color: var(--ember-ink); font: 400 11px var(--mono); font-style: normal; }
.cart-line.is-missing { grid-template-columns: minmax(0, 1fr) 34px; }

/* Quantity stepper, straight from the reference's detail screen. Square
   corners on the readout, pills on the two controls — same rule as everywhere
   else: type is printed, controls are rounded. */
.cart-step { display: inline-flex; align-items: center; gap: 2px; }
.cart-step button {
  width: 32px; height: 32px; display: grid; place-items: center;
  border: 1px solid var(--line-2); border-radius: var(--r-pill);
  background: var(--surface-2); color: var(--ink);
}
.cart-step button:disabled { opacity: 0.4; cursor: default; }
.cart-step b {
  min-width: 34px; text-align: center;
  font: 500 14px var(--mono); font-variant-numeric: tabular-nums;
}
.cart-line-total { font: 500 13px var(--mono); text-align: right; white-space: nowrap; }
.cart-line-remove {
  width: 34px; height: 34px; display: grid; place-items: center;
  border: 0; border-radius: var(--r-pill); background: transparent; color: var(--muted);
}
.cart-line-remove:hover { background: var(--surface-2); color: var(--red); }

.cart-totals { margin-top: 14px; padding-top: 4px; }
.cart-totals > div {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  padding: 9px 0; border-top: 1px solid var(--line);
}
.cart-totals span { color: var(--muted); font: 400 11px var(--mono); letter-spacing: 0.09em; text-transform: uppercase; }
.cart-totals strong { font: 500 14px var(--mono); font-variant-numeric: tabular-nums; }
.cart-totals .is-total { border-top: 1px solid var(--ink); }
.cart-totals .is-total span { color: var(--ink); }
.cart-totals .is-total strong { font-size: 20px; }

.cart-checkout { width: 100%; min-height: 54px; margin-top: 14px; }
.cart-note { margin: 12px 0 0; color: var(--muted); font-size: 11px; line-height: 1.5; }

@media (max-width: 680px) {
  /* Bottom sheet on a phone, exactly as the reference has it. */
  .sheet-backdrop:has(.cart-sheet) { place-items: end center; padding: 0; }
  .cart-sheet {
    width: 100%; max-height: 88vh;
    border-radius: var(--r-card) var(--r-card) 0 0;
    padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  }
  .cart-line { grid-template-columns: 44px minmax(0, 1fr) 34px; gap: 8px 12px; }
  .cart-line-photo { grid-column: 1; grid-row: 1 / span 2; align-self: center; }
  .cart-line-name { grid-column: 2; grid-row: 1; }
  .cart-step { grid-column: 2; grid-row: 2; }
  .cart-line-total { grid-column: 3; grid-row: 1; }
  .cart-line-remove { grid-column: 3; grid-row: 2; justify-self: end; }
  .cart-button span { display: none; }
  .cart-button { padding: 0 12px; }
}
```

- [ ] **Step 3: Import the sheet last**

In `src/main.tsx`, after the existing `import './inventory.css';`:

```tsx
import './cart.css';
```

- [ ] **Step 4: Add the cart button and sheet to `Shell`**

At the top of `src/App.tsx`, add:

```tsx
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart.mjs';
import { CartSheet } from './CartSheet';
```

Inside `Shell`, beside the other hooks:

```tsx
  const { count, open: cartOpen, openCart } = useCart();
```

In the `<div className="top-actions">` block, insert the button before the existing refresh button — admin-only, matching the gate on `/sales`. **If the shop wants staff to build a basket too, drop the `isAdmin &&` here** (see the plan's Open assumption):

```tsx
{isAdmin && <button className={`cart-button ${count ? 'has-items' : ''}`} aria-label={`Current sale, ${count} unit${count === 1 ? '' : 's'}`} onClick={openCart}>
  <ShoppingCart size={16}/><span>Sale</span>
  {count > 0 && <b className="cart-count">{count}</b>}
</button>}
```

And render the sheet next to `{exporting && <ExportDialog …/>}`:

```tsx
{cartOpen && <CartSheet onCheckout={() => navigate('/sales')}/>}
```

`cartOpen` is destructured only so this line reads plainly; `CartSheet` returns `null` on its own when closed.

- [ ] **Step 5: Lint**

```bash
npm run lint && npm test
```

Expected: PASS.

- [ ] **Step 6: Verify in the browser**

Start the preview (`preview_start` `{ "name": "proshop" }`) and sign in as an admin. Then:
1. Go to `/sales`, add two products from the POS search.
2. Confirm the topbar shows the cart button with the right unit count.
3. Open it — check the lines, the steppers (minus at 1 removes the line; plus stops at the available count), the ✕, and the totals.
4. Press "Go to checkout" and confirm it closes and lands on `/sales` with the lines intact.
5. `resize_window` to `mobile` and confirm the sheet docks to the bottom edge and clears the home indicator.
6. `read_console_messages` — expect no errors.
7. Take a `computer` screenshot of the sheet on mobile and share it.

- [ ] **Step 7: Commit**

```bash
git add src/CartSheet.tsx src/cart.css src/main.tsx src/App.tsx
git commit -m "feat: add a cart button and cart sheet at the counter"
```

---

## Task 7: Restyle the product card

Reference screen 1's tile, keeping **every** field the card carries today (the user's explicit choice): category kicker, name, brand/colour, size pills, all three facts, and the admin Edit button. What changes is the geometry — a taller photo, the pin in its corner, and the name/price on one row the way the reference puts "Men's Pullover Hoodie" against "Price / $199.00".

**Files:**
- Modify: `src/App.tsx:254-290` (`ProductGroupCard`)
- Modify: `src/inventory.css` (the `.pcard` block)

**Interfaces:**
- Consumes: `usePins()` (Task 5), `useCart()` (Task 3), `availableOf` (Task 2).
- Produces: nothing new — `ProductGroupCard`'s props are unchanged: `{ group, canManage, displayName?, categoryLabel? }`.

- [ ] **Step 1: Add the imports**

At the top of `src/App.tsx`:

```tsx
import Bookmark from 'lucide-react/dist/esm/icons/bookmark.mjs';
import { usePins } from './usePins';
```

`useCart` and `availableOf` were imported in Tasks 4 and 6.

- [ ] **Step 2: Rewrite `ProductGroupCard`**

Replace the whole component with:

```tsx
/* Photo-first card. The whole tile is the way into the product page, so the
   photo and the name share one button; the pin, the size pills and the cart
   action sit outside it, because a button nested inside a button is invalid
   and screen readers drop it. */
function ProductGroupCard({ group, canManage, displayName, categoryLabel }: { group: ProductGroup; canManage: boolean; displayName?: string; categoryLabel?: string }) {
  const [selectedId, setSelectedId] = useState(group.variants[0].id);
  const { isPinned, toggle } = usePins();
  const { add, openCart } = useCart();
  const selected = group.variants.find(product => product.id === selectedId) || group.variants[0];
  const remaining = group.variants.reduce((sum, product) => sum + product.qty, 0);
  const status = statusFor(selected);
  const photo = selected.imageUrl || catalogPhoto(selected);
  const badge = status === 'Out of Stock' ? 'OUT' : status === 'Low Stock' ? 'LOW' : null;
  const sellable = selected.price !== null && availableOf(selected) > 0;
  const pinned = isPinned(selected.id);
  return <article className="pcard">
    <div className="pcard-frame">
      <button type="button" className="pcard-open" onClick={() => navigate(`/inventory/${selected.id}`)}>
        <span className="pcard-photo">
          {photo
            ? <img src={photo} alt="" loading="lazy"/>
            : <span className="pcard-photo-empty"><b>{selected.sku}</b><small>no photo yet</small></span>}
          {badge && <span className={`pcard-badge is-${badge.toLowerCase()}`}>{badge}</span>}
        </span>
      </button>
      {/* Sibling of .pcard-open, absolutely placed over its corner — the
          reference's heart, doing the job a counter actually has. */}
      <button
        type="button"
        className={`pcard-pin ${pinned ? 'is-on' : ''}`}
        aria-pressed={pinned}
        aria-label={pinned ? `Unpin ${group.name}` : `Pin ${group.name}`}
        onClick={() => toggle(selected.id)}
      ><Bookmark size={15}/></button>
    </div>

    <button type="button" className="pcard-open pcard-open-text" onClick={() => navigate(`/inventory/${selected.id}`)}>
      <span className="pcard-title">
        {categoryLabel && <small className="pcard-cat">{categoryLabel}</small>}
        <span className="pcard-headline">
          <strong>{displayName || group.name}</strong>
          <span className="pcard-price"><small>Price</small><b>{formatPeso(selected.price)}</b></span>
        </span>
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
    </div>
    {selected.reservedQty > 0 && <span className="reserved-indicator">Reserved {selected.reservedQty}</span>}
    <div className="pcard-actions">
      <button className="button button-primary pcard-add" disabled={!sellable} onClick={() => { add(selected); openCart(); }}>
        {sellable ? 'Add to sale' : 'Unavailable'}
      </button>
      {canManage && <button className="button button-dark pcard-edit" onClick={() => navigate(`/inventory/${selected.id}`)}>Edit</button>}
    </div>
  </article>;
}
```

Note the Price fact row is gone from `.pcard-facts` — it moved into the headline beside the name, which is the reference's own layout. No information is lost.

- [ ] **Step 3: Update the card CSS**

In `src/inventory.css`, in the `/* ------ product card */` block, change `.pcard-photo`'s aspect ratio and add the new rules. Replace:

```css
.pcard-photo {
  position: relative;
  display: block;
  aspect-ratio: 1 / 1;
```

with:

```css
/* Taller than square, as the reference has it — a browse tile is mostly
   photograph, and these are tall objects besides. */
.pcard-photo {
  position: relative;
  display: block;
  aspect-ratio: 4 / 5;
```

Then append to the same block:

```css
/* The pin has to sit over the photo without being inside the card's open
   button, so the frame is the positioning context for both. */
.pcard-frame { position: relative; }
.pcard-pin {
  position: absolute; top: 8px; right: 8px;
  width: 34px; height: 34px; display: grid; place-items: center;
  border: 1px solid var(--line-2); border-radius: var(--r-pill);
  background: var(--surface); color: var(--muted);
}
.pcard-pin:hover { color: var(--ink); }
.pcard-pin.is-on { border-color: var(--red); background: var(--red); color: var(--paper); }

.pcard-open-text { display: block; }
/* Name left, price right, baselines aligned — the reference's footer row. */
.pcard-headline { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.pcard-headline strong { min-width: 0; }
.pcard-price { flex: none; text-align: right; }
.pcard-price small {
  display: block; color: var(--muted);
  font: 400 9px var(--mono); letter-spacing: 0.12em; text-transform: uppercase;
}
.pcard-price b {
  display: block; margin-top: 2px; color: var(--ink);
  font: 500 13px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap;
}
.pcard-open:hover .pcard-price b { color: var(--red); }

.pcard-actions { display: flex; gap: 6px; padding: 8px 14px 0; }
.pcard-add, .pcard-edit {
  flex: 1; width: auto; min-height: 40px; margin: 0; padding: 0 12px;
  font: 500 11px var(--mono); letter-spacing: 0.1em; text-transform: uppercase;
}
.pcard-edit { flex: 0 0 auto; }
```

Delete the now-superseded `.pcard-edit` rule further down that sets `width: calc(100% - 28px); margin: 4px 14px 0;`.

- [ ] **Step 4: Lint**

```bash
npm run lint && npm test
```

- [ ] **Step 5: Verify in the browser**

With the preview running, go to `/inventory`, switch to **Categories**, and open **Boards**.
1. Confirm the tiles are photo-led, the name and price share a row, and the pin sits on the photo corner.
2. Click the pin — it fills oxblood and stays filled after a reload.
3. Click "Add to sale" — the cart sheet opens with that exact size in it.
4. Pick a different size pill and confirm the price, the "N left" fact, and the Add button's enabled state all follow the selection.
5. `resize_window` `mobile` and confirm two tiles across with nothing clipped, then `read_console_messages` for errors.
6. Screenshot the grid on mobile and share it.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/inventory.css
git commit -m "feat: lay the product card out photo-first with a pin and an add action"
```

---

## Task 8: Product detail hero and info sheet

Reference screen 2: a full-bleed tinted hero carrying the back and pin controls, the thumbnail rail down its right edge (already built — `inventory.css` `.gallery-rail`), and the buy panel rising over the hero's bottom edge as a sheet on phones. Everything the page shows today stays.

**Files:**
- Modify: `src/App.tsx:426-463` (`ProductDetail`)
- Modify: `src/inventory.css` (product-detail additions block)

**Interfaces:**
- Consumes: `usePins()` (Task 5), `useCart()` (Task 3), `availableOf` (Task 2). `ProductPhoto`, `StatusBadge`, `Card`, `FieldValue` are unchanged.
- Produces: nothing new — `ProductDetail`'s `{ id }` prop is unchanged.

- [ ] **Step 1: Replace the head and showcase markup**

In `ProductDetail`, add these hooks beside the existing ones (above the early returns, so the hook count never changes):

```tsx
  const { isPinned, toggle } = usePins();
  const { add, openCart } = useCart();
  const [qty, setQty] = useState(1);
```

Then replace the `back-link` button, the `.product-page-head` div, and the `<section className="product-showcase">` block with:

```tsx
    <div className="product-hero-bar">
      <button className="hero-round" aria-label="Back to inventory" onClick={() => navigate('/inventory')}><ArrowLeft size={18}/></button>
      <span className="hero-title">Details</span>
      <button
        className={`hero-round ${isPinned(product.id) ? 'is-on' : ''}`}
        aria-pressed={isPinned(product.id)}
        aria-label={isPinned(product.id) ? 'Unpin this item' : 'Pin this item'}
        onClick={() => toggle(product.id)}
      ><Bookmark size={17}/></button>
    </div>
    <section className="product-showcase">
      <div className="product-gallery card">
        <div className="gallery-kicker">{product.color !== '—' ? product.color : 'Product view'}</div>
        <div className="gallery-stage">
          <ProductPhoto product={product} size="hero" canManage={canManage} onSaved={refresh}/>
          {views.length > 1 && <div className="gallery-rail" role="group" aria-label="Other views">{views.map(view => <button key={view.id} type="button" className={`gallery-thumb ${view.id === product.id ? 'is-on' : ''}`} aria-current={view.id === product.id} onClick={() => navigate(`/inventory/${view.id}`)}><img src={view.photo} alt={`Size ${view.size}`} loading="lazy"/></button>)}</div>}
        </div>
        <div className="gallery-caption"><span>HOMIES PROSHOP</span><span>{product.category}</span></div>
      </div>
      <div className="product-buy card">
        <div className="product-buy-top">
          <div>
            <div className="product-buy-brand">{product.brand}</div>
            <h1>{product.name}</h1>
          </div>
          {/* The reference's stepper, sitting where it sits there: beside the
              name, deciding how many units the Add action puts in the sale. */}
          <span className="cart-step product-qty" role="group" aria-label="Quantity to add">
            <button type="button" aria-label="One fewer" disabled={qty <= 1} onClick={() => setQty(value => Math.max(1, value - 1))}><Minus size={14}/></button>
            <b>{String(qty).padStart(2, '0')}</b>
            <button type="button" aria-label="One more" disabled={qty >= availableOf(product)} onClick={() => setQty(value => Math.min(availableOf(product), value + 1))}><Plus size={14}/></button>
          </span>
        </div>
        <p className="product-buy-subtitle">{product.size !== '—' ? `Size ${product.size}` : 'Size not captured'}{product.color !== '—' ? ` · ${product.color}` : ''}</p>
        <div className="product-price">{formatPeso(product.price)}</div>
        {siblings.length > 1 && <>
          <div className="product-buy-label">Select size</div>
          <div className="detail-sizes" role="group" aria-label="Other sizes of this product">{siblings.map(item => <button key={item.id} type="button" className={`pcard-size ${item.id === product.id ? 'is-on' : ''} ${item.qty === 0 ? 'is-empty' : ''}`} aria-current={item.id === product.id} onClick={() => navigate(`/inventory/${item.id}`)}>{item.size}</button>)}</div>
        </>}
        <div className="product-availability"><StatusBadge status={statusFor(product)}/><span>{available ? `${availableOf(product)} available` : 'Currently unavailable'}</span></div>
        <div className="product-spec-row"><span>SKU</span><strong>{product.sku}</strong></div>
        <div className="product-spec-row"><span>Category</span><strong>{product.category}</strong></div>
        <div className="product-buy-actions">
          <button className="button button-primary product-sale-button" disabled={!available || product.price === null} onClick={() => { add(product, qty); openCart(); }}>
            <ShoppingBag size={17}/>{available ? 'Add to sale' : 'Out of stock'}
          </button>
          {canManage && <button className="button button-dark" onClick={() => document.querySelector('.product-management')?.scrollIntoView({ behavior: 'smooth' })}>Edit details</button>}
        </div>
        <p className="product-note">Live stock is checked from the shop database. Reserved units are excluded from the available count.</p>
      </div>
    </section>
```

The breadcrumb and SKU that lived in `.product-page-head` are not lost: the SKU is already a spec row, and the category/brand pair is already the brand line plus the Category spec row.

- [ ] **Step 2: Add the missing icon imports**

At the top of `src/App.tsx`:

```tsx
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.mjs';
import Minus from 'lucide-react/dist/esm/icons/minus.mjs';
```

- [ ] **Step 3: Add the detail CSS**

Append to the `/* ---- product detail additions */` block in `src/inventory.css`:

```css
/* The reference's floating header: back on the left, a quiet title, the pin
   on the right. It replaces the old back-link and page-head pair. */
.product-hero-bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 12px;
}
.hero-title { font: 500 12px var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.hero-round {
  width: 42px; height: 42px; display: grid; place-items: center;
  border: 1px solid var(--line-2); border-radius: var(--r-pill);
  background: var(--surface); color: var(--ink);
}
.hero-round:hover { border-color: var(--red); color: var(--red); }
.hero-round.is-on { border-color: var(--red); background: var(--red); color: var(--paper); }

.product-buy-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.product-buy-top h1 { margin-bottom: 0; }
/* The buy panel is ink; the stepper's default bone controls disappear on it. */
.product-qty button { border-color: var(--ink-line); background: rgba(255, 255, 255, 0.08); color: var(--paper); }
.product-qty b { color: var(--paper); }
.product-buy-label {
  margin-top: 22px; color: var(--on-ink-3);
  font: 500 10px var(--mono); letter-spacing: 0.12em; text-transform: uppercase;
}
.product-buy .detail-sizes { margin-top: 8px; }
.product-buy .pcard-size { border-color: var(--ink-line); background: rgba(255, 255, 255, 0.06); color: var(--on-ink-2); }
.product-buy .pcard-size.is-on { border-color: var(--paper); background: var(--paper); color: var(--ink); }
.product-buy .pcard-size.is-empty:not(.is-on) { color: var(--on-ink-3); }

@media (max-width: 860px) {
  /* The reference's sheet: the buy panel rises over the hero's bottom edge.
     A negative margin, not a transform — a transform would leave a gap
     underneath and take the panel out of the flow the sticky bar needs. */
  .product-showcase { gap: 0; }
  .product-buy {
    position: relative; z-index: 1;
    margin-top: -18px;
    border-radius: 14px 14px var(--r-card) var(--r-card);
    padding-top: 22px;
  }
  /* The sheet's grab handle. Decorative only — the panel does not drag. */
  .product-buy::before {
    content: ''; position: absolute; top: 9px; left: 50%;
    width: 42px; height: 3px; transform: translateX(-50%);
    border-radius: var(--r-pill); background: var(--on-ink-3);
  }
  .product-buy-top { align-items: center; }
}
```

- [ ] **Step 4: Lint**

```bash
npm run lint && npm test
```

Expected: PASS. If `tsc` reports the `back-link` class or the removed `.product-page-head` markup is still referenced, remove the leftovers.

- [ ] **Step 5: Verify in the browser**

Open any product from the inventory grid.
1. Confirm the header row shows back / "Details" / pin, and the pin state matches what the grid card showed.
2. Step the quantity to 3, press "Add to sale", and confirm the cart sheet opens with **3** units of that exact size.
3. Confirm the stepper's plus stops at the available count and the minus stops at 1.
4. Pick another size from the size rail and confirm it navigates and the panel repaints.
5. `resize_window` `mobile`, reload, and confirm: the buy panel overlaps the photo card with a grab handle, the thumbnail rail is a horizontal strip, and the Add/Edit bar is pinned above the bottom nav and clear of the home indicator.
6. `read_console_messages` — expect no errors. Screenshot mobile and desktop, and share both.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/inventory.css
git commit -m "feat: give the product page a hero bar, a stepper and a rising sheet"
```

---

## Task 9: Colour rail on the product page

The reference's colour swatches. `productGroupKey` includes colour, so today's `siblings` are one colour's sizes; the colours of a style are a different grouping and a genuinely new capability. Colour is free text in the database, so a name that maps to a known ink gets a dot and anything else gets a labelled chip — a guessed hex would be worse than a word.

**Files:**
- Modify: `src/App.tsx` (`ProductDetail`, plus a small module-level helper)
- Modify: `src/inventory.css`

**Interfaces:**
- Consumes: `Product` from `./types`.
- Produces: `const SWATCHES: Record<string, string>` and `colourSwatch(name: string): string | null`, both module-level in `App.tsx` beside `productGroupKey`.

- [ ] **Step 1: Add the colour helpers**

In `src/App.tsx`, directly under `productGroupKey`:

```tsx
/* Colour is free text typed at intake, so only a known word earns a dot. An
   unrecognised colour gets its name printed instead — a guessed hex would
   mislabel the product on the shelf, which is worse than a word. */
const SWATCHES: Record<string, string> = {
  black: '#101110', white: '#F4EFE6', red: '#9a0002', blue: '#2B4C7E', navy: '#1B2A44',
  green: '#3F7F5C', yellow: '#E3B23C', orange: '#E4622B', pink: '#D97A9A', purple: '#6B4E8C',
  grey: '#6E6A5F', gray: '#6E6A5F', brown: '#6B4A32', silver: '#B8B4AC', gold: '#B08D3F',
};
const colourSwatch = (name: string): string | null => SWATCHES[name.trim().toLowerCase()] ?? null;

/* Same style, other colours. The grid's group key includes colour, so this
   deliberately drops it: two colourways of one board are one style here. */
const styleKey = (product: Product) => [product.categoryId, product.name, product.brand].map(value => value.trim().toLowerCase()).join('|');
```

- [ ] **Step 2: Build the colour list in `ProductDetail`**

Beside the existing `siblings` computation:

```tsx
  /* One entry per distinct colour of this style, each pointing at a real
     product row — the first size of that colour that has stock, or its first
     size if none has. */
  const colourways: Array<{ id: string; colour: string }> = [];
  products
    .filter(item => styleKey(item) === styleKey(product) && item.color !== '—')
    .sort((a, b) => a.color.localeCompare(b.color) || Number(b.qty > 0) - Number(a.qty > 0))
    .forEach(item => {
      const existing = colourways.find(entry => entry.colour.toLowerCase() === item.color.toLowerCase());
      if (!existing) colourways.push({ id: item.id, colour: item.color });
      else if (item.qty > 0 && !products.find(row => row.id === existing.id)?.qty) existing.id = item.id;
    });
```

- [ ] **Step 3: Render the rail**

In the buy panel, immediately above the `{siblings.length > 1 && …}` size block:

```tsx
        {colourways.length > 1 && <>
          <div className="product-buy-label">Colour</div>
          <div className="colour-rail" role="group" aria-label="Other colours of this product">{colourways.map(entry => {
            const swatch = colourSwatch(entry.colour);
            const current = entry.colour.toLowerCase() === product.color.toLowerCase();
            return <button
              key={entry.id}
              type="button"
              className={`colour-chip ${swatch ? 'is-dot' : ''} ${current ? 'is-on' : ''}`}
              aria-current={current}
              aria-label={entry.colour}
              title={entry.colour}
              onClick={() => navigate(`/inventory/${entry.id}`)}
            >{swatch ? <i style={{ background: swatch }}/> : entry.colour}</button>;
          })}</div>
        </>}
```

- [ ] **Step 4: Style the rail**

Append to `src/inventory.css`:

```css
.colour-rail { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.colour-chip {
  min-height: 34px; padding: 0 12px;
  border: 1px solid var(--ink-line); border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.06); color: var(--on-ink-2);
  font: 500 11px var(--mono); text-transform: uppercase; letter-spacing: 0.06em;
}
/* A known colour becomes the reference's dot; the ring is the ink panel's own
   hairline so a white swatch still reads as a disc and not a hole. */
.colour-chip.is-dot { width: 34px; padding: 0; display: grid; place-items: center; }
.colour-chip.is-dot i { width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--on-ink-3); display: block; }
.colour-chip.is-on { border-color: var(--paper); border-width: 2px; }
.colour-chip:not(.is-dot).is-on { background: var(--paper); color: var(--ink); }
```

- [ ] **Step 5: Lint**

```bash
npm run lint && npm test
```

- [ ] **Step 6: Verify in the browser**

Find a style carried in more than one colour (check with the app's own search, e.g. a boot or a vest brand carried in two colourways). Confirm the rail appears, the current colour is ringed, and tapping another colour navigates to that product. On a single-colour style, confirm the rail does not render at all.

If no multi-colour style exists in the live data, say so in the task report rather than claiming it was verified, and check the rail hides correctly on a single-colour style instead.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/inventory.css
git commit -m "feat: offer other colourways from the product page"
```

---

## Task 10: Full verification pass

**Files:** none — this task changes nothing unless it finds a defect.

- [ ] **Step 1: Run the whole gate**

```bash
npm run lint && npm test && npm run build
```

All three must pass. `npm run build` is the real gate — it runs `tsc -b`, the Vite build, and `scripts/prepare-sites.mjs`.

- [ ] **Step 2: Walk the three screens on a phone viewport**

With the preview running and `resize_window` set to `mobile`, as an **admin**:
1. `/inventory` → Categories → a category. Grid reads photo-first; pin persists across a reload.
2. Open a product. Hero bar, stepper, size rail, colour rail if present, pinned action bar clear of the bottom nav.
3. Add 2 units. Cart badge shows 2; the sheet docks to the bottom edge.
4. Checkout → `/sales` with the lines intact → complete the sale → lands on the receipt and the cart is empty.
5. Reload and confirm the cart is still empty (the clear persisted).

- [ ] **Step 3: Walk it as a staff account**

Confirm no cart button appears, the pin still works on cards and the product page, and "Add to sale" on a card is either hidden or leads nowhere broken. If it is visible to staff but the cart is not, make it admin-only on the card too — a control that silently does nothing is worse than an absent one.

- [ ] **Step 4: Check both consoles**

`read_console_messages` (expect zero errors) and `preview_logs level: error` (expect no build errors).

- [ ] **Step 5: Share the proof**

Take screenshots of all three screens on mobile and share them with the user.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: address defects found in the storefront verification pass"
```

---

## Self-review notes

- **Every reference element is accounted for.** Screen 1: photo tile ✓ (Task 7), heart ✓ (pin, Tasks 5+7), name/price footer ✓ (Task 7), cart badge ✓ (Task 6). Chip rail — deliberately skipped per the user's answer. Screen 2: hero + floating controls ✓ (Task 8), thumbnail rail ✓ (already built), stepper ✓ (Task 8), colour swatches ✓ (Task 9), size pills ✓ (already built), pinned actions ✓ (already built). Screen 3: cart sheet with line rows, totals, and checkout ✓ (Task 6).
- **Reference elements with no counter equivalent, and what they became:** Delivery Fee → Line discounts (a concept the POS already has); Buy Now → Go to checkout, which routes to the POS where payment is captured; the greeting/avatar header → the app's existing "Ano hanap mo?" greeting on the staff home, which already does that job.
- **Names are consistent across tasks:** `availableOf`, `lineTotal`, `cartSubtotal`, `cartCount`, `addLine`, `setLineQty`, `setLineDiscount`, `removeLine` (Task 2) are the exact names consumed in Tasks 3, 4, 6, 7, 8. `useCart()` returns `add`/`setQty`/`setDiscount`/`remove`/`clear`/`openCart`/`closeCart` throughout. `usePins()` returns `pinned`/`isPinned`/`toggle` in both Task 7 and Task 8. `.cart-step` is defined once in `cart.css` (Task 6) and re-skinned for the ink panel in `inventory.css` (Task 8).
- **The `.pcard-price` row replaces the Price fact row** rather than duplicating it — that is the one deliberate move of information, and it is the reference's own layout.
