-- 0003_rls_policies.sql
--
-- Policies mínimas para lo que la app hace HOY. Todo lo no declarado queda
-- denegado: con RLS habilitado, "sin policy" es "sin acceso".
--
-- Roles:
--   anon           → sin acceso a nada (toda la app está detrás de login)
--   authenticated  → lee catálogo, compra, reseña; admin además escribe productos
--   service_role   → bypassa RLS (dashboard / tareas administrativas)
--
-- Lo que estas policies NO resuelven todavía: el precio y el total de una orden
-- los sigue mandando el cliente. Eso es la RPC transaccional (Parte 4).

-- Helper: evita recursión de policies sobre profiles y repetir el subquery.
-- SECURITY DEFINER + search_path fijo: corre como owner y no queda expuesto.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

-- Sin acceso anónimo, aunque falte una policy o cambien los grants por defecto.
revoke all on public.profiles, public.products, public.orders, public.order_items, public.reviews from anon;

-- Supabase otorga ALL por defecto a authenticated. Sin este revoke quedan
-- TRUNCATE / REFERENCES / TRIGGER (TRUNCATE no pasa por RLS) y UPDATE/DELETE
-- que ninguna policy autoriza. Los grants mínimos vuelven justo abajo.
revoke all on public.profiles, public.products, public.orders, public.order_items, public.reviews from authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
-- orders/order_items son solo lectura directa: la única escritura es la RPC
-- create_order (0004). Si acá se otorgara INSERT, la RPC sería opcional y el
-- cliente podría volver a mandar su propio total.
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select, insert on public.reviews to authenticated;

-- profiles: cada uno ve solo el suyo. Escribir perfiles es tarea del dashboard
-- (service_role), no de la app: así nadie puede auto-asignarse 'admin'.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- products: catálogo legible por cualquier usuario logueado.
drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products
  for select to authenticated
  using (true);

drop policy if exists products_insert_admin on public.products;
create policy products_insert_admin on public.products
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists products_update_admin on public.products;
create policy products_update_admin on public.products
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists products_delete_admin on public.products;
create policy products_delete_admin on public.products
  for delete to authenticated
  using (public.is_admin());

-- orders: cada cliente ve y crea solo las suyas, y siempre en 'pending'.
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()));

-- La escritura de órdenes es exclusivamente la RPC create_order (0004). Se
-- eliminan acá para que re-aplicar 0003 no reabra el bypass del insert directo.
drop policy if exists orders_insert_own on public.orders;
drop policy if exists order_items_insert_own on public.order_items;

-- order_items: solo de órdenes propias.
drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = (select auth.uid())
    )
  );

drop policy if exists order_items_insert_own on public.order_items;

-- reviews: lectura pública para logueados, escritura solo a nombre propio.
drop policy if exists reviews_select_authenticated on public.reviews;
create policy reviews_select_authenticated on public.reviews
  for select to authenticated
  using (true);

drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()));
