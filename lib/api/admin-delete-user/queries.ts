// lib/api/admin-delete-user/queries.ts
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type { DeletionResult } from './schemas'

// Orden de eliminación para respetar foreign keys
const TABLES_TO_CLEAN: Array<{ table: string; column: string; skipIfNotExists?: boolean }> = [
  { table: 'pwa_events', column: 'user_id' },
  { table: 'pwa_sessions', column: 'user_id' },
  { table: 'notification_events', column: 'user_id' },
  { table: 'email_events', column: 'user_id' },
  { table: 'email_preferences', column: 'user_id' },
  { table: 'user_notification_metrics', column: 'user_id' },
  { table: 'user_question_history', column: 'user_id' },
  { table: 'user_streaks', column: 'user_id' },
  { table: 'ai_chat_logs', column: 'user_id' },
  { table: 'detailed_answers', column: 'user_id' },
  { table: 'test_questions', column: 'user_id', skipIfNotExists: true },
  { table: 'tests', column: 'user_id' },
  { table: 'test_sessions', column: 'user_id' },
  { table: 'user_sessions', column: 'user_id' },
  { table: 'user_subscriptions', column: 'user_id' },
  { table: 'conversion_events', column: 'user_id' },
  { table: 'user_feedback', column: 'user_id' },
  { table: 'question_disputes', column: 'user_id' },
  { table: 'deleted_users_log', column: 'original_user_id' },
  { table: 'user_roles', column: 'user_id' },
  { table: 'user_profiles', column: 'id' },
]

// ============================================
// ELIMINAR DATOS DE USUARIO (CASCADING)
// ============================================

export async function deleteUserData(userId: string): Promise<DeletionResult[]> {
  const db = getDb()
  const results: DeletionResult[] = []

  console.log('🗑️ Iniciando eliminación de usuario:', userId)

  for (const { table, column, skipIfNotExists } of TABLES_TO_CLEAN) {
    try {
      await db.execute(
        sql.raw(`DELETE FROM ${table} WHERE ${column} = '${userId}'`)
      )
      console.log(`✅ Datos eliminados de ${table}`)
      results.push({ table, status: 'deleted' })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      if (skipIfNotExists || errorMessage.includes('does not exist')) {
        console.log(`⚠️ Tabla ${table} no existe o sin datos, continuando...`)
        results.push({ table, status: 'skipped', reason: errorMessage })
      } else {
        console.error(`❌ Error borrando de ${table}:`, err)
        results.push({ table, status: 'error', error: errorMessage })
      }
    }
  }

  console.log('🗑️ Eliminación de datos completada para usuario:', userId)
  return results
}
