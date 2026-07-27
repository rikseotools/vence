// __tests__/integration/schemaColumnDrift.integration.test.ts
//
// TRINQUETE de drift a nivel de COLUMNA entre RDS y `db/schema.ts`.
//
// ## Por qué existe (27/07/2026, cabo de T-167)
//
// `npm run db:check` comparaba **tablas**, no columnas. Por ese hueco se acumularon **53 columnas**
// que existían en RDS y no en el schema, repartidas en 15 tablas — `oposiciones` sola tenía 15,
// entre ellas TODO el bloque `seguimiento_*`. Se descubrió de casualidad al migrar
// `user_feedback` a `timestamptz`: su `claimed_at` estaba en la BD y no en el schema.
//
// El daño no es estético, es doble:
//   1. Lo que no está en el schema **no se puede consultar con Drizzle** → se acaba escribiendo
//      SQL crudo, que ni tipa ni sale en las búsquedas de "quién lee esta columna".
//   2. Es **invisible para los guardarraíles que leen el schema**. El de timestamps sin zona
//      (`__tests__/guardrails/timestampTimezone.guardrail.test.ts`) cuenta las columnas naive
//      sobre `db/schema.ts`: una columna ausente jamás aparecería en su lista, por naive que
//      fuera. El trinquete diría "10 naive" mientras la BD tuviera más.
//
// Se lee del objeto Drizzle (`getTableColumns`), no del texto del fichero: una regex sobre
// `db/schema.ts` se traga las claves entrecomilladas (`"año":`) y da falsos positivos — pasó al
// medir el drift la primera vez.
//
// CI-safe: se salta solo si no hay DATABASE_URL, como el resto de integración.

import dotenv from 'dotenv'
import { Client } from 'pg'
import { getTableName, getTableColumns, is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import * as schema from '../../db/schema'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

// GOTCHA de `pg` + RDS: un `sslmode=require` en la URL gana sobre la opción `ssl` del cliente y
// revienta con "self-signed certificate". Hay que quitarlo (mismo apaño que en los otros
// tests de integración del proyecto).
function urlSinSslMode(url: string): string {
  return url.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, pre, post) => (post === '&' ? pre : ''))
}

// Columnas que Drizzle NO puede representar, así que su ausencia no es deuda.
// `tsvector`: `drizzle-kit introspect` las emite como `unknown("…")`, un tipo que ni siquiera
// importa — el fichero que genera no compila. Son índices de búsqueda full-text mantenidos por
// trigger, que la app nunca selecciona por Drizzle. Debe MENGUAR, no crecer.
const NO_REPRESENTABLES = new Set(['articles.content_tsv', 'articles.teoria_content_tsv'])

// Tablas fuera del schema a propósito (backups, logs internos, schema `auth`). Espejo de
// IGNORE_TABLES en scripts/check-schema-drift.ts.
const TABLAS_IGNORADAS = new Set(['user_streaks_backup_20241208', 'trigger_logs', 'users'])

describeIfDb('drift de COLUMNAS entre RDS y db/schema.ts (trinquete)', () => {
  let client: Client
  let porTabla: Map<string, Set<string>>

  beforeAll(async () => {
    client = new Client({
      connectionString: urlSinSslMode(DB_URL!),
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    const { rows } = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'`,
    )
    porTabla = new Map()
    for (const r of rows) {
      if (!porTabla.has(r.table_name)) porTabla.set(r.table_name, new Set())
      porTabla.get(r.table_name)!.add(r.column_name)
    }
  }, 30000)

  afterAll(async () => {
    await client?.end()
  })

  const tablasDelSchema = () => {
    const out = new Map<string, Set<string>>()
    for (const value of Object.values(schema)) {
      if (!is(value, PgTable)) continue
      const t = getTableName(value)
      if (TABLAS_IGNORADAS.has(t)) continue
      out.set(t, new Set(Object.values(getTableColumns(value)).map((c) => c.name)))
    }
    return out
  }

  it('la extracción funciona (hay tablas y columnas por los dos lados)', () => {
    expect(tablasDelSchema().size).toBeGreaterThan(100)
    expect(porTabla.size).toBeGreaterThan(100)
  })

  it('NINGUNA columna de RDS falta en db/schema.ts', () => {
    const faltan: string[] = []
    for (const [tabla, cols] of tablasDelSchema()) {
      const enBd = porTabla.get(tabla)
      if (!enBd) continue // tabla ausente de la BD: no es asunto de este test
      for (const c of enBd) {
        if (cols.has(c) || NO_REPRESENTABLES.has(`${tabla}.${c}`)) continue
        faltan.push(`${tabla}.${c}`)
      }
    }
    // Si esto falla: `npx drizzle-kit introspect` y copia SOLO las columnas nuevas al schema
    // (no pises el fichero entero, lleva comentarios escritos a mano).
    expect(faltan.sort()).toEqual([])
  })

  it('la lista de no-representables no miente (siguen existiendo y siguen sin estar)', () => {
    const schemaCols = tablasDelSchema()
    for (const ref of NO_REPRESENTABLES) {
      const [tabla, col] = ref.split('.')
      expect(porTabla.get(tabla)?.has(col)).toBe(true) // sigue en RDS
      expect(schemaCols.get(tabla)?.has(col)).toBe(false) // y sigue sin poder declararse
    }
  })
})
