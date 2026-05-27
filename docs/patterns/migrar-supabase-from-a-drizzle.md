# Patrón: Migrar `supabase.from()` → Drizzle

> **Por qué**: `supabase.from('tabla').select(...)` usa PostgREST de Supabase, una API propietaria. Cualquier migración a RDS / Neon / Aurora rompe estos sitios. Drizzle habla Postgres estándar vía `DATABASE_URL` y es 100% portable.
>
> **Cuándo aplicar este patrón**: cada vez que un PR toque un archivo que use `supabase.from()`, **aprovechar** para migrar ese archivo (strangler fig). No hacer refactor masivo en un solo PR.
>
> **Roadmap**: [docs/roadmap/agnosticismo-supabase.md](../roadmap/agnosticismo-supabase.md) — Fase 3.

---

## Cheatsheet rápido

| `supabase.from()` | Equivalente Drizzle |
|---|---|
| `supabase.from('users').select('id, name')` | `db.select({ id: users.id, name: users.name }).from(users)` |
| `.eq('id', userId)` | `.where(eq(users.id, userId))` |
| `.in('status', ['active', 'trial'])` | `.where(inArray(users.status, ['active', 'trial']))` |
| `.gt('created_at', date)` | `.where(gt(users.createdAt, date))` |
| `.order('created_at', { ascending: false })` | `.orderBy(desc(users.createdAt))` |
| `.limit(10)` | `.limit(10)` |
| `.single()` | destructure: `const [row] = await ...` |
| `.maybeSingle()` | destructure + check undefined: `const [row] = ...; if (!row) return null` |
| `.insert({ ... })` | `db.insert(users).values({ ... })` |
| `.upsert({ ... }, { onConflict: 'user_id' })` | `db.insert(users).values({...}).onConflictDoUpdate({ target: users.userId, set: {...} })` |
| `.update({ ... }).eq('id', x)` | `db.update(users).set({...}).where(eq(users.id, x))` |
| `.delete().eq('id', x)` | `db.delete(users).where(eq(users.id, x))` |
| Join (no soportado en Supabase REST sin RPC) | `.leftJoin(other, eq(users.id, other.userId))` |
| `.rpc('fn_name', { p_x: 1 })` | `db.execute(sql`SELECT fn_name(${1})`)` |

## Setup

### 1. Importar Drizzle

```ts
// Server-side normal:
import { getDb } from '@/db/client'
const db = getDb()

// Admin (bypass RLS, equivalente a service_role):
import { getAdminDb } from '@/db/client'
const db = getAdminDb()

// Operadores comunes:
import { eq, and, or, gt, gte, lt, lte, inArray, desc, asc, sql } from 'drizzle-orm'

// Schema tipado:
import { users, userSubscriptions } from '@/db/schema'
```

### 2. Estructura típica de un archivo migrado

```ts
// ANTES (supabase.from)
const supabase = createClient(URL, SERVICE_ROLE_KEY)
const { data, error } = await supabase
  .from('user_profiles')
  .select('id, email, plan_type')
  .eq('id', userId)
  .single()
if (error) throw error
return data

// DESPUÉS (Drizzle)
import { getAdminDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

const db = getAdminDb()
const [profile] = await db
  .select({
    id: userProfiles.id,
    email: userProfiles.email,
    planType: userProfiles.planType,
  })
  .from(userProfiles)
  .where(eq(userProfiles.id, userId))
  .limit(1)
return profile ?? null
```

## Casos comunes

### SELECT con join

```ts
// ANTES
await supabase.from('user_subscriptions')
  .select('*, user_profiles(email)')
  .eq('status', 'active')

// DESPUÉS
await db
  .select({
    subId: userSubscriptions.id,
    status: userSubscriptions.status,
    email: userProfiles.email,
  })
  .from(userSubscriptions)
  .leftJoin(userProfiles, eq(userProfiles.id, userSubscriptions.userId))
  .where(eq(userSubscriptions.status, 'active'))
```

### INSERT con onConflict (upsert)

```ts
// ANTES
await supabase.from('user_subscriptions').upsert({
  user_id: userId,
  status: 'active',
}, { onConflict: 'user_id', ignoreDuplicates: false })

// DESPUÉS
await db
  .insert(userSubscriptions)
  .values({ userId, status: 'active' })
  .onConflictDoUpdate({
    target: userSubscriptions.userId,
    set: { status: 'active' },
  })
```

### Llamada a función SQL custom (RPC)

```ts
// ANTES
const { data } = await supabase.rpc('increment_daily_questions', {
  p_user_id: userId,
  p_limit: 25,
})

// DESPUÉS
const result = await db.execute(sql`
  SELECT * FROM increment_daily_questions(${userId}, ${25})
`)
const rows = (result as { rows?: any[] }).rows ?? result
```

### Count rápido

```ts
// ANTES
const { count } = await supabase.from('tests')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)

// DESPUÉS
const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(tests)
  .where(eq(tests.userId, userId))
```

## Trampas comunes

### 1. `single()` lanza si no hay fila

```ts
// supabase.single() devuelve error si 0 filas
// Drizzle no — destructure manualmente:
const [row] = await db.select().from(users).where(eq(users.id, x)).limit(1)
if (!row) return null  // ← explícito
```

### 2. Drizzle types vs Supabase types

Supabase usa nombres snake_case en el JSON. Drizzle usa camelCase en TS y snake_case en SQL automáticamente.

```ts
// Supabase: data.user_id, data.created_at
// Drizzle:  row.userId, row.createdAt
```

### 3. Transacciones

```ts
// supabase no tiene transacciones nativas (hay que usar RPC)
// Drizzle sí:
await db.transaction(async (tx) => {
  await tx.insert(tableA).values({...})
  await tx.update(tableB).set({...}).where(...)
})
```

### 4. RLS

`getDb()` (PgBouncer pooler con `authenticated`) respeta RLS.
`getAdminDb()` (service-role equivalente) bypasea RLS — usar solo en endpoints API con auth admin verificada.

## Tests

Si el archivo migrado tiene unit tests con mocks de `supabase.from`, hay que migrarlos a mocks de Drizzle (más simple porque retornan promesas directas).

```ts
// Mock típico Drizzle
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue([{ id: 'u1', email: 'test@x.com' }]),
}
jest.mock('@/db/client', () => ({ getDb: () => mockDb, getAdminDb: () => mockDb }))
```

## Inventario de migración (~10 archivos restantes a 27/05/2026)

Ver lista actualizada en [docs/roadmap/agnosticismo-supabase.md](../roadmap/agnosticismo-supabase.md) §Fase 3.

Tachar archivo del inventario en cada PR que migre uno.

## Validación post-migración

1. Tests existentes pasan (o se actualizan los mocks).
2. `tsc --noEmit` limpio.
3. ESLint sin warnings nuevos.
4. (Opcional) Probar en local con `DATABASE_URL=postgres://localhost/...` apuntando a un Postgres no-Supabase — si funciona, el archivo es portable.
