// lib/api/v2/tests/queries.ts
// Crear (o reutilizar) una sesión de test en la BD — Drizzle sobre Postgres
// estándar (agnóstico de proveedor: RDS/Neon/koigrid/cualquier Postgres).
// Reemplaza supabase.from('tests').insert(...) de utils/testSession.ts.
import { getDb, getPoolerDb } from '@/db/client'
import { tests } from '@/db/schema'
import { and, eq, gte, desc } from 'drizzle-orm'
import type { CreateTestRequest } from './schemas'

// Mismo criterio que el resto de writes v2: pooler self-hosted opt-in, si no getDb.
function dbForWrites() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

export interface CreateTestResult {
  success: boolean
  id?: string
  reused?: boolean
  error?: string
}

/**
 * Crea una sesión de test para `userId`. Para tests de práctica, reutiliza un
 * test activo (no completado) reciente (<30 min) con el mismo tema/número/tipo
 * — replica la lógica anti-duplicados que hacía el cliente contra Supabase.
 * El `userId` SIEMPRE viene del token verificado (nunca del body).
 */
export async function createTestSession(
  params: CreateTestRequest,
  userId: string,
): Promise<CreateTestResult> {
  const db = dbForWrites()

  try {
    // Reutilizar test de práctica activo reciente (evita duplicados por remount).
    if (params.testType === 'practice') {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const [active] = await db
        .select({ id: tests.id })
        .from(tests)
        .where(
          and(
            eq(tests.userId, userId),
            eq(tests.temaNumber, params.tema),
            eq(tests.testNumber, params.testNumber),
            eq(tests.testType, params.testType),
            eq(tests.isCompleted, false),
            gte(tests.startedAt, thirtyMinAgo),
          ),
        )
        .orderBy(desc(tests.startedAt))
        .limit(1)

      if (active?.id) {
        return { success: true, id: active.id, reused: true }
      }
    }

    const [row] = await db
      .insert(tests)
      .values({
        userId,
        title: params.title.substring(0, 100),
        testType: params.testType,
        testUrl: params.testUrl ?? null,
        totalQuestions: params.totalQuestions,
        score: '0',
        temaNumber: params.tema,
        testNumber: params.testNumber,
        timeLimitMinutes: params.timeLimitMinutes ?? null,
        startedAt: new Date().toISOString(),
        isCompleted: false,
        questionsMetadata: params.questionsMetadata ?? {},
        userSessionData: params.userSessionData ?? {},
        performanceMetrics: params.performanceMetrics ?? {},
        deployVersion: params.deployVersion ?? null,
      })
      .returning({ id: tests.id })

    if (!row?.id) {
      return { success: false, error: 'insert_no_id' }
    }
    return { success: true, id: row.id, reused: false }
  } catch (error) {
    console.error(`❌ [v2/tests] createTestSession falló userId=${userId}:`, (error as Error).message)
    return { success: false, error: 'db_error' }
  }
}
