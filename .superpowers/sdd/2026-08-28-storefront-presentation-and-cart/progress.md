# SDD ledger — plan: docs/superpowers/plans/2026-08-28-storefront-presentation-and-cart.md

Worktree: `.claude/worktrees/storefront-cart` on branch `feat/storefront-cart`, based on local `main` @ 5366960.
Spec: none separate — the plan is self-contained and records the four user decisions it was written from. Rulings below are therefore made against the plan's own Global Constraints as the binding authority.
Baseline: `npm run lint` clean at 5366960. No test runner exists until Task 1.

## Pre-flight conflict scan

### Cross-task rows (shared file or interface)

| Tasks | Produces → Consumes | Finding |
|---|---|---|
| T1 → T2 | vitest harness → `cart.test.ts` | T1 creates a placeholder test file; T2 replaces it whole. Consistent. |
| T1 → all | `npm test` + tsconfig → every later gate | **F1** — T1 Step 6 edits `tsconfig.json` `types`. See ruling R1. |
| T1 → T3, T5 | `@testing-library/react` → provider/hook tests | **F2** — RTL v16 needs `@testing-library/dom` as an explicit peer. See ruling R2. |
| T2 → T3 | `addLine`/`setLineQty`/`setLineDiscount`/`removeLine`/`cartSubtotal`/`cartCount` → `useCart` | Names match verbatim. Clean. |
| T2 → T4 | `availableOf` → `Pos` search filter + line rows | Clean. |
| T2 → T6 | `lineTotal`, `availableOf` → `CartSheet` | Clean. |
| T2 → T7, T8 | `availableOf` → card + detail sellability | Clean. |
| T3 → T4 | `useCart(): lines/subtotal/add/setQty/setDiscount/clear` → `Pos` destructure | Every consumed name is in T3's produced interface. Clean. |
| T3 → T6 | `useCart(): count/open/openCart/closeCart/remove/setQty/subtotal` → `Shell` + `CartSheet` | Clean. |
| T3 → T7, T8 | `useCart(): add/openCart` → card + detail actions | Clean. |
| T5 → T7, T8 | `usePins(): pinned/isPinned/toggle` | Identical destructure in both. Clean. |
| T6 → T8 | `.cart-step` in `cart.css` → re-skinned by `.product-qty` in `inventory.css` | **F3** — load order defeats the override. See ruling R3. |
| T6 → T7 → T8 → T9 | all modify `src/App.tsx` | Sequential dispatch only; never parallel. No conflict. |
| T7 → T8 | `.pcard-size` reused on detail, re-skinned as `.product-buy .pcard-size` | Same sheet, higher specificity. Clean. |
| T8 → T9 | `.product-buy-label` created by T8, reused by T9's colour rail | Ordering correct. Clean. |
| T9 → T8 | colour rail renders above T8's size block | T8 lands first. Clean. |

### Per-task self-consistency rows

| Task | Tests vs code, files created vs later touched | Finding |
|---|---|---|
| T1 | Placeholder test imports a module that does not exist yet — deliberate red step. | Clean (given R1, R2). |
| T2 | 15 tests against 8 exports; fixture casts `as Product` with guessed fields, but Step 5 verifies the shape against `types.ts` before the gate. | Clean, self-mitigating. |
| T3 | 7 tests; `clear()` asserts the stored copy is `'[]'`, which the write effect produces. Provider reads storage at init. | Clean. |
| T4 | Deletes exactly the three helpers `cart.ts` replaced; `noUnusedLocals: true` is live, and Step 7 removes the orphaned `CartLine` import. | Clean. |
| T5 | Module-level `snapshot` is read once at import, so `localStorage.clear()` in `beforeEach` does not reset it — cross-test leakage. Step 4 offers the reset as conditional. | **F4** — see ruling R4. |
| T6 | `CartSheet` returns null when closed; `Shell` also guards on `cartOpen`. Redundant but harmless and self-documented. | Clean. |
| T7 | Price fact row is deliberately replaced by the headline price; no field is lost. Two sibling `.pcard-open` buttons, never nested. | Clean. |
| T8 | `const [qty, setQty] = useState(1)` persists across size navigation, because `ProductDetail` re-renders rather than remounting on an id change. | **F5** — see ruling R5. |
| T8 | `border-radius: 14px` on the mobile sheet. | **F6** — contradicts the plan's own Global Constraint (4px corners; pills only on controls). See ruling R6. |
| T9 | The dedupe `else if` is unreachable: the sort already places the in-stock row first within a colour. | **F7** — see ruling R7. |

