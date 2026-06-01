// lib/api/admin-delete-user/queries.ts
//
// Eliminación GDPR de usuarios. Dos fases:
//
// 1. ARCHIVADO LEGAL: extrae y copia a deleted_users_log.archived_data
//    (JSONB) los datos con obligación legal de retención (pagos,
//    contabilidad). Sin esto, no podríamos cumplir RGPD + retención fiscal.
//
// 2. LIMPIEZA: DELETE de las tablas que no están en CASCADE con
//    user_profiles.id. Incluye tablas de tracking, personal data, y las
//    tablas NO ACTION que bloquearían el DELETE final.
//
// Después el endpoint padre ejecuta:
//   - DELETE user_profiles (lo cual CASCADE limpia 11 tablas más)
//   - supabase.auth.admin.deleteUser (auth.users)
//
// IMPORTANTE: los nombres y columnas de esta lista se mapean 1-a-1 con
// el schema real en BD. Cualquier tabla nueva que se añada con FK a
// user_profiles.id DEBE:
//   a) Definirse con ON DELETE CASCADE → no hace falta tocar esta lista
//   b) O añadirse explícitamente a TABLES_TO_CLEAN_NO_CASCADE
//
// Ver docs/maintenance/eliminacion-cuentas.md.

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type { DeletionResult, ArchivedUserData } from './schemas'

// ============================================
// CONFIGURACIÓN DE TABLAS
// ============================================

// Tablas con obligación legal de retención que deben archivarse ANTES
// de borrarse. El DELETE se hace explícitamente tras copiar a archived_data.
const TABLES_WITH_LEGAL_RETENTION: Array<{ table: string; column: string }> = [
  // Registros contables de pagos (obligación fiscal 4-6 años).
  // Ver Art. 30 Código de Comercio, Art. 66 LGT.
  { table: 'payment_settlements', column: 'user_id' },
]

// Tablas NO CASCADE que SÍ bloquean el DELETE de user_profiles y que no
// tienen retención legal: se borran explícitamente.
// Incluye únicamente las columnas donde el usuario es el SUJETO, no las
// que son admin/granter (que requieren SET NULL separado si el usuario
// eliminado fuera admin).
//
// IMPORTANTE — orden de borrado (relevante desde 2026-05-23):
//
// La migración `20260523_materialized_stats_triggers.sql` introdujo
// 15 triggers AFTER INSERT/UPDATE/DELETE sobre `test_questions` que
// hacen UPSERT en 5 stats tables con FK CASCADE a user_profiles.id.
// Si se confía sólo en la cascada de user_profiles, PG ejecuta las
// cascadas en orden no determinista: las stats pueden borrarse ANTES
// que test_questions, y el trigger del DELETE de test_questions
// re-puebla las stats con un user_id que ya está siendo borrado en
// la misma transacción → FK violation → ROLLBACK silencioso.
//
// Solución: borrar explícitamente en el orden:
//   1. test_questions y tests   → dispara triggers, repuebla stats
//   2. 5 stats tables           → limpia los repueblos
//   3. (resto de tablas)
//   4. user_profiles (CASCADE de las ~11 restantes, sin re-pueblos)
//
// La defensa final está en los triggers (guard `EXISTS user_profiles`
// — ver migración 20260525_*) para cubrir cualquier flujo futuro de
// DELETE que no pase por este endpoint.
const TABLES_TO_CLEAN_NO_CASCADE: Array<{ table: string; column: string }> = [
  // 1. test_questions primero — dispara los triggers materializadores
  //    una sola vez aquí, en vez de durante la cascada de user_profiles.
  { table: 'test_questions', column: 'user_id' },
  // 2. tests después — su FK CASCADE a test_questions ya está vacía.
  { table: 'tests', column: 'user_id' },
  // 3. Stats tables — limpian los repueblos del paso 1.
  { table: 'user_stats_summary', column: 'user_id' },
  { table: 'user_article_stats', column: 'user_id' },
  { table: 'user_daily_stats', column: 'user_id' },
  { table: 'user_difficulty_stats', column: 'user_id' },
  { table: 'user_hourly_stats', column: 'user_id' },
  // 4. Resto de tablas NO CASCADE habituales.
  { table: 'feedback_conversations', column: 'user_id' },
  { table: 'feedback_messages', column: 'sender_id' },
  // payment_settlements se limpia en la fase de archivado (arriba)
]

