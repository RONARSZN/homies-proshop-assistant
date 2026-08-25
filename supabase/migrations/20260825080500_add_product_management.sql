create function public.create_product(
  p_sku text,
  p_name text,
  p_category_id uuid,
  p_brand text default null,
  p_size text default null,
  p_colour text default null,
  p_unit_cost numeric default null,
  p_selling_price numeric default null,
  p_supplier text default null,
  p_received_at date default null,
  p_opening_quantity integer default 0
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  product_id uuid;
begin
  if (select private.current_user_role()) not in ('owner', 'manager') then
    raise exception 'Only an owner or manager may add products.' using errcode = 'insufficient_privilege';
  end if;
  if nullif(btrim(p_sku), '') is null or nullif(btrim(p_name), '') is null then
    raise exception 'SKU and product name are required.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'Select a valid category.' using errcode = 'foreign_key_violation';
  end if;
  if p_opening_quantity < 0 then
    raise exception 'Opening quantity cannot be negative.' using errcode = 'check_violation';
  end if;

  insert into public.products (
    sku, name, category_id, brand, size, colour, unit_cost,
    selling_price, supplier, received_at
  )
  values (
    btrim(p_sku), btrim(p_name), p_category_id, nullif(btrim(p_brand), ''),
    nullif(btrim(p_size), ''), nullif(btrim(p_colour), ''), p_unit_cost,
    p_selling_price, nullif(btrim(p_supplier), ''), p_received_at
  )
  returning id into product_id;

  if p_opening_quantity > 0 then
    insert into public.stock_movements (product_id, delta, reason, note, created_by)
    values (product_id, p_opening_quantity, 'receipt', 'Initial stock entered when product was created', (select auth.uid()));
  end if;

  return product_id;
end;
$$;

revoke all on function public.create_product(text, text, uuid, text, text, text, numeric, numeric, text, date, integer) from public, anon;
grant execute on function public.create_product(text, text, uuid, text, text, text, numeric, numeric, text, date, integer) to authenticated;
