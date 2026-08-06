#!/usr/bin/env npx tsx
/**
 * Script para detectar drift entre db/schema.ts y la BD real
 *
 * Uso:
 *   DATABASE_URL="..." npx tsx scripts/check-schema-drift.ts
 *   # o con npm script:
 *   npm run db:check
 *
 * Detecta:
 * - Tablas en BD que faltan en schema (necesitan añadirse)
 * - Tablas en schema que no existen en BD (eliminadas?)
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import postgres from 'postgres'
import * as schema from '../db/schema'
import { getTableName, getTableColumns, is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no configurada')
  console.error('   Usa: DATABASE_URL="..." npx tsx scripts/check-schema-drift.ts')
  process.exit(1)
}

// Tablas a ignorar (backups, temporales, schema auth, etc.)
// Tablas que existen en RDS y NO deben estar en `db/schema.ts`. Cada una con su motivo: una
// entrada sin explicación es indistinguible de un olvido, y este comando solo sirve si puede
// quedar VERDE (un detector siempre en rojo es un detector apagado — lección T-047).
//
// Criterio aplicado el 27/07/2026 (T-183) para decidir qué se ignora y qué se declara: **el uso
// real en código**, no el nombre. Las 50 que alguien consulta se añadieron al schema; estas 15 no
// tienen un solo uso en `lib/`, `app/`, `backend/src/`, `scripts/` ni `db/`.
const IGNORE_TABLES = [
  'user_streaks_backup_20241208',  // Backup temporal
  'trigger_logs',                   // Logs internos de triggers
  'users',                          // Tabla de auth schema (no public)

  // — Copias PREVIAS a la migración de outbox (2026). Congeladas: se conservan para poder
  //   comparar contra el estado anterior si un contador materializado se descuadra. Nadie las lee.
  'law_question_first_attempts_pre_outbox',
  'question_first_attempts_pre_outbox',
  'user_daily_stats_pre_outbox',
  'user_difficulty_stats_pre_outbox',
  'user_hourly_stats_pre_outbox',
  'user_question_history_v2_pre_outbox',
  'user_stats_summary_pre_outbox',
  'backfill_materialized_stats_progress',  // Progreso del backfill que creó esas copias

  // — Cohortes de campañas PUNTUALES ya cerradas (drenaje de mislinks, relink LECrim/CP).
  //   Son el registro de qué se tocó y por qué; no las consulta ningún código vivo.
  'mislink_review_cohort',
  'relink_lecrim_cp_cohort',

  // — Históricos de features que no llegaron a cablearse o quedaron sustituidas.
  'convocatoria_verification_history',
  'convocatorias_history',
  'law_source_verification',
  'law_source_verification_history',
  'instagram_posts',               // Publicación en IG: la cuenta está caída por sanción
]

async function main() {
  console.log('🔍 Verificando drift entre schema y BD...\n')

  // Extraer nombres de tablas del schema de Drizzle (solo schema public)
  const schemaTableNames = new Set<string>()
  // …y sus COLUMNAS, leídas del propio objeto Drizzle (`getTableColumns`), no del texto del
  // fichero: una regex sobre `db/schema.ts` se traga las claves entrecomilladas (`"año":`) y
  // produce falsos positivos. Esto es la definición efectiva, la misma que usan las queries.
  const schemaColumns = new Map<string, Set<string>>()
  for (const [key, value] of Object.entries(schema)) {
    if (is(value, PgTable)) {
      const tableName = getTableName(value)
      // Ignorar tablas del schema auth (como 'users')
      if (!IGNORE_TABLES.includes(tableName)) {
        schemaTableNames.add(tableName)
        schemaColumns.set(
          tableName,
          new Set(Object.values(getTableColumns(value)).map((c) => c.name)),
        )
      }
    }
  }

  // ssl:'require' explícito (T-568, 05/08/2026, redescubierto y reaplicado en T-518): la
  // DATABASE_URL de un trabajador de la flota no lleva `?sslmode=require` en la cadena (se la
  // pasa el lanzador, no un `.env.local`), y sin la opción `ssl` postgres-js intenta conectar
  // en claro → RDS lo rechaza (`no pg_hba.conf entry ... no encryption`). Mismo patrón que ya
  // usa `scripts/audit-temario-display-drift.cjs`.
  const sql = postgres(DATABASE_URL!, { max: 1, ssl: 'require' })

  try {
    // Obtener tablas de la BD (solo schema public)
    const dbTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `

    const dbTableNames = new Set(dbTables.map(t => t.table_name as string))

    // Tablas en BD pero no en schema (excluyendo ignoradas)
    const missingInSchema: string[] = []
    for (const table of dbTableNames) {
      if (!schemaTableNames.has(table) && !IGNORE_TABLES.includes(table)) {
        missingInSchema.push(table)
      }
    }

    // Tablas en schema pero no en BD
    const missingInDb: string[] = []
    for (const table of schemaTableNames) {
      if (!dbTableNames.has(table)) {
        missingInDb.push(table)
      }
    }

    // Resultados
    console.log(`📊 Tablas en BD: ${dbTableNames.size}`)
    console.log(`📊 Tablas en schema: ${schemaTableNames.size}`)
    console.log(`📊 Tablas ignoradas: ${IGNORE_TABLES.length}`)
    console.log('')

    let hasErrors = false

    if (missingInSchema.length > 0) {
      console.log('⚠️  Tablas en BD que FALTAN en schema:')
      missingInSchema.forEach(t => console.log(`   - ${t}`))
      console.log('')
      console.log('   Acción: Ejecutar "npx drizzle-kit introspect" y copiar las tablas faltantes')
      console.log('')
      hasErrors = true
    }

    if (missingInDb.length > 0) {
      console.log('❌ Tablas en schema que NO EXISTEN en BD:')
      missingInDb.forEach(t => console.log(`   - ${t}`))
      console.log('')
      console.log('   Acción: Eliminar del schema o crear en BD si son nuevas')
      console.log('')
      hasErrors = true
    }

    // ── Drift de COLUMNAS (añadido 27/07/2026) ────────────────────────────────
    // Hasta hoy esto solo comparaba TABLAS, y por ese hueco se acumularon **53 columnas** que
    // existían en RDS y no en `db/schema.ts` (15 tablas; `oposiciones` sola tenía 15, entre ellas
    // todo el bloque `seguimiento_*`). Coste real: lo que no está en el schema **no se puede
    // consultar con Drizzle** —se acaba escribiendo SQL crudo— y, peor, es **invisible para los
    // guardarraíles que leen el schema**: `__tests__/guardrails/timestampTimezone.guardrail.test.ts`
    // cuenta los `timestamp` sin zona sobre `db/schema.ts`, así que una columna ausente nunca
    // aparecería en su lista por naive que fuese. Se descubrió al migrar `user_feedback` (T-167):
    // su `claimed_at` estaba en RDS y no en el schema.
    // Columnas que NO se pueden representar en Drizzle y por eso no cuentan como drift.
    // `tsvector` es el caso: `drizzle-kit introspect` las emite como `unknown("…")`, un tipo que
    // ni siquiera importa — el fichero que genera no compila. Son columnas de índice de búsqueda
    // full-text, mantenidas por triggers, que la app nunca selecciona por Drizzle. Si algún día
    // drizzle-kit las soporte, quítalas de aquí.
    const COLUMNAS_NO_REPRESENTABLES = new Set([
      'articles.content_tsv',
      'articles.teoria_content_tsv',
      'convocatoria_documentos.tsv',
    ])
    const columnasFaltantes: string[] = []
    if (dbTableNames.size > 0) {
      const dbCols = await sql<{ table_name: string; column_name: string }[]>`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, column_name
      `
      const porTabla = new Map<string, Set<string>>()
      for (const r of dbCols) {
        if (!porTabla.has(r.table_name)) porTabla.set(r.table_name, new Set())
        porTabla.get(r.table_name)!.add(r.column_name)
      }
      for (const [tabla, cols] of schemaColumns) {
        const enBd = porTabla.get(tabla)
        if (!enBd) continue // tabla ausente: ya se reporta arriba
        for (const c of enBd) {
          if (cols.has(c)) continue
          if (COLUMNAS_NO_REPRESENTABLES.has(`${tabla}.${c}`)) continue
          columnasFaltantes.push(`${tabla}.${c}`)
        }
      }
    }

    if (columnasFaltantes.length > 0) {
      console.log('⚠️  Columnas en BD que FALTAN en schema:')
      columnasFaltantes.forEach((c) => console.log(`   - ${c}`))
      console.log('')
      console.log('   Por qué importa: no se pueden consultar con Drizzle Y son invisibles para')
      console.log('   los guardarraíles que leen db/schema.ts (p.ej. el de timestamps sin zona).')
      console.log('   Acción: "npx drizzle-kit introspect" y copiar SOLO las columnas que faltan')
      console.log('   (no pisar el fichero entero: lleva comentarios escritos a mano).')
      console.log('')
      hasErrors = true
    }

    if (!hasErrors) {
      console.log('✅ Schema sincronizado con la BD (sin drift de tablas ni de columnas)')
    }

    await sql.end()

    process.exit(hasErrors ? 1 : 0)

  } catch (error) {
    console.error('❌ Error conectando a la BD:', error)
    await sql.end()
    process.exit(1)
  }
}

main()
