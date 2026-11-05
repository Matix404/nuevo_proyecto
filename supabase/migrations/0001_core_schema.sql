-- 0001_core_schema.sql
--
-- Baseline de instalación limpia del esquema public.
--
-- IMPORTANTE: esto NO es un snapshot de tu base de producción. Se derivó de las
-- columnas que el código realmente usa (frontend/src/types/index.ts y las llamadas
-- .from(...) de cada página). Las líneas marcadas "-- inferred:" son deducciones,
-- no verdades leídas del dashboard.
--
-- Para convertir esto en un snapshot fiel hay que compararlo con:
--   select table_name, column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public'
--   order by table_name, ordinal_position;
--
-- RLS queda HABILITADO sin policies a propósito: fail-closed. Las policies son
-- la Parte 3; hasta entonces la app no va a poder leer ni escribir.

-- gen_random_uuid() es core desde PostgreSQL 13: no hace falta pgcrypto.

-- Perfil 1:1 con el usuario de auth. El rol se asigna fuera de la app.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'cliente'
    check (role in ('admin', 'cliente')),        -- inferred: text + check, no enum
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),   -- inferred: numeric, no float
  image_url text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  total numeric(10, 2) not null check (total >= 0),
  status text not null default 'pending',             -- inferred: free text, app escribe 'pending'
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  price numeric(10, 2) not null check (price >= 0),   -- precio al momento de la compra
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)                        -- README: 1 reseña por usuario y producto
);

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);

create index if not exists order_items_order_idx
  on public.order_items (order_id);

create index if not exists reviews_product_created_idx
  on public.reviews (product_id, created_at desc);

create index if not exists products_created_by_idx
  on public.products (created_by);

alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews     enable row level security;