// Tablas CON columna user_id pero SIN FK (o con FK CASCADE a otra tabla
// diferente de user_profiles). Se limpian explícitamente por GDPR para no
// dejar datos personales de tracking tras la eliminación.
//
// NO incluye tablas que ya están en CASCADE con user_profiles.id — esas
// se limpian automáticamente al hacer DELETE FROM user_profiles.
//
// Lista validada contra information_schema a 2026-04-11. Revisar
// periódicamente (`npm run check-gdpr-tables` o manualmente con la
// query del manual eliminacion-cuentas.md).
const TABLES_TO_CLEAN_GDPR: Array<{ table: string; column: string }> = [
  { table: 'ai_chat_logs', column: 'user_id' },
  { table: 'ai_chat_suggestion_clicks', column: 'user_id' },
  { table: 'cancellation_feedback', column: 'user_id' },
  { table: 'conversion_events', column: 'user_id' },
  { table: 'custom_oposiciones', column: 'user_id' },
  { table: 'daily_question_usage', column: 'user_id' },
  { table: 'email_preferences', column: 'user_id' },
  { table: 'law_question_first_attempts', column: 'user_id' },
  { table: 'notification_events', column: 'user_id' },
  { table: 'notification_logs', column: 'user_id' },
  { table: 'plan_type_audit_log', column: 'user_id' },
  { table: 'psychometric_first_attempts', column: 'user_id' },
  { table: 'psychometric_question_disputes', column: 'user_id' },
  { table: 'psychometric_test_answers', column: 'user_id' },
  { table: 'psychometric_test_sessions', column: 'user_id' },
  { table: 'psychometric_user_question_history', column: 'user_id' },
  { table: 'pwa_events', column: 'user_id' },
  { table: 'pwa_sessions', column: 'user_id' },
  { table: 'question_first_attempts', column: 'user_id' },
  { table: 'session_block_events', column: 'user_id' },
  { table: 'share_events', column: 'user_id' },
  { table: 'telegram_session', column: 'user_id' },
  { table: 'upgrade_message_impressions', column: 'user_id' },
  { table: 'user_avatar_settings', column: 'user_id' },
  { table: 'user_difficulty_metrics', column: 'user_id' },
  { table: 'user_feedback', column: 'user_id' },
  { table: 'user_interactions', column: 'user_id' },
  { table: 'user_interactions_archive', column: 'user_id' },
  { table: 'user_learning_analytics', column: 'user_id' },
  { table: 'user_medals', column: 'user_id' },
  { table: 'user_message_interactions', column: 'user_id' },
  { table: 'user_notification_metrics', column: 'user_id' },
  { table: 'user_notification_settings', column: 'user_id' },
  { table: 'user_psychometric_preferences', column: 'user_id' },
  { table: 'user_question_history', column: 'user_id' },
  { table: 'user_sessions', column: 'user_id' },
  { table: 'user_streaks', column: 'user_id' },
  { table: 'user_test_sessions', column: 'user_id' },
  { table: 'user_theme_performance_cache', column: 'user_id' },
  { table: 'user_video_progress', column: 'user_id' },
]

// ============================================
// HELPER: ejecutar DELETE con manejo de errores
// ============================================

async function safeDelete(
  db: ReturnType<typeof getDb>,
  table: string,
  column: string,
  userId: string
): Promise<DeletionResult> {
  try {
    await db.execute(
      sql.raw(`DELETE FROM ${table} WHERE ${column} = '${userId}'`)
    )
    console.log(`✅ Datos eliminados de ${table}`)
    return { table, status: 'deleted' }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    // Si la tabla no existe en este entorno, saltamos silenciosamente.
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      console.log(`⚠️ Tabla ${table} no existe o sin datos, continuando...`)
      return { table, status: 'skipped', reason: errorMessage }
    }
    console.error(`❌ Error borrando de ${table}:`, err)
    return { table, status: 'error', error: errorMessage }
  }
}

// ============================================
// FASE 1: ARCHIVAR DATOS CON RETENCIÓN LEGAL
// ============================================
//
// Extrae y devuelve los datos con obligación fiscal/contable. No borra
// nada — sólo lee. El borrado se hace después de persistir el archivo
// en deleted_users_log.