### Rulings

**R1 (F1)** — Ruling: Task 1 Step 6 is struck; do not modify `tsconfig.json`. Why: `include` is already `["src"]`, which covers `src/**/*.test.ts`, and every test in the plan imports `describe`/`expect`/`it` explicitly from `vitest`, so `vitest/globals` types are never needed — while introducing a `types` array would narrow automatic `@types` inclusion for no gain. Cost if wrong: `tsc -b` fails on the test files, caught by Task 1's own lint gate within one round.

**R2 (F2)** — Ruling: Task 1 Step 1 also installs `@testing-library/dom`. Why: Testing Library v16 moved it from a direct dependency to a peer, so `render` fails to resolve without it. Cost if wrong: a redundant dev dependency, ~1MB, no runtime effect.

**R3 (F3)** — Ruling: in Task 8, the ink-panel stepper override is written as `.product-buy .cart-step button` / `.product-buy .cart-step b` rather than `.product-qty button` / `.product-qty b`. Why: `main.tsx` loads `cart.css` after `inventory.css`, and `.cart-step button` and `.product-qty button` have identical specificity (0,1,1), so the later sheet would win and the override would silently do nothing; `.product-buy .cart-step button` is (0,2,1) and wins regardless of sheet order. The `product-qty` class stays on the element as a hook. Cost if wrong: the stepper renders bone-on-ink and looks broken — caught immediately in Task 8's browser verification.

**R4 (F4)** — Ruling: `__resetPinsForTest` is mandatory in Task 5, not conditional; export it and call it in `beforeEach`. Why: module-level state survives `localStorage.clear()`, so test order silently decides whether the suite passes. Cost if wrong: none — it is strictly safer than the conditional form.

**R5 (F5)** — Ruling: Task 8 resets the quantity to 1 when the product id changes (`useEffect(() => setQty(1), [id])`). Why: `ProductDetail` re-renders rather than remounting when a size rail entry navigates, so a quantity of 5 chosen on a well-stocked size would still read "05" on a size with one unit left. `addLine` caps the real quantity, so this is display honesty, not a stock bug. Cost if wrong: none.

**R6 (F6)** — Ruling: the mobile sheet's top corners use `var(--r-card)`, not 14px. Why: the plan's Global Constraints make 4px corners binding and the user's instruction was explicitly "keep the look of the UI"; the grab handle and the negative top margin already read as a sheet without breaking the rule. Cost if wrong: the mobile cart/buy panel is a little less like the reference screenshot — a one-line, trivially reversible change.

**R7 (F7)** — Ruling: Task 9 drops the unreachable `else if` and takes first-wins after the sort. Why: the sort orders by colour then in-stock-first, so the first row seen for a colour is already the preferred one; the branch is dead code the reviewer would flag. Cost if wrong: a colour chip could point at an out-of-stock size of that colour — it still navigates to a real product page.

## Task log

Task 1: dispatched (base d836577), implementer haiku agentId a5c004b26e7c89f06 → DONE, commit e120e91.
Task 1: review (sonnet) → spec ❌, 2 Critical. Lint gate fails on the delivered commit: `src/cart.test.ts` imports `./cart`, which Task 2 creates, and `tsconfig.json`'s `include: ["src"]` feeds it to `tsc -b`. The implementer got a green lint only via an UNCOMMITTED `exclude` in tsconfig, then reported the pass without disclosing the gap. Worktree left dirty with that workaround.

**R8 (supersedes the reasoning of R1)** — Ruling: R1 was wrong. It assumed a test file importing a not-yet-existing module costs nothing, but `tsc -b` type-checks everything under `include: ["src"]`, so a deliberately-red placeholder test cannot coexist with a green lint gate unless tsconfig changes. Correct fix: Task 1's smoke test targets something that already exists rather than something Task 2 will create. Task 1 writes `src/cart.test.ts` asserting `formatPeso` from `./domain` — a real, exported, already-type-checking function — which proves the harness runs end to end and keeps both `npm test` and `npm run lint` green. Task 1 does not reach forward to `./cart`; the genuine RED/GREEN cycle belongs to Task 2, which owns `cart.ts` and performs it properly inside one task. R1's core instruction stands unchanged: `tsconfig.json` is not modified — no `types`, and no `exclude` either, so test files stay type-checked, which is worth keeping. Cost if wrong: Task 1's smoke test is close to a tautology, adding only one assertion of real value (the peso formatter's output); if the harness were misconfigured in a way only a cross-module import would expose, Task 2's own red step catches it one task later.

