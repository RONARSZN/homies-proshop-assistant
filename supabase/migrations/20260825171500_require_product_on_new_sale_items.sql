-- Future sale lines must reference a product.
--
-- The 43 unmatched lines from the Google Sheet import are closed history: they
-- were never matched to products and never will be, so sale_items.product_id
-- stays nullable rather than rewriting the past.
--
-- Everything rung up from here on is different. The POS already passes a
-- product id for every line, so this trigger is a guard, not a behaviour
-- change: it makes the guarantee hold even if a line is ever inserted by some
-- other path. A CHECK constraint cannot express this, because the exemption
-- lives on the parent sales row.

create function private.require_product_on_sale_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.product_id is null
     and not exists (
       select 1
       from public.sales
       where id = new.sale_id
         and is_historical
     )
  then
    raise exception
      'Sale lines must reference a product. Only imported historical sales may be unmatched.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.require_product_on_sale_item() from public;

create trigger sale_items_require_product
before insert or update of product_id, sale_id on public.sale_items
for each row
execute function private.require_product_on_sale_item();
