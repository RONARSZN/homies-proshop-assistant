create function private.prevent_negative_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_on_hand integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.product_id::text, 0));
  select coalesce(sum(delta), 0)::integer
  into current_on_hand
  from public.stock_movements
  where product_id = new.product_id;

  if current_on_hand + new.delta < 0 then
    raise exception 'Insufficient stock: % available, movement % requested.', current_on_hand, new.delta
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger stock_movements_prevent_negative
before insert on public.stock_movements
for each row execute function private.prevent_negative_stock();

revoke all on function private.prevent_negative_stock() from public;