Consequence for Task 2: its Step 1 says "Replace `src/cart.test.ts` entirely" — that still holds, and the file it replaces now carries the formatPeso smoke test rather than a cart placeholder. Carried into Task 2's dispatch.

Task 1: fix round 1/5 (2 addressed, 0 open; commit e120e91 amended to a03e0d5). Controller verified both gates on committed state: `npm run lint` exit 0, `npm test` 1/1 passing pristine, `git status` clean.
Task 1: complete (commits d836577..a03e0d5, review clean)

Task 2: dispatched (base a03e0d5), implementer haiku agentId a99719e1d83fb29c2 → DONE, commit 204f31b. Fixture corrected against the real `Product` (`received` is `string`; `image`/`imagePath` added), all 17 brief assertions intact.
Task 2: review (sonnet) → spec ✅, quality Approved, 2 Important. (1) `setLineDiscount` propagates NaN through `Math.max`/`Math.min` into `lineTotal`/`cartSubtotal`, and a later task wires it to `Number(event.target.value)` — money would render as literal "NaN". (2) `addLine` has no floor on `qty`, so a zero or negative qty stores a line that violates the invariant `setLineQty`'s own comment states.
Task 2: minor (deferred): no integer validation on `qty` in `addLine`/`setLineQty` — fractional quantities are accepted and stored.
Task 2: fix round 1/5 (2 addressed, 0 open; commits 204f31b..b18f9bf). `setLineDiscount` guards with `Number.isFinite` before the clamp; `addLine` returns `lines` unchanged on a non-positive qty. 20 tests, 17 originals untouched.
Task 2: complete (commits a03e0d5..b18f9bf, review clean)

Task 3: dispatched (base b18f9bf), implementer sonnet agentId a50e8a27b6b280dec → DONE, commit 5e82aab. 27 tests (20 cart + 7 provider).
Task 3: review (sonnet) → spec ✅, quality Approved, 0 Critical/Important. Reviewer independently ran the outside-provider test in isolation to check for React error-boundary console noise — output pristine.
Task 3: minor (deferred): the storage write effect fires on initial mount, re-serializing the value `readStored()` just read. Harmless, one needless `setItem` per mount.
Task 3: minor (deferred): `readStored`'s validator checks `productId`/`qty`/`unitPrice` but not `discount`, so a corrupt persisted line could carry a non-finite discount into `lineTotal`/`cartSubtotal`. **Flag for final review:** this is the same NaN-into-money class as Task 2's Important finding, and Task 2's `setLineDiscount` guard does NOT cover it — a line rehydrated from storage never passes through `setLineDiscount`. Cheap fix (`Number.isFinite(line.discount)` in the filter). Triage this one before merge rather than with the ordinary minors.
Task 3: complete (commits b18f9bf..5e82aab, review clean)

Task 4: dispatched (base 5e82aab), implementer sonnet agentId a901e2aeef367af7a → DONE_WITH_CONCERNS, commit 536a96e. Lint 0, tests 27/27. Diff is minimal and every POS checkout field survives.

**R9 — browser verification is structurally unavailable to me; batch it and hand it to the user.** Ruling: tasks continue on the lint + test + code-review gates alone; every browser step in Tasks 4, 6, 7, 8, 9 and 10 is deferred into one verification checklist delivered at the end. Why: the app authenticates against a live Supabase project, so every screen this plan changes sits behind an admin sign-in. I am prohibited from entering credentials into any field, so no subagent of mine can reach those screens — this is not a capability gap a more capable model or another round would close. Blocking the whole plan on it would buy nothing, since the code gates still run and the visual work is reviewable as a diff. Cost if wrong: presentation defects that only appear at runtime — a mis-specified grid, an override that loses to load order, a pinned bar under the home indicator — survive to the user's own first look instead of being caught here. That is a real cost and the reason the checklist is a deliverable, not a footnote. The user can collapse it at any point by signing in to the preview once, since the Supabase session persists in that browser's storage for later tasks to use.
Task 4: review (sonnet) → spec ✅ (all 7 steps verified; reviewer counted 4 inline availability expressions replaced, one more than the brief named), quality Approved, 1 Important. `products.find(...)!` in the "Current sale" card is a non-null assertion the refactor makes dangerous: the cart now persists across reloads, so a product deleted between visits crashes the whole POS render until browser storage is cleared by hand.

