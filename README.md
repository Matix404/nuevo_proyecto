# App con Auth, Roles, Productos, Compras y Reseñas

Proyecto creado con **Vite + React + TypeScript + Supabase** siguiendo metodología **ODD**.

## Tecnologías
- [Vite](https://vitejs.dev/) - Build tool
- [React](https://react.dev/) - UI Library
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Supabase](https://supabase.com/) - Auth + Database + RLS
- [React Router DOM](https://reactrouter.com/) - Routing

## Funcionalidades
- ✅ Autenticación con email y contraseña
- ✅ Registro con nombre completo
- ✅ Sistema de roles (admin / cliente)
- ✅ Perfil de usuario
- ✅ Panel admin para crear/editar/eliminar productos
- ✅ Tienda para clientes con carrito de compras
- ✅ Sistema de compras (órdenes)
- ✅ Reseñas por producto (1 reseña por usuario por producto)
- ✅ Rutas protegidas por autenticación y rol

## Usuarios de prueba
Crealos desde Supabase (Authentication → Users) y después asignales el rol en `profiles`:

- Un usuario con `role = 'admin'` para gestionar productos.
- Un usuario con `role = 'cliente'` para comprar y dejar reseñas.

Las credenciales no se versionan en el repositorio.

## Instalación y ejecución

### 1. Instalar dependencias
```bash
cd frontend
npm install
```

### 2. Configurar variables de entorno
Ya tienes el archivo `.env` configurado con las keys de Supabase. Si necesitas crear uno nuevo:
```bash
cp .env.example .env
# Edita .env con tus credenciales de Supabase
```

### 3. Ejecutar en desarrollo
```bash
npm run dev
```

La app estará en `http://localhost:5173`

### Atajos desde la raíz

El `package.json` de la raíz no tiene dependencias propias: solo delega al frontend.

```bash
npm run setup    # instala dependencias de frontend/
npm run dev
npm run build
npm run lint
```

Los flags extra (`npm run dev -- --port 5174`) no atraviesan las dos capas de npm; en ese caso corré el script desde `frontend/`.

## Estructura del proyecto
```
frontend/src/
├── components/     # Componentes reutilizables (Navbar, ProtectedRoute)
├── contexts/       # Context API (AuthContext)
├── lib/            # Configuración (supabase.ts)
├── pages/          # Páginas (Login, Register, Home, Profile, etc.)
├── routes/         # Configuración de rutas
└── types/          # Tipos TypeScript
```

## Base de datos Supabase
El esquema está versionado en `supabase/migrations/`:

| Archivo | Contenido |
|---|---|
| `0001_core_schema.sql` | Tablas `profiles`, `products`, `orders`, `order_items`, `reviews` + constraints e índices |
| `0002_products_category.sql` | Columna `products.category` + índice |
| `0003_rls_policies.sql` | Policies por rol + `is_admin()` + grants |
| `0004_create_order_rpc.sql` | RPC `create_order(items jsonb)`: precio y total calculados en el servidor |

Para aplicar (no hay Supabase CLI linkeado): copiá cada archivo en orden en **Supabase → SQL Editor** y ejecutalo.

RLS está habilitado en las 5 tablas y `0003` cubre lo que la app hace hoy:

- **`anon`**: sin acceso a ninguna tabla (toda la app está detrás de login).
- **cliente**: lee el catálogo completo, crea solo sus órdenes (siempre `pending`), agrega items solo a órdenes propias, deja una reseña por producto y no puede reescribirla.
- **admin**: todo lo anterior + crear/editar/eliminar productos, vía `public.is_admin()`.
- **`profiles`**: cada uno lee solo el suyo. Nadie puede escribir la tabla desde la app, así que nadie puede auto-asignarse `admin`; los roles se asignan desde el dashboard.

La compra pasa por una sola función: `supabase.rpc('create_order', { items })`. El cliente manda **solo** `product_id` y `quantity`; los precios se leen de `products` y el total se calcula en el servidor, todo en una transacción. El insert directo de `orders`/`order_items` está revocado para `authenticated`, así que la RPC no es opcional.

### Tests de base de datos

```bash
npm run test:db
```

Corre las migraciones sobre Postgres real (PGlite, WASM) y verifica RLS, grants, atomicidad de la compra y que el cliente no pueda inyectar precios.

`0001_core_schema.sql` es un baseline de instalación limpia derivado del uso que hace el código, no un dump de producción. Reconciliá con tu base real antes de aplicarlo sobre datos existentes.

## Seguimiento ODD
Ver `odd/tasks/app-auth-supabase.md` para el seguimiento completo del feature.
