// Regresión de la base: RLS + RPC create_order.
// Corre sobre Postgres real (PGlite, WASM), no sobre un mock.
//   npm install      (en la raíz, necesita @electric-sql/pglite)
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
const MISSING = '99999999-9999-9999-9999-999999999999'

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
  // defecto (la trampa: ALL/EXECUTE para anon y authenticated).
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
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub ?? ''])
  return db.query(sql, params)
}

const pg = (sql, params) => q('postgres', null, sql, params)
const rpc = (sub, items, role = 'authenticated') =>
  q(role, sub, 'select public.create_order($1::jsonb) as r', [JSON.stringify(items)])

async function expectOk(label, fn, check) {
  try {
    const r = await fn()
    const problem = check ? check(r) : null
    if (problem) bad(`${label} → ${problem} (${JSON.stringify(r.rows ?? r.affectedRows ?? r).slice(0, 120)})`)
    else ok(`${label} → ${JSON.stringify(r.rows ?? r.affectedRows ?? r).slice(0, 120)}`)
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
    if (/permission denied|row-level security|must be owner|violates|duplicate key/i.test(e.message)) {
      ok(`${label} → rechazado: ${e.message.split('\n')[0].slice(0, 70)}`)
    } else {
      bad(`${label} → rechazado por el motivo equivocado: ${e.message.split('\n')[0].slice(0, 90)}`)
    }
  }
}

async function expectCode(label, fn, code) {
  try {
    await fn()
    bad(`${label} → PERMITIDO, se esperaba ${code}`)
  } catch (e) {
    if (e.code === code) ok(`${label} → ${e.code}: ${e.message.split('\n')[0].slice(0, 60)}`)
    else bad(`${label} → código ${e.code ?? '(sin code)'}, esperaba ${code}`)
  }
}

const snapshot = async () =>
  (await pg('select (select count(*) from public.orders)::int as o, (select count(*) from public.order_items)::int as i')).rows[0]

