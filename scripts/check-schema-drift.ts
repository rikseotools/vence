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
import { getTableName, is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no configurada')
  console.error('   Usa: DATABASE_URL="..." npx tsx scripts/check-schema-drift.ts')
  process.exit(1)
}

// Tablas a ignorar (backups, temporales, schema auth, etc.)
const IGNORE_TABLES = [
  'user_streaks_backup_20241208',  // Backup temporal
  'trigger_logs',                   // Logs internos de triggers
  'users',                          // Tabla de auth schema (no public)
]

async function main() {
  console.log('🔍 Verificando drift entre schema y BD...\n')

  // Extraer nombres de tablas del schema de Drizzle (solo schema public)
  const schemaTableNames = new Set<string>()
  for (const [key, value] of Object.entries(schema)) {
    if (is(value, PgTable)) {
      const tableName = getTableName(value)
      // Ignorar tablas del schema auth (como 'users')
      if (!IGNORE_TABLES.includes(tableName)) {
        schemaTableNames.add(tableName)
      }
    }
  }

  const sql = postgres(DATABASE_URL!, { max: 1 })

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

    if (!hasErrors) {
      console.log('✅ Schema sincronizado con la BD (sin drift)')
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
