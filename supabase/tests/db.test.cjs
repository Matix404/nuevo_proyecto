// Regresión de la base: RLS + RPC create_order.
// Corre sobre Postgres real (PGlite, WASM), no sobre un mock.
//   npm run test:db

const { PGlite } = require('@electric-sql/pglite')
const fs = require('node:fs')
const path = require('node:path')

const MIGRATIONS = path.join(__dirname, '..', 'migrations')
const ADMIN = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const C1 = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const C2 = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const P1 = '11111111-1111-1111-1111-111111111111'
const P2 = '22222222-2222-2222-2222-222222222222'

const out = []
let failures = 0
const ok = (m) => out.push(`ok   ${m}`)
const bad = (m) => {
  failures++
  out.push(`FAIL ${m}`)
}

const db = new PGlite()

async function boot() {
  // Lo que Supabase ya provee: roles, auth.users, auth.uid() y los grants por
  // defecto (que es justo la trampa: ALL/EXECUTE para anon y authenticated).
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
  `)

  for (const f of fs.readdirSync(MIGRATIONS).filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'))
    ok(`applied ${f}`)
  }

  await db.exec(`
    insert into auth.users (id) values ('${ADMIN}'), ('${C1}'), ('${C2}');
    insert into public.profiles (id, full_name, role) values
      ('${ADMIN}', 'Admin', 'admin'),
      ('${C1}', 'Cliente Uno', 'cliente'),
      ('${C2}', 'Cliente Dos', 'cliente');
    insert into public.products (id, name, price, category, created_by) values
      ('${P1}', 'Producto base', 10.00, 'Otros', '${ADMIN}'),
      ('${P2}', 'Producto caro', 250.50, 'Ropa', '${ADMIN}');
    insert into public.orders (id, user_id, total, status) values
      ('0a000000-0000-0000-0000-000000000001', '${C1}', 10.00, 'pending');
  `)
}

async function q(role, sub, sql, params) {
  await db.exec('reset role')
  if (role !== 'postgres') await db.exec(`set role ${role}`)
  if (sub) await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub])
  return db.query(sql, params)
}

async function expectOk(label, fn) {
  try {
    const r = await fn()
    ok(`${label} → ${JSON.stringify(r.rows ?? r.affectedRows ?? r)}`)
    return r
  } catch (e) {
    bad(`${label} → error inesperado: ${e.message.split('\n')[0].slice(0, 110)}`)
    return null
  }
}

async function expectDenied(label, fn) {
  try {
    const r = await fn()
    const n = r.rows ? r.rows.length : (r.affectedRows ?? 0)
    if (n === 0) ok(`${label} → negado por silencio (0 filas)`)
    else bad(`${label} → PERMITIDO, se esperaba negación (${JSON.stringify(r.rows ?? r).slice(0, 90)})`)
  } catch (e) {
    ok(`${label} → rechazado: ${e.message.split('\n')[0].slice(0, 70)}`)
  }
}

async function expectThrows(label, fn) {
  try {
    await fn()
    bad(`${label} → PERMITIDO, se esperaba rechazo`)
  } catch (e) {
    ok(`${label} → rechazado: ${e.message.split('\n')[0].slice(0, 80)}`)
  }
}

;(async () => {
  await boot()

  // ---------------- RLS ----------------
  await expectDenied('anon select products', () => q('anon', null, 'select * from public.products'))
  await expectDenied('anon execute is_admin', () => q('anon', null, 'select public.is_admin()'))

  await expectOk('cliente select products', () => q('authenticated', C1, 'select name from public.products'))
  await expectDenied('cliente insert product', () =>
    q('authenticated', C1, `insert into public.products (name, price) values ('hack', 1)`),
  )
  await expectDenied('cliente read other profile', () =>
    q('authenticated', C1, `select * from public.profiles where id = '${C2}'`),
  )
  await expectDenied('cliente self-promote', () =>
    q('authenticated', C1, `update public.profiles set role = 'admin' where id = '${C1}'`),
  )
  await expectDenied('cliente insert order directly (bypass RPC)', () =>
    q(
      'authenticated',
      C1,
      `insert into public.orders (user_id, total, status) values ('${C1}', 0.01, 'pending') returning id`,
    ),
  )
  await expectDenied('cliente insert order_item directly (bypass RPC)', () =>
    q(
      'authenticated',
      C1,
      `insert into public.order_items (order_id, product_id, quantity, price)
       values ('0a000000-0000-0000-0000-000000000001', '${P1}', 1, 0.01) returning id`,
    ),
  )
  await expectThrows('cliente cannot truncate reviews', () => q('authenticated', C1, 'truncate public.reviews'))

  // ---------------- RPC create_order ----------------
  const rpc = (sub, items, role = 'authenticated') =>
    q(role, sub, 'select public.create_order($1::jsonb) as r', [JSON.stringify(items)])

  const created = await expectOk('cliente crea orden por RPC', () =>
    rpc(C1, [
      { product_id: P1, quantity: 2 },
      { product_id: P2, quantity: 1 },
    ]),
  )
  const orderId = created?.rows?.[0]?.r?.order_id
  const total = created?.rows?.[0]?.r?.total

  if (orderId && Number(total) === 2 * 10 + 250.5) ok(`total calculado en el servidor: ${total}`)
  else bad(`total inesperado: ${JSON.stringify(created?.rows)} (esperaba 270.5)`)

  await expectOk('items guardados con precio de products', () =>
    q(
      'postgres',
      null,
      `select product_id, quantity, price from public.order_items where order_id = '${orderId}' order by product_id`,
    ),
  )

  await expectOk('duplicados del carrito se agregan', () =>
    rpc(C2, [
      { product_id: P1, quantity: 1 },
      { product_id: P1, quantity: 2 },
    ]),
  )
  await expectOk('una sola fila por producto', () =>
    q(
      'postgres',
      null,
      `select count(*)::int as n from public.order_items oi
       join public.orders o on o.id = oi.order_id
       where o.user_id = '${C2}' and oi.product_id = '${P1}'`,
    ),
  )

  const before = await q('postgres', null, 'select count(*)::int as n from public.orders')
  await expectThrows('producto inexistente rechazado', () =>
    rpc(C1, [{ product_id: '99999999-9999-9999-9999-999999999999', quantity: 1 }]),
  )
  await expectThrows('cantidad 0 rechazada', () => rpc(C1, [{ product_id: P1, quantity: 0 }]))
  await expectThrows('cantidad negativa rechazada', () => rpc(C1, [{ product_id: P1, quantity: -5 }]))
  await expectThrows('carrito vacío rechazado', () => rpc(C1, []))
  await expectThrows('payload inválido rechazado', () => rpc(C1, [{ quantity: 1 }]))

  const after = await q('postgres', null, 'select count(*)::int as n from public.orders')
  if (before.rows[0].n === after.rows[0].n) ok('fallos no dejan órdenes huérfanas (rollback)')
  else bad(`rollback incompleto: ${before.rows[0].n} → ${after.rows[0].n}`)

  await expectDenied('anon no puede ejecutar create_order', () =>
    q('anon', null, `select public.create_order('[{"product_id":"${P1}","quantity":1}]'::jsonb)`),
  )
  await expectDenied('anon no puede leer las órdenes creadas', () => q('anon', null, 'select * from public.orders'))

  await expectOk('cliente ve su propia orden', () =>
    q('authenticated', C1, `select total from public.orders where id = '${orderId}'`),
  )
  await expectDenied('cliente no ve la orden de otro', () =>
    q('authenticated', C2, `select * from public.orders where id = '${orderId}'`),
  )

  // ---------------- Grants ----------------
  const grants = await q(
    'postgres',
    null,
    `select table_name, string_agg(privilege_type, ',' order by privilege_type) as p
     from information_schema.role_table_grants
     where grantee = 'authenticated' and table_schema = 'public'
     group by table_name order by table_name`,
  )
  ok(`grants[authenticated]: ${grants.rows.map((r) => `${r.table_name}=${r.p}`).join(' | ')}`)
  if (grants.rows.every((r) => !/TRUNCATE|REFERENCES|TRIGGER/.test(r.p))) ok('sin TRUNCATE/REFERENCES/TRIGGER')
  else bad('grants de más en authenticated')

  const anonExec = await q('postgres', null, `select has_function_privilege('anon', 'public.create_order(jsonb)', 'EXECUTE') as can`)
  if (anonExec.rows[0].can === false) ok('anon no puede ejecutar create_order (privilegio)')
  else bad('anon conserva EXECUTE en create_order')

  console.log(out.join('\n'))
  console.log(`\n${failures === 0 ? 'ALL PROBES PASSED' : failures + ' FAILURES'}`)
  process.exit(failures === 0 ? 0 : 1)
})().catch((e) => {
  console.log(out.join('\n'))
  console.error('HARNESS ERROR:', e.message)
  process.exit(2)
})
