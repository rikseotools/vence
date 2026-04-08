// app/api/v2/complete-test/route.ts
// Endpoint server-side para completar un test con analytics completos.
// Reemplaza el completeDetailedTest client-side que bloqueaba processingAnswer.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import {
  safeParseCompleteTestRequest,
  completeTest,
  type CompleteTestResponse,
} from '@/lib/api/v2/complete-test'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getDb } from '@/db/client'
import { testQuestions } from '@/db/schema'
import { eq, count } from 'drizzle-orm'

// Margen generoso: incluye cálculo de analytics + múltiples queries BD
export const maxDuration = 30

async function _POST(request: NextRequest): Promise<NextResponse<CompleteTestResponse | { success: false; error: string }>> {
  const startTime = Date.now()

  try {
    // 1. Auth: verificar Bearer token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' } as const,
        { status: 401 },
      )
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no autenticado' } as const,
        { status: 401 },
      )
    }

    // 2. Parse + validate body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'JSON inválido' } as const,
        { status: 400 },
      )
    }

    const parsed = safeParseCompleteTestRequest(body)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return NextResponse.json(
        { success: false, error: `Validación: ${firstError?.path.join('.')} - ${firstError?.message}` } as const,
        { status: 400 },
      )
    }

    // 3. Ejecutar completar test
    const result = await completeTest(parsed.data, user.id)

    const totalMs = Date.now() - startTime
    if (totalMs > 3000) {
      console.warn(`⚠️ [complete-test] Respuesta lenta: ${totalMs}ms sessionId=${parsed.data.sessionId}`)
    }

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    // Verificar respuestas guardadas DESPUÉS de responder al cliente
    // La queue puede estar procesando las últimas respuestas en paralelo
    after(async () => {
      try {
        // Esperar a que la queue termine de procesar
        await new Promise(resolve => setTimeout(resolve, 10000))
        const db = getDb()
        const [savedCount] = await db
          .select({ count: count() })
          .from(testQuestions)
          .where(eq(testQuestions.testId, parsed.data.sessionId))
        const saved = Number(savedCount?.count ?? 0)
        const expected = parsed.data.detailedAnswers.length
        if (saved < expected) {
          console.error(`🚨 [complete-test] ALERTA: solo ${saved}/${expected} respuestas guardadas en test_questions (tras 10s). sessionId=${parsed.data.sessionId} userId=${user.id}`)
        }
      } catch (e) {
        console.warn('⚠️ [complete-test after] Error verificando respuestas:', e)
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    const totalMs = Date.now() - startTime
    console.error(`❌ [complete-test] Error tras ${totalMs}ms:`, error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' } as const,
      { status: 500 },
    )
  }
}

export const POST = withErrorLogging('/api/v2/complete-test', _POST)
