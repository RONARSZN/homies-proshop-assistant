-- Product photos.
--
-- One optional photo per product. Keyed on products.id (uuid) and never on
-- SKU: six SKUs are duplicated in this catalogue, and two of those collisions
-- are genuinely different products, so a SKU-keyed photo would attach one
-- image to two items.
--
-- The bucket is private. Product photos are not sensitive, but every other
-- table here is behind RLS and a public bucket would be the one unguarded
-- door in the schema.

alter table public.products
  add column if not exists image_path text;

comment on column public.products.image_path is
  'Object path inside the product-photos bucket. Null means no photo captured yet.';

-- 512 KB ceiling backs up the client-side downscale. The client targets
-- 300 KB; this stops an oversized upload if that ever fails or is bypassed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-photos',
  'product-photos',
  false,
  524288,
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do nothing;

-- Anyone signed in can see product photos.
create policy product_photos_read_authenticated
on storage.objects for select to authenticated
using (bucket_id = 'product-photos');

-- Managers and owners capture and replace them. Staff cannot: this mirrors
-- products_update_manager, so photo rights follow product-edit rights.
create policy product_photos_insert_manager
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-photos'
  and (select private.current_user_role()) in ('owner', 'manager')
);

create policy product_photos_update_manager
on storage.objects for update to authenticated
using (
  bucket_id = 'product-photos'
  and (select private.current_user_role()) in ('owner', 'manager')
)
with check (
  bucket_id = 'product-photos'
  and (select private.current_user_role()) in ('owner', 'manager')
);

create policy product_photos_delete_manager
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-photos'
  and (select private.current_user_role()) in ('owner', 'manager')
);
