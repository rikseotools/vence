// app/api/exam/init/route.ts - DEPRECATED: No-op para compatibilidad con clientes cacheados
//
// Las preguntas ya NO se pre-crean en test_questions al abrir un examen.
// Se crean solo cuando el usuario responde (via /api/exam/answer → saveAnswer).
// La lista de question_ids se preserva en tests.questions_metadata.
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Consumir el body para evitar warnings de Next.js
  try { await request.json() } catch { /* ignore */ }

  console.log('⚠️ [API/exam/init] DEPRECATED - endpoint es no-op, preguntas se crean via /api/exam/answer')

  return NextResponse.json({
    success: true,
    savedCount: 0,
    deprecated: true,
  })
}
