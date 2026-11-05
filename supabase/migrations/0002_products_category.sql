-- Adds product categories.
-- Run this in Supabase Dashboard -> SQL Editor -> New query.

alter table public.products
  add column if not exists category text not null default 'Otros';

create index if not exists products_category_idx
  on public.products (category);
