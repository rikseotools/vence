// app/api/v2/admin/validation-errors/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getValidationErrors, validationErrorsQuerySchema } from '@/lib/api/admin-validation-errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const parsed = validationErrorsQuerySchema.safeParse({
      timeRange: searchParams.get('timeRange') ?? undefined,
      endpoint: searchParams.get('endpoint') ?? undefined,
      errorType: searchParams.get('errorType') ?? undefined,
      userId: searchParams.get('userId') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const data = await getValidationErrors(parsed.data)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[API/v2/admin/validation-errors] Error:', error)
    return NextResponse.json(
      { error: 'Error cargando errores de validación' },
      { status: 500 },
    )
  }
}