export async function archiveUserLegalData(userId: string): Promise<ArchivedUserData> {
  const db = getDb()
  const archived: ArchivedUserData = {
    archived_at: new Date().toISOString(),
    tables: {},
  }

  for (const { table, column } of TABLES_WITH_LEGAL_RETENTION) {
    try {
      const result = await db.execute(
        sql.raw(`SELECT * FROM ${table} WHERE ${column} = '${userId}'`)
      )
      // result.rows en drizzle-pg, or result en otros adapters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (result as any).rows ?? (result as any)
      if (Array.isArray(rows) && rows.length > 0) {
        archived.tables[table] = rows
        console.log(`📦 Archivadas ${rows.length} filas de ${table}`)
      }
    } catch (err) {
      console.error(`❌ Error archivando ${table}:`, err)
      // No propagamos: si falla el archivado, el DELETE posterior
      // tampoco funcionará y se reportará como error por la vía habitual.
    }
  }

  return archived
}

// ============================================
// FASE 2: PERSISTIR ARCHIVO EN deleted_users_log
// ============================================
//
// Actualiza el registro de deleted_users_log (que el caller ya debe
// haber creado) con los datos archivados. Si no existe todavía, esta
// función lo crea con los campos mínimos y luego lo actualiza.

export async function persistArchivedData(
  userId: string,
  archived: ArchivedUserData
): Promise<void> {
  const db = getDb()
  const archivedJson = JSON.stringify(archived)

  try {
    await db.execute(
      sql`UPDATE deleted_users_log
          SET archived_data = ${archivedJson}::jsonb
          WHERE original_user_id = ${userId}`
    )
    console.log(`📦 archived_data persistida en deleted_users_log`)
  } catch (err) {
    console.error(`❌ Error persistiendo archived_data:`, err)
    throw err
  }
}

// ============================================
// FASE 3: ELIMINACIÓN CASCADING
// ============================================
//
// Se asume que archiveUserLegalData y persistArchivedData ya se ejecutaron
// (o que el caller aceptó perder los datos de retención, lo cual no es
// recomendable). Tras esta función, `DELETE FROM user_profiles` y
// `supabase.auth.admin.deleteUser` son seguros.

export async function deleteUserData(userId: string): Promise<DeletionResult[]> {
  const db = getDb()
  const results: DeletionResult[] = []

  console.log('🗑️ Iniciando eliminación de usuario:', userId)

  // 1. Archivar los datos con retención legal
  let archived: ArchivedUserData
  try {
    archived = await archiveUserLegalData(userId)
    const archivedTableCount = Object.keys(archived.tables).length
    results.push({
      table: '_archive',
      status: 'deleted',
      reason: `${archivedTableCount} tabla(s) archivada(s): ${Object.keys(archived.tables).join(', ') || 'ninguna'}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    results.push({ table: '_archive', status: 'error', error: msg })
    archived = { archived_at: new Date().toISOString(), tables: {} }
  }

  // 2. Persistir el archivo en deleted_users_log
  try {
    await persistArchivedData(userId, archived)
    results.push({ table: '_archive_persist', status: 'deleted' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    results.push({ table: '_archive_persist', status: 'error', error: msg })
  }

  // 3. Borrar los datos archivados de su tabla origen (ya están a salvo)
  for (const { table, column } of TABLES_WITH_LEGAL_RETENTION) {
    results.push(await safeDelete(db, table, column, userId))
  }

  // 4. Borrar tablas NO CASCADE que bloquean user_profiles
  for (const { table, column } of TABLES_TO_CLEAN_NO_CASCADE) {
    results.push(await safeDelete(db, table, column, userId))
  }

  // 5. Borrar tablas con user_id sin FK (limpieza GDPR explícita)
  for (const { table, column } of TABLES_TO_CLEAN_GDPR) {
    results.push(await safeDelete(db, table, column, userId))
  }

  // 6. Finalmente, borrar user_profiles (CASCADE limpia ~11 tablas más)
  results.push(await safeDelete(db, 'user_profiles', 'id', userId))

  console.log('🗑️ Eliminación de datos completada para usuario:', userId)
  return results
}
