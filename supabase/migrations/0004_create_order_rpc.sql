-- 0004_create_order_rpc.sql
--
-- Cierra el agujero de la Parte 3: hasta acá el cliente mandaba `total` y
-- `price` en el insert, y las policies solo controlaban de quién era la fila.
-- Ahora la compra es una sola operación en el servidor: los precios se leen de
-- products y el total se calcula acá. Todo o nada.
--
-- Consecuencia deliberada: se elimina el insert directo de orders/order_items
-- para authenticated. Si dejáramos los grants, la RPC sería opcional y el
-- bypass seguiría abierto.

create or replace function public.create_order(items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_order_id uuid;
  v_total    numeric(10, 2);
begin
  if v_user is null then
    raise exception 'create_order: usuario no autenticado' using errcode = '42501';
  end if;

  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'create_order: carrito vacío o inválido' using errcode = '22023';
  end if;

  -- Forma del payload antes de castear nada.
  if exists (
    select 1
    from jsonb_array_elements(items) e
    where jsonb_typeof(e) <> 'object'
       or not (e ? 'product_id')
       or not (e ? 'quantity')
       or (e ->> 'product_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       or (e ->> 'quantity') !~ '^[0-9]{1,4}$'
       or (e ->> 'quantity')::int < 1
       or (e ->> 'quantity')::int > 1000
  ) then
    raise exception 'create_order: item inválido' using errcode = '22023';
  end if;

  -- Precio y cantidad viven acá, no en el request. El total arranca en 0 y se
  -- corrige al final: si algo falla, el rollback se lleva la orden completa.
  insert into public.orders (user_id, total, status)
  values (v_user, 0, 'pending')
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, quantity, price)
  select v_order_id, agg.product_id, agg.quantity, p.price
  from (
    select (e ->> 'product_id')::uuid as product_id,
           sum((e ->> 'quantity')::int)::int as quantity
    from jsonb_array_elements(items) e
    group by 1
  ) agg
  join public.products p on p.id = agg.product_id;

  -- Productos inexistentes: el join los descarta, así que comparamos conteos.
  -- Si no coinciden, esto aborta y no queda orden huérfana.
  if (select count(*) from public.order_items where order_id = v_order_id)
     <> (select count(distinct (e ->> 'product_id')::uuid) from jsonb_array_elements(items) e)
  then
    raise exception 'create_order: producto inexistente' using errcode = '23503';
  end if;

  update public.orders
     set total = coalesce(
       (select sum(price * quantity) from public.order_items where order_id = v_order_id), 0
     )
   where id = v_order_id
  returning total into v_total;

  return jsonb_build_object('order_id', v_order_id, 'total', v_total);
end;
$$;

revoke all on function public.create_order(jsonb) from public;
revoke execute on function public.create_order(jsonb) from anon;
grant execute on function public.create_order(jsonb) to authenticated;

-- Único camino de escritura de órdenes: la RPC.
drop policy if exists orders_insert_own on public.orders;
drop policy if exists order_items_insert_own on public.order_items;

revoke insert on public.orders from authenticated;
revoke insert on public.order_items from authenticated;
