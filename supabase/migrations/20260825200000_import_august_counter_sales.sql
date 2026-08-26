-- August 2026 counter sales from the shop's manual sheet: 9 transactions,
-- 9 units, PHP 91,100 total.
--
-- Imported as HISTORICAL. These sales already happened and on-hand already
-- reflects them, so this writes nothing to stock_movements and does not alter
-- products. Inventory is left exactly as it is, per standing instruction.
--
-- Item codes are inferred from the names in the screenshot where the live
-- catalogue has a usable match. The two deliberate assumptions are recorded
-- in the source below: teal Bennington maps to the live slate Bennington M
-- row, and the Southby wine vest maps to the live wine Bennington S row.
-- Lace Lock has no matching live product and remains unmatched.
--
-- Not imported: the MERCHANT column, which reads "HTI" on every row and so
-- carries nothing that distinguishes one sale from another.

-- The REMARKS column names who made the sale. Those are staff names, not
-- linked accounts, so created_by cannot carry them.
alter table public.sales
  add column if not exists seller_note text;

comment on column public.sales.seller_note is
  'Seller name from an imported source sheet, where created_by is unknown.';

with source (sold_on, description, assumed_sku, customer, qty, amount, payment, seller) as (
  values
    (date '2026-08-01', 'Lace Lock',                        null::text,              'Jaden Breetzke',  1, null::numeric,    null::text, null::text),
    (date '2026-08-02', '2026 Sapparod 156',                '26sap156',              'Jong Ho Woen',    1, 30000::numeric,  'Cash',     'Sir Clo'),
    (date '2026-08-02', 'Triple 8 Gotham Helmet L',         '21watcrl',              'Michael Ho',      1, 2000::numeric,   'Cash',     'Mark'),
    (date '2026-08-06', 'Vest Teal Bennington M',           '26vfocbensltm',         'Octave Dtmat',    1, 10800::numeric,  'Cash',     'Sir Clo'),
    (date '2026-08-06', 'lugfocsstn60',                     '25lugfoclocdbagstn60', 'Ash Romagnoli',   1, 9900::numeric,   'Cash',     'Mark'),
    (date '2026-08-08', 'Focal Bennington Black S',         '26vfocbenblks',         'Khai Lim',        1, 10800::numeric,  'Cash',     'Duane'),
    (date '2026-08-09', 'Bennington Wine Impact Vest S',    '26vhelbenwns',         'Red Ong',         1, 10800::numeric,  'Cash',     'Duane'),
    (date '2026-08-14', 'Southby Bennington Vest S Wine',   '26vhelbenwns',         'I3 Cantimbuhan',  1, 10800::numeric,  'Cash',     'Jia'),
    (date '2026-08-15', 'Wakeboard Gear (Partial Payment)', null::text,             'Cris Salaveria',  1, 6000::numeric,   'Deposit',  'Jia')
),
inserted as (
  insert into public.sales (sold_at, subtotal, discount, total, payment_method, status, is_historical, customer_name, seller_note)
  select
    (source.sold_on::text || ' 12:00:00+08')::timestamptz,
    source.amount,
    0,
    source.amount,
    source.payment,
    'completed'::public.sale_status,
    true,
    source.customer,
    source.seller
  from source
  where not exists (
    select 1
    from public.sales existing
    where existing.is_historical
      and existing.customer_name = source.customer
      and existing.total is not distinct from source.amount
      and (existing.sold_at at time zone 'Asia/Manila')::date = source.sold_on
  )
  returning id, customer_name, total
)
insert into public.sale_items (sale_id, product_id, description, qty, unit_price, discount, line_total)
select inserted.id, product.id, source.description, source.qty, source.amount, 0, source.amount
from inserted
join source
  on source.customer = inserted.customer_name
 and source.amount is not distinct from inserted.total
left join public.products product
  on product.sku = source.assumed_sku;
