// e2e/helpers/cleaner.ts
//
// CONTRATO de limpieza (agnóstico de proveedor). Los tests que ESCRIBEN datos reales
// (responder preguntas en prod) registran una marca temporal y, al terminar, piden al
// Cleaner que borre lo que crearon → no inflan estadísticas de la cuenta.
//
// Implementación por defecto = Postgres estándar (pg) vía E2E_DATABASE_URL. Si koigrid
// mantiene Postgres, mismo código; si cambia de BD, se implementa otro Cleaner sin
// tocar los specs.

import { E2E_DATABASE_URL } from '../config/env'

export interface Cleaner {
  resolveUserId(email: string): Promise<string | null>
  /** Borra test_questions + tests del usuario creados a partir de `sinceISO`. Devuelve nº de filas. */
  purgeSince(userId: string, sinceISO: string): Promise<{ testQuestions: number; tests: number }>
  close(): Promise<void>
}

export async function makePgCleaner(): Promise<Cleaner> {
  if (!E2E_DATABASE_URL) {
    throw new Error('[e2e] makePgCleaner necesita E2E_DATABASE_URL (o DATABASE_URL) para limpiar.')
  }
  // require perezoso: pg solo se carga si un spec pide limpieza.
  const { Client } = await import('pg')
  const client = new Client({ connectionString: E2E_DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  return {
    async resolveUserId(email) {
      const r = await client.query('select id from user_profiles where email = $1', [email])
      return r.rows[0]?.id ?? null
    },
    async purgeSince(userId, sinceISO) {
      const tq = await client.query(
        'delete from test_questions where user_id = $1 and created_at >= $2', [userId, sinceISO],
      )
      const t = await client.query(
        'delete from tests where user_id = $1 and created_at >= $2', [userId, sinceISO],
      )
      return { testQuestions: tq.rowCount ?? 0, tests: t.rowCount ?? 0 }
    },
    async close() { await client.end() },
  }
}