;(async () => {
  await boot()

  // ---------------- RLS ----------------
  await expectDenied('anon select products', () => q('anon', null, 'select * from public.products'))
  await expectDenied('anon execute is_admin', () => q('anon', null, 'select public.is_admin()'))

  await expectOk('cliente select products', () => q('authenticated', C1, 'select name from public.products'), (r) =>
    r.rows.length === 2 ? null : `esperaba 2 productos`,
  )
  await expectDenied('cliente insert product', () =>
    q('authenticated', C1, `insert into public.products (name, price) values ('hack', 1) returning id`),
  )
  await expectDenied('cliente read other profile', () =>
    q('authenticated', C1, `select * from public.profiles where id = '${C2}'`),
  )
  await expectDenied('cliente self-promote', () =>
    q('authenticated', C1, `update public.profiles set role = 'admin' where id = '${C1}'`),
  )
  await expectDenied('cliente insert order directly (bypass RPC)', () =>
    q('authenticated', C1, `insert into public.orders (user_id, total, status) values ('${C1}', 0.01, 'pending') returning id`),
  )
  await expectDenied('cliente insert order_item directly (bypass RPC)', () =>
    q(
      'authenticated',
      C1,
      `insert into public.order_items (order_id, product_id, quantity, price)
       values ('0a000000-0000-0000-0000-000000000001', '${P1}', 1, 0.01) returning id`,
    ),
  )
  await expectDenied('cliente cannot truncate reviews', () => q('authenticated', C1, 'truncate public.reviews'))

  // ---------------- RPC: camino feliz ----------------
  const created = await expectOk(
    'cliente crea orden por RPC',
    () => rpc(C1, [{ product_id: P1, quantity: 2 }, { product_id: P2, quantity: 1 }]),
    (r) => (Number(r.rows[0].r.total) === 270.5 ? null : `total ${r.rows[0].r.total}, esperaba 270.5`),
  )
  const orderId = created?.rows?.[0]?.r?.order_id

  await expectOk(
    'items guardados con precio de products',
    () =>
      pg(
        `select product_id, quantity, price from public.order_items
         where order_id = '${orderId}' order by product_id`,
      ),
    (r) => {
      const [a, b] = r.rows
      if (!a || !b) return 'faltan filas'
      if (Number(a.price) !== 10 || Number(b.price) !== 250.5) return 'precio distinto al de products'
      if (a.quantity !== 2 || b.quantity !== 1) return 'cantidades incorrectas'
      return null
    },
  )

  await expectOk(
    'duplicados del carrito se agregan en una fila',
    () =>
      rpc(C2, [
        { product_id: P1, quantity: 1 },
        { product_id: P1, quantity: 2 },
      ]).then(async (r) => {
        const id = r.rows[0].r.order_id
        const rows = await pg(
          `select count(*)::int as n, coalesce(sum(quantity), 0)::int as q from public.order_items where order_id = '${id}'`,
        )
        return { rows: [{ ...r.rows[0].r, ...rows.rows[0] }] }
      }),
    (r) => {
      const row = r.rows[0]
      if (row.n !== 1) return `${row.n} filas, esperaba 1`
      if (row.q !== 3) return `cantidad ${row.q}, esperaba 3`
      if (Number(row.total) !== 30) return `total ${row.total}, esperaba 30`
      return null
    },
  )

  // ---------------- RPC: inyección y validación ----------------
  const injected = await rpc(C1, [
    { product_id: P1, quantity: 2, price: 0.01, total: 0.01, user_id: C2, status: 'paid' },
  ])
  const injectedId = injected?.rows?.[0]?.r?.order_id
  await expectOk(
    'campos inyectados se ignoran (owner, precio, estado)',
    () =>
      pg(
        `select o.user_id, o.total, o.status, oi.price
         from public.orders o join public.order_items oi on oi.order_id = o.id
         where o.id = '${injectedId}'`,
      ),
    (r) => {
      const row = r.rows[0]
      if (!row) return 'no se creó la orden'
      if (row.user_id !== C1) return 'user_id inyectado'
      if (Number(row.total) !== 20) return 'total inyectado'
      if (row.status !== 'pending') return 'status inyectado'
      if (Number(row.price) !== 10) return 'price inyectado'
      return null
    },
  )

  await expectCode('product_id null rechazado', () => rpc(C1, [{ product_id: null, quantity: 1 }]), '22023')
  await expectCode('quantity null rechazada', () => rpc(C1, [{ product_id: P1, quantity: null }]), '22023')
  await expectCode('product_id no-uuid rechazado', () => rpc(C1, [{ product_id: 'abc', quantity: 1 }]), '22023')
  await expectCode('quantity "1.5" rechazada', () => rpc(C1, [{ product_id: P1, quantity: '1.5' }]), '22023')
  await expectCode('quantity " 1" rechazada', () => rpc(C1, [{ product_id: P1, quantity: ' 1' }]), '22023')
  await expectCode('quantity "1" (string) rechazada', () => rpc(C1, [{ product_id: P1, quantity: '1' }]), '22023')
  await expectCode('quantity 0 rechazada', () => rpc(C1, [{ product_id: P1, quantity: 0 }]), '22023')
  await expectCode('quantity negativa rechazada', () => rpc(C1, [{ product_id: P1, quantity: -5 }]), '22023')
  await expectCode('quantity 1001 rechazada', () => rpc(C1, [{ product_id: P1, quantity: 1001 }]), '22023')
  await expectCode('carrito vacío rechazado', () => rpc(C1, []), '22023')
  await expectCode('payload no-array rechazado', () => rpc(C1, { product_id: P1, quantity: 1 }), '22023')
  await expectCode('producto inexistente rechazado', () => rpc(C1, [{ product_id: MISSING, quantity: 1 }]), '23503')

  const before = await snapshot()
  await expectCode(
    'mixto válido + inexistente rechazado',
    () => rpc(C1, [{ product_id: P1, quantity: 1 }, { product_id: MISSING, quantity: 1 }]),
    '23503',
  )
  const after = await snapshot()
  if (before.o === after.o && before.i === after.i)
    ok('rollback atómico: sin órdenes ni items huérfanos')
  else bad(`rollback parcial: ${JSON.stringify(before)} → ${JSON.stringify(after)}`)

  await expectDenied('anon no puede ejecutar create_order', () =>
    rpc(null, [{ product_id: P1, quantity: 1 }], 'anon'),
  )
  await expectDenied('anon no puede leer las órdenes creadas', () => q('anon', null, 'select * from public.orders'))

  await expectOk(
    'cliente ve su propia orden',
    () => q('authenticated', C1, `select total from public.orders where id = '${orderId}'`),
    (r) => (r.rows.length === 1 ? null : 'no ve su orden'),
  )
  await expectDenied('cliente no ve la orden de otro', () =>
    q('authenticated', C2, `select * from public.orders where id = '${orderId}'`),
  )

  // ---------------- Grants y hardening ----------------
  const grants = await pg(
    `select table_name, string_agg(privilege_type, ',' order by privilege_type) as p
     from information_schema.role_table_grants
     where grantee = 'authenticated' and table_schema = 'public'
     group by table_name order by table_name`,
  )
  ok(`grants[authenticated]: ${grants.rows.map((r) => `${r.table_name}=${r.p}`).join(' | ')}`)
  if (grants.rows.every((r) => !/TRUNCATE|REFERENCES|TRIGGER/.test(r.p))) ok('sin TRUNCATE/REFERENCES/TRIGGER')
  else bad('grants de más en authenticated')

  const direct = await pg(
    `select has_table_privilege('authenticated', 'public.orders', 'INSERT') as o,
            has_table_privilege('authenticated', 'public.order_items', 'INSERT') as i`,
  )
  if (direct.rows[0].o === false && direct.rows[0].i === false)
    ok('authenticated sin INSERT directo en orders/order_items')
  else bad(`INSERT directo todavía otorgado: ${JSON.stringify(direct.rows[0])}`)

  const meta = await pg(
    `select prosecdef, array_to_string(proconfig, ',') as cfg, array_to_string(proacl, ',') as acl
     from pg_proc where proname = 'create_order'`,
  )
  const fn = meta.rows[0]
  if (!fn) bad('create_order no existe')
  else if (!fn.prosecdef) bad('create_order no es security definer')
  else if (!/search_path=""|search_path=$/.test(fn.cfg ?? '')) bad(`search_path no fijo: ${fn.cfg}`)
  else if (/(^|,)=X\//.test(fn.acl ?? '')) bad(`EXECUTE para PUBLIC: ${fn.acl}`)
  else ok(`create_order endurecida (${fn.acl})`)

  const anonExec = await pg(`select has_function_privilege('anon', 'public.create_order(jsonb)', 'EXECUTE') as can`)
  if (anonExec.rows[0].can === false) ok('anon no puede ejecutar create_order (privilegio)')
  else bad('anon conserva EXECUTE en create_order')

  // ---------------- Idempotencia / orden de migraciones ----------------
  // Re-aplicar 0003 después de 0004 NO puede reabrir el insert directo.
  for (const f of ['0003_rls_policies.sql', '0004_create_order_rpc.sql', '0003_rls_policies.sql', '0004_create_order_rpc.sql']) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'))
  }
  const reinsertPolicies = await pg(
    `select count(*)::int as n from pg_policies
     where schemaname = 'public' and cmd = 'INSERT' and tablename in ('orders', 'order_items')`,
  )
  if (reinsertPolicies.rows[0].n === 0) ok('re-aplicar 0003/0004 no recrea policies de INSERT')
  else bad(`re-aplicar 0003 recreó ${reinsertPolicies.rows[0].n} policies de INSERT`)

  const reinsertGrant = await pg(
    `select has_table_privilege('authenticated', 'public.orders', 'INSERT') as o,
            has_table_privilege('authenticated', 'public.order_items', 'INSERT') as i`,
  )
  if (reinsertGrant.rows[0].o === false && reinsertGrant.rows[0].i === false)
    ok('re-aplicar 0003/0004 no devuelve el grant de INSERT')
  else bad(`re-aplicar 0003 devolvió INSERT: ${JSON.stringify(reinsertGrant.rows[0])}`)

  await expectDenied('tras re-aplicar, el insert directo sigue cerrado', () =>
    q('authenticated', C1, `insert into public.orders (user_id, total, status) values ('${C1}', 0.01, 'pending') returning id`),
  )

  console.log(out.join('\n'))
  console.log(`\n${failures === 0 ? 'ALL PROBES PASSED' : failures + ' FAILURES'}`)
  process.exit(failures === 0 ? 0 : 1)
})().catch((e) => {
  console.log(out.join('\n'))
  console.error('HARNESS ERROR:', e.message)
  process.exit(2)
})
