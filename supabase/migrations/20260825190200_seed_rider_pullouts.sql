-- Imports the HOMIES RIDERS PULLOUT and DUP INTERNATIONAL RIDERS PULLOUT tabs
-- from the HOMIES MONITORING workbook: 10 units across 7 riders.
--
-- These rows are HISTORICAL. They already happened and current on-hand already
-- reflects them, so this migration writes nothing to stock_movements and does
-- not alter products. Inventory is left exactly as it is.
--
-- Two rows have no date in the source; allocated_at is left null rather than
-- inventing one. COST and VALUE are blank throughout the source and are not
-- imported.

insert into public.team_riders (full_name, team)
values
  ('Derek Hewitt',   'Homies'),
  ('Mark Louie',     'Homies'),
  ('Jia Dela Torre', 'Homies'),
  ('Duane Dulay',    'Homies'),
  ('Clo',            'Homies'),
  ('Raph',           'Homies'),
  ('Herve Puyol',    'DUP International')
on conflict do nothing;

insert into public.rider_allocations (rider_id, product_id, item_code, qty, allocated_at, is_historical)
select
  rider.id,
  (select p.id from public.products p where p.sku = source.item_code limit 1),
  source.item_code,
  source.qty,
  source.allocated_at,
  true
from (values
  ('Derek Hewitt',   '26sap156',      1, date '2026-03-08'),
  ('Mark Louie',     '26sap152',      1, null::date),
  ('Mark Louie',     '26mojwt78',     1, null::date),
  ('Jia Dela Torre', '26cv150',       1, date '2026-07-01'),
  ('Jia Dela Torre', '24herbk78',     1, date '2026-07-01'),
  ('Duane Dulay',    '20lace',        1, date '2026-07-04'),
  ('Mark Louie',     '25sap152',      1, date '2026-08-04'),
  ('Clo',            '26vhelbenwnm',  1, date '2026-08-05'),
  ('Raph',           '26atl146',      1, date '2026-08-08'),
  ('Herve Puyol',    '25figherrd910', 1, date '2026-01-01')
) as source(rider_name, item_code, qty, allocated_at)
join public.team_riders rider
  on lower(btrim(rider.full_name)) = lower(source.rider_name)
where not exists (
  select 1 from public.rider_allocations existing
  where existing.rider_id = rider.id
    and existing.item_code = source.item_code
    and existing.is_historical
);
