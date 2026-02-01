// app/api/exam/discard/route.ts
// API para descartar exámenes abandonados (marca como completado sin puntuación)

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { tests } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod/v3'

// Schema de validación
const discardExamSchema = z.object({
  testId: z.string().uuid('ID de test inválido'),
  userId: z.string().uuid('ID de usuario inválido')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar request
    const validation = discardExamSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { testId, userId } = validation.data
    const db = getDb()

    // Verificar que el test existe y pertenece al usuario
    const existingTest = await db
      .select({ id: tests.id, userId: tests.userId, isCompleted: tests.isCompleted })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)

    if (existingTest.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Test no encontrado' },
        { status: 404 }
      )
    }

    if (existingTest[0].userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para descartar este test' },
        { status: 403 }
      )
    }

    if (existingTest[0].isCompleted) {
      return NextResponse.json(
        { success: false, error: 'Este test ya está completado' },
        { status: 400 }
      )
    }

    // Marcar como descartado (completed_at con timestamp, is_completed=false indica descartado)
    // O alternativamente, podemos usar is_completed=true con score=-1 para indicar descartado
    await db
      .update(tests)
      .set({
        completedAt: new Date().toISOString(),
        // Mantenemos is_completed=false pero con completed_at para indicar "descartado"
        // Esto evita que aparezca en pending (porque completed_at no es null)
      })
      .where(and(
        eq(tests.id, testId),
        eq(tests.userId, userId)
      ))

    console.log('✅ [API/exam/discard] Examen descartado:', testId)

    return NextResponse.json({
      success: true,
      message: 'Examen descartado correctamente'
    })

  } catch (error) {
    console.error('❌ [API/exam/discard] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