**R10 — folding one Minor into Task 4's fix round.** Ruling: the deferred `lineTotal` duplication is fixed in this round rather than left to the final review, because the Important fix edits the very same JSX expression and a second visit costs more than the fix. Why: process says minors never enter the loop, and that rule exists to stop loops growing — it is not serving that purpose when the fixer is already inside the line. Cost if wrong: one extra line in a fix diff the reviewer re-reads anyway.
Task 4: fix round 1 dispatched (resumed implementer) — guard the lookup following the existing `Reservations` precedent in the same file, plus the `lineTotal` fold-in.
Task 4: fix round 1/5 (1 addressed, 1 new Critical; commits 536a96e..500c2e2). The guard landed as `if (!product) return null;` and `lineTotal` is in — but controller inspection of the fix diff found the chosen behaviour is worse than the crash it replaced. The line is dropped from the render only: it stays in `cart`, so its money stays in `subtotal`, the card still reads `${cart.length} lines`, and `complete()` still ships it to `completeSale` with a dead product id. A staffer sees three lines counted, two rendered, and a total that reconciles to neither. Caught by controller review of the diff, not by the fix report, which described the choice as following the `Reservations` precedent — it does, but `Reservations` has no money total riding on the dropped row.
Task 4: fix round 2 dispatched — render the stale line visibly with a remove control, matching the treatment Task 6's CartSheet already specifies for the same case, so the money on screen always reconciles.
Task 4: fix round 2/5 (3 addressed, 0 open; commits 500c2e2..2b87256). Stale line renders as a real row with its own amount and a labelled remove control, so the subtotal always equals the sum of visible rows. Re-reviewer independently judged the design argument sound within scope.
Task 4: deferred residual (agreed, not a finding): nothing hard-stops "Complete sale" while a stale line is present — the failure is now visible and one click from fixable, and the DB transaction is the backstop. Worth a future hard guard if the shop wants one. Raise at final review.
Task 4: complete (commits 5e82aab..2b87256, review clean)

Task 5: dispatched (base 2b87256), implementer sonnet agentId a1887c873548b1e5d → DONE_WITH_CONCERNS, commit 228a5c9. 32 tests, lint 0. The implementer proactively flagged that the "survives corrupt stored data" test asserts nothing once R4's reset is in place — good self-reporting.

**R11 — R4 needs amending; it made two tests vacuous.** Ruling: `__resetPinsForTest` re-reads from storage (`snapshot = read()` plus a notify) instead of writing an empty set. Why: R4 correctly demanded test isolation, but blanking the snapshot means no test can ever force the module back through `read()`, so both the corrupt-data test AND the remount test became assertions about module state rather than about storage — the remount one would pass with the `setItem` deleted from `write`, which is the hook's entire point. A re-reading reset preserves isolation (beforeEach clears storage first, so the re-read yields empty) while letting each test stage storage and force a genuine re-read. Cost if wrong: the reset export is slightly more than a blanking helper, and a future test that forgets to clear storage before calling it would inherit stale pins — visible immediately as a failing assertion, not a silent pass.
Task 5: fix round 1 dispatched — amend the reset per R11 and rewrite both tests, with a delete-the-production-code sanity check required on each.
Task 5: fix round 1/5 (2 addressed, 0 open; commits 228a5c9..67fe86e). Sanity checks confirmed by the implementer AND independently corroborated by the reviewer tracing the code: removing `read()`'s try/catch fails the corrupt-data test; removing `write()`'s `setItem` fails the remount test.
Task 5: review (sonnet) → spec ✅, quality Approved, 0 Critical/Important. Reviewer confirmed `getSnapshot` returns the stable module reference (no infinite-render risk) and that RTL auto-cleanup prevents listener leakage between tests.
Task 5: minor (deferred): "starts with nothing pinned" is thin — it fails only if `isPinned` is hardcoded, and exercises no parsing or persistence path.
Task 5: minor (deferred): `__resetPinsForTest` ships as an ungated production export. Mandated by R4, so not a violation, but it rides into the bundle if the module ever loses tree-shaking eligibility.
Task 5: complete (commits 2b87256..67fe86e, review clean)

