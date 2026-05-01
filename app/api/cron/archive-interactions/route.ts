// app/api/cron/archive-interactions/route.ts
// Cron diario: mueve user_interactions >30 días a archive, borra archive >6 meses.
//
// Diseño:
// - Batches de 50k para no bloquear el pool
// - Máximo 5 batches por ejecución (250k filas) para no exceder timeout de Vercel
// - Si quedan más, el siguiente cron las moverá
// - Borra datos archivados >6 meses (retención legal suficiente para investigar bugs)

import { NextRequest, NextResponse } from 'next/server'
// getAdminDb (max:4) en vez de getDb (max:1): este cron procesa hasta 200k
// filas en 20 batches paralelos. Con max:1 monopolizaba el pool de usuarios
// durante los minutos de ejecución (3:30 UTC, fuera de pico) — aun así
// movemos al pool admin para mantener consistencia con el resto de crons
// y porque el día que coincida con un usuario madrugador no le bloqueamos.
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'

const BATCH_SIZE = 10_000  // 10k por batch (50k causaba statement timeout en Supabase)
const MAX_BATCHES = 20  // 200k máx por ejecución
const ARCHIVE_AFTER_DAYS = 30
const DELETE_AFTER_MONTHS = 6

async function _GET(request: NextRequest) {
  // Verificar auth (cron secret)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminDb()
  const results = { archived: 0, deleted: 0, batches: 0, errors: [] as string[] }

  try {
    // 1. ARCHIVAR: mover filas >30 días de user_interactions a archive
    for (let i = 0; i < MAX_BATCHES; i++) {
      const moved = await db.execute(sql`
        WITH to_move AS (
          SELECT id FROM user_interactions
          WHERE created_at < now() - interval '${sql.raw(String(ARCHIVE_AFTER_DAYS))} days'
          LIMIT ${BATCH_SIZE}
        ),
        inserted AS (
          INSERT INTO user_interactions_archive
          SELECT ui.* FROM user_interactions ui
          WHERE ui.id IN (SELECT id FROM to_move)
          RETURNING id
        )
        DELETE FROM user_interactions
        WHERE id IN (SELECT id FROM to_move)
      `)

      const count = (moved as any)?.rowCount ?? 0
      results.archived += count
      results.batches++

      if (count < BATCH_SIZE) break  // No quedan más
    }

    // 2. LIMPIAR: borrar filas >6 meses del archivo
    const deleted = await db.execute(sql`
      DELETE FROM user_interactions_archive
      WHERE created_at < now() - interval '${sql.raw(String(DELETE_AFTER_MONTHS))} months'
    `)
    results.deleted = (deleted as any)?.rowCount ?? 0

    console.log(`✅ [archive-interactions] Archivadas: ${results.archived} | Eliminadas: ${results.deleted} | Batches: ${results.batches}`)

    return NextResponse.json({
      success: true,
      ...results,
      message: `Archivadas ${results.archived} filas (${results.batches} batches), eliminadas ${results.deleted} filas >6 meses`,
    })
  } catch (error) {
    console.error('❌ [archive-interactions]', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      ...results,
    }, { status: 500 })
  }
}

export const GET = _GET
export const maxDuration = 300  // 5 min max en Vercel
