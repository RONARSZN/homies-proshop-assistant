-- Guarantee every sale carries a timestamp.
--
-- sold_at is already NOT NULL, so a row can never be stored without one, and
-- complete_sale passes now(). This adds a default so any future insert path
-- that forgets the column gets a real timestamp rather than failing — the
-- column is the record of when a sale happened, and it should be impossible
-- to omit rather than merely rejected.
--
-- Note this does NOT touch the 146 imported rows. Every one carries a
-- placeholder noon from its source sheet, which is a date the shop recorded
-- and a time it did not. The UI shows a clock time only for sales rung up in
-- this app, so an invented time is never presented as a record.

alter table public.sales
  alter column sold_at set default now();

comment on column public.sales.sold_at is
  'When the sale happened. Real for POS sales; imported rows carry a placeholder time of day.';
