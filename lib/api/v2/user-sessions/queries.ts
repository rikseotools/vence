// lib/api/v2/user-sessions/queries.ts
// Query SERVIDOR (Drizzle/RDS, agnóstico). NO importar desde el cliente.
import { getDb, getPoolerDb } from '@/db/client'
import { userSessions } from '@/db/schema'
import type { CreateUserSessionRequest } from './schemas'

function dbForWrites() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

export async function createUserSession(
  params: CreateUserSessionRequest,
  userId: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const db = dbForWrites()
    const [row] = await db
      .insert(userSessions)
      .values({
        userId,
        sessionStart: new Date().toISOString(),
        userAgent: params.userAgent ?? null,
        screenResolution: params.screenResolution ?? null,
        viewportSize: params.viewportSize ?? null,
        deviceModel: params.deviceModel ?? null,
        browserLanguage: params.browserLanguage ?? null,
        timezone: params.timezone ?? null,
        colorDepth: params.colorDepth ?? null,
        pixelRatio: params.pixelRatio != null ? String(params.pixelRatio) : null,
        connectionType: params.connectionType ?? null,
      })
      .returning({ id: userSessions.id })
    if (!row?.id) return { success: false, error: 'insert_no_id' }
    return { success: true, id: row.id }
  } catch (error) {
    console.error(`❌ [v2/user-sessions] create falló userId=${userId}:`, (error as Error).message)
    return { success: false, error: 'db_error' }
  }
}
