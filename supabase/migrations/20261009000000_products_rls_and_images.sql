alter table public.products
  add column if not exists active boolean not null default true;

alter table public.products enable row level security;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

do $$
declare
  product_id_sequence regclass := pg_get_serial_sequence('public.products', 'id');
begin
  if product_id_sequence is not null then
    execute format('grant usage, select on sequence %s to authenticated', product_id_sequence);
  end if;
end
$$;

drop policy if exists "public can read active products" on public.products;
drop policy if exists "admins can insert products" on public.products;
drop policy if exists "admins can update products" on public.products;
drop policy if exists "admins can delete products" on public.products;
drop policy if exists "product reads must be active or admin" on public.products;
drop policy if exists "product inserts must be admin" on public.products;
drop policy if exists "product updates must be admin" on public.products;
drop policy if exists "product deletes must be admin" on public.products;

create policy "public can read active products"
  on public.products
  for select
  to anon, authenticated
  using (
    active is true
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "admins can insert products"
  on public.products
  for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admins can update products"
  on public.products
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admins can delete products"
  on public.products
  for delete
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "product reads must be active or admin"
  on public.products
  as restrictive
  for select
  to anon, authenticated
  using (
    active is true
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "product inserts must be admin"
  on public.products
  as restrictive
  for insert
  to anon, authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "product updates must be admin"
  on public.products
  as restrictive
  for update
  to anon, authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "product deletes must be admin"
  on public.products
  as restrictive
  for delete
  to anon, authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.sync_products_id_sequence()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sequence_name text;
  maximum_id bigint;
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Admin access required';
  end if;

  sequence_name := pg_catalog.pg_get_serial_sequence('public.products', 'id');
  if sequence_name is null then
    raise exception 'The products.id column has no generated sequence';
  end if;

  select max(id) into maximum_id from public.products;
  if maximum_id is null then
    perform pg_catalog.setval(sequence_name::regclass, 1, false);
  else
    perform pg_catalog.setval(sequence_name::regclass, maximum_id, true);
  end if;
end
$$;

revoke all on function public.sync_products_id_sequence() from public, anon, authenticated;
grant execute on function public.sync_products_id_sequence() to authenticated;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

alter table storage.objects enable row level security;

drop policy if exists "public can read product images" on storage.objects;
drop policy if exists "admins can upload product images" on storage.objects;
drop policy if exists "admins can update product images" on storage.objects;
drop policy if exists "admins can delete product images" on storage.objects;
drop policy if exists "product image uploads must be admin" on storage.objects;
drop policy if exists "product image updates must be admin" on storage.objects;
drop policy if exists "product image deletes must be admin" on storage.objects;

create policy "public can read product images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "admins can upload product images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "admins can update product images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "admins can delete product images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "product image uploads must be admin"
  on storage.objects
  as restrictive
  for insert
  to anon, authenticated
  with check (
    bucket_id <> 'product-images'
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "product image updates must be admin"
  on storage.objects
  as restrictive
  for update
  to anon, authenticated
  using (
    bucket_id <> 'product-images'
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id <> 'product-images'
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "product image deletes must be admin"
  on storage.objects
  as restrictive
  for delete
  to anon, authenticated
  using (
    bucket_id <> 'product-images'
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
