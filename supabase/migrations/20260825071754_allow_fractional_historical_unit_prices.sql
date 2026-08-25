alter table public.sale_items drop constraint sale_items_check1;
alter table public.sale_items add constraint sale_items_line_total_check
check (
  line_total is null
  or unit_price is null
  or discount is null
  or abs(line_total - (qty * unit_price - discount)) < 0.01
);
