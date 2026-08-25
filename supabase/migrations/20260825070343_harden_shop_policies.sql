create index sales_created_by_idx on public.sales(created_by) where created_by is not null;
create index stock_movements_created_by_idx on public.stock_movements(created_by) where created_by is not null;

drop policy categories_write_owner on public.categories;
create policy categories_insert_owner
on public.categories for insert to authenticated
with check ((select private.current_user_role()) = 'owner');
create policy categories_update_owner
on public.categories for update to authenticated
using ((select private.current_user_role()) = 'owner')
with check ((select private.current_user_role()) = 'owner');
create policy categories_delete_owner
on public.categories for delete to authenticated
using ((select private.current_user_role()) = 'owner');

drop policy profiles_write_owner on public.profiles;
create policy profiles_insert_owner
on public.profiles for insert to authenticated
with check ((select private.current_user_role()) = 'owner');
create policy profiles_update_owner
on public.profiles for update to authenticated
using ((select private.current_user_role()) = 'owner')
with check ((select private.current_user_role()) = 'owner');
create policy profiles_delete_owner
on public.profiles for delete to authenticated
using ((select private.current_user_role()) = 'owner');

drop policy sale_items_write_owner on public.sale_items;
create policy sale_items_update_owner
on public.sale_items for update to authenticated
using ((select private.current_user_role()) = 'owner')
with check ((select private.current_user_role()) = 'owner');
create policy sale_items_delete_owner
on public.sale_items for delete to authenticated
using ((select private.current_user_role()) = 'owner');
