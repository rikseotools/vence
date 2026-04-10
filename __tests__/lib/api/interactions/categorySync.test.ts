// __tests__/lib/api/interactions/categorySync.test.ts
//
// Test de regresión: las categorías permitidas en el Zod schema deben
// coincidir con las del CHECK constraint en Postgres (reflejadas en
// db/schema.ts). Si este test falla, significa que alguien añadió una
// categoría al Zod sin migrar la BD (o viceversa) — bug del 10/04/2026
// con la categoría 'video' del YouTubePlayer.
//
// Cómo funciona:
//  1. Lee `eventCategories` del Zod (fuente de verdad del código).
//  2. Lee el texto de db/schema.ts (que refleja el estado del Postgres
//     tras `drizzle-kit introspect`).
//  3. Extrae las categorías del CHECK constraint por regex.
//  4. Compara ambos conjuntos.
//
// No requiere conexión a BD, no tira la suite en CI. Es un test estático.

import * as fs from 'fs'
import * as path from 'path'
import { eventCategories } from '@/lib/api/interactions/schemas'

const ROOT = path.resolve(__dirname, '../../../..')
const SCHEMA_PATH = path.join(ROOT, 'db/schema.ts')
const MIGRATION_PATH = path.join(ROOT, 'database/migrations/add_video_to_user_interactions_category.sql')

describe('user_interactions category — sincronización Zod ↔ Drizzle ↔ SQL', () => {
  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8')

  it('Zod eventCategories NO está vacío', () => {
    expect(eventCategories.length).toBeGreaterThan(0)
  })

  it('Drizzle check constraint existe en db/schema.ts', () => {
    expect(schemaContent).toContain('user_interactions_category_check')
    expect(schemaContent).toMatch(/event_category\s*=\s*ANY\s*\(\s*ARRAY\[/)
  })

  it('Zod y Drizzle tienen exactamente las mismas categorías', () => {
    // Extraer las categorías del check constraint de db/schema.ts
    // Patrón: check("user_interactions_category_check", sql`event_category = ANY (ARRAY['test'::text, 'chat'::text, ...])`),
    const match = schemaContent.match(
      /check\("user_interactions_category_check",\s*sql`event_category\s*=\s*ANY\s*\(\s*ARRAY\[([^\]]+)\]/
    )
    expect(match).not.toBeNull()

    const arrayContent = match![1]
    // Extraer literales: 'xxxx'::text
    const drizzleCats = Array.from(arrayContent.matchAll(/'([^']+)'::text/g)).map(m => m[1])
    expect(drizzleCats.length).toBeGreaterThan(0)

    const zodSet = new Set(eventCategories)
    const drizzleSet = new Set(drizzleCats)

    const onlyInZod = [...zodSet].filter(c => !drizzleSet.has(c))
    const onlyInDrizzle = [...drizzleSet].filter(c => !zodSet.has(c))

    if (onlyInZod.length > 0 || onlyInDrizzle.length > 0) {
      throw new Error(
        `Zod y Drizzle desincronizados para user_interactions_category_check.\n` +
          `  Solo en Zod (lib/api/interactions/schemas.ts): [${onlyInZod.join(', ')}]\n` +
          `  Solo en Drizzle (db/schema.ts): [${onlyInDrizzle.join(', ')}]\n\n` +
          `Si añadiste una nueva category al Zod, crea una migración SQL y actualiza db/schema.ts.`
      )
    }

    expect([...drizzleSet].sort()).toEqual([...zodSet].sort())
  })

  it("'video' está en la lista permitida (bug del 10/04/2026)", () => {
    // Regresión específica: el YouTubePlayer envía 'video' como eventCategory
    // y durante unos días estuvo rechazado por el constraint SQL.
    expect(eventCategories).toContain('video')
    expect(schemaContent).toMatch(/'video'::text/)
  })

  it('la migración add_video_to_user_interactions_category.sql existe', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true)
    const migration = fs.readFileSync(MIGRATION_PATH, 'utf-8')
    expect(migration).toContain('user_interactions_category_check')
    expect(migration).toMatch(/'video'/)
  })
})