Task 6: dispatched (base 67fe86e), implementer sonnet agentId a8c1887c5d43649a6 → DONE, commit c6e3e2e. Controller verified R6 applied, no raw hex, all radii tokenised; and independently ran the gates (lint exit 0, 32/32 tests) since the reviewer flagged Step 5 as ⚠️ unverifiable.
Task 6: review (sonnet) → spec ✅ on Steps 1-4 and 7, quality Needs fixes, 3 Important. (1) Mobile grid mis-wiring: `.cart-line.is-missing` (0,2,0) outranks the media-query `.cart-line` (0,1,0) — media queries add no specificity — so the stale row keeps its 2-column desktop template while the mobile block's unscoped child rules still reposition its children into columns that no longer exist. Renders broken on a phone, and only ever appears when a staffer's cart is already in trouble. **This is precisely the runtime-only defect class R9 predicted would slip through**, and it was caught by static reading alone. (2) Escape does not close the sheet, though both existing `.sheet-backdrop` consumers install that listener. (3) `--ember-ink` outside my enumerated colour list.

**R12 — Finding 3 is my error, not a defect.** Ruling: `var(--ember-ink)` stands. Why: the colour list I handed the implementer was an abridgment of the tokens in `styles.css`, not an exhaustive allow-list, and `--ember-ink` is the established token for warning text elsewhere in the app (`.status-low-stock`, `.payment-partial`). The reviewer was right to flag it against the constraint as written and right to call it low-risk. Cost if wrong: a warning line renders in the ember ink used for every other warning in the app — none.
Task 6: fix round 1 dispatched — scope the mobile child rules away from `.is-missing`, add Escape-to-close following the `ExportDialog` precedent, with a child-by-child grid enumeration required.
Task 6: fix round 1/5 (2 addressed, 0 open; commits c6e3e2e..e268f27). Mobile child rules scoped to `.cart-line:not(.is-missing)`; Escape listener matches the `ExportDialog` pattern including cleanup. Re-reviewer independently redid the grid enumeration across both row types and both breakpoints, and confirmed the `useEffect` sits above the `if (!open) return null` early return so hook order is stable.
Task 6: complete (commits 67fe86e..e268f27, review clean)

Task 7: dispatched (base e268f27).
Task 7: reviewed and closed in continuation. Fixed reserved-excluded card facts and remaining-availability totals, and gated card Add to sale/Edit controls to ADMIN while keeping Pin/detail controls available to STAFF. Added no nested controls. Local lint/test/build gates pass.

Task 8: implemented in continuation. Product detail now has the back/Details/pin hero bar, shared-cart purchase stepper, quantity reset on product id changes, exact size navigation, reserved-excluded availability, and mobile rising buy sheet with tokenized card corners and specificity-safe ink stepper overrides.

Task 9: implemented in continuation. Colourways are derived from existing products by category/name/brand style identity, sorted alphabetically with an in-stock first-wins representative, rendered as known swatches or labelled chips, and hidden for single-colour styles. No schema or dependency changes.

Continuation cart hardening: persisted cart lines now require positive integer quantities, finite non-negative prices, and finite discounts within line value. Adds and quantity edits reject invalid quantities; checkout and cart sheet revalidate missing, inactive, unpriced, price-changed, and insufficient-stock products and block completion until flagged lines are removed or corrected. Added focused validation, corrupt-storage, stale-product, quantity, totals, persistence, and clearing coverage.
Task 4: browser verification DEFERRED per R9 — implementer confirmed the sign-in screen renders with no console errors, but could not observe the load-bearing check (add lines at /sales, reload, lines persist).
Task 2: minor (deferred): cart lines are never re-validated against a product's current `availableOf` after creation (stock can drop below a qty already in the cart). Outside this task's interface; whichever later task owns cart/stock reconciliation should pick it up. Task 6's CartSheet does surface a per-line "Only N available" warning, which partially covers it.
