-- A counter seller may be different from the authenticated account.
alter table public.sales
  add column if not exists seller_name text;

comment on column public.sales.seller_name is
  'Optional seller name typed at the counter; created_by remains the audit account.';

revoke update on table public.sales from authenticated;
grant update (seller_name) on table public.sales to authenticated;

create policy sales_update_seller_staff
on public.sales for update to authenticated
using (
  (select private.current_user_role()) in ('owner', 'manager', 'staff')
  and created_by = (select auth.uid())
  and not is_historical
)
with check (
  (select private.current_user_role()) in ('owner', 'manager', 'staff')
  and created_by = (select auth.uid())
  and not is_historical
);

create function public.complete_sale_with_seller(
  p_items jsonb,
  p_order_discount numeric,
  p_payment_method text,
  p_customer_name text default null,
  p_amount_paid numeric default 0,
  p_seller_name text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sale_id uuid;
begin
  sale_id := public.complete_sale(
    p_items,
    p_order_discount,
    p_payment_method,
    p_customer_name,
    p_amount_paid
  );

  update public.sales
  set seller_name = nullif(btrim(p_seller_name), '')
  where id = sale_id;

  return sale_id;
end;
$$;

revoke all on function public.complete_sale_with_seller(jsonb, numeric, text, text, numeric, text) from public, anon;
grant execute on function public.complete_sale_with_seller(jsonb, numeric, text, text, numeric, text) to authenticated;
