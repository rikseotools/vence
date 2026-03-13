// app/api/verify-articles/sync-all/route.ts - API tipada para sincronización de artículos
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseRequest,
  syncArticlesFromBoe,
  type SyncArticlesResponse
} from '@/lib/api/article-sync'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
/**
 * POST /api/verify-articles/sync-all
 * Sincroniza todos los artículos de una ley desde el BOE
 *
 * Body:
 * - lawId: string (UUID de la ley)
 * - mode: 'sync' | 'replace' (opcional, default: 'sync')
 * - includeDisposiciones: boolean (opcional, default: false) - Si true, también sincroniza disposiciones adicionales/transitorias/derogatorias/finales
 *
 * Comportamiento:
 * - Añade artículos que faltan en BD
 * - Actualiza artículos que han cambiado
 * - Marca como inactivos los que ya no existen en BOE
 * - PRESERVA artículos de estructura (art. 0, índice, etc.)
 */
async function _POST(
  request: NextRequest
): Promise<NextResponse<SyncArticlesResponse>> {
  try {
    const body = await request.json()

    // Validar request con Zod
    const validation = safeParseRequest(body)

    if (!validation.success) {
      console.error('❌ [API/SyncAll] Validación fallida:', validation.error.flatten())
      return NextResponse.json(
        {
          success: false,
          error: `Datos inválidos: ${validation.error.errors.map(e => e.message).join(', ')}`
        },
        { status: 400 }
      )
    }

    const params = validation.data

    console.log('🔄 [API/SyncAll] Iniciando sincronización...', {
      lawId: params.lawId,
      mode: params.mode
    })

    // Ejecutar sincronización
    const result = await syncArticlesFromBoe(params)

    if (!result.success) {
      console.error('❌ [API/SyncAll] Error:', result.error)
      return NextResponse.json(result, { status: 500 })
    }

    console.log('✅ [API/SyncAll] Sincronización completada:', result.stats)

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/SyncAll] Error inesperado:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

// Bloquear GET
async function _GET(): Promise<NextResponse<SyncArticlesResponse>> {
  return NextResponse.json(
    { success: false, error: 'Método no permitido. Usa POST con lawId.' },
    { status: 405 }
  )
}

export const POST = withErrorLogging('/api/verify-articles/sync-all', _POST)
export const GET = withErrorLogging('/api/verify-articles/sync-all', _GET)
