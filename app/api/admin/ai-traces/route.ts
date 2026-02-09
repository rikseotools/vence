// app/api/admin/ai-traces/route.ts
// API para obtener lista de traces del AI Chat (admin)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTracesRequestSchema } from '@/lib/api/ai-traces/schemas'
import { getTracesList } from '@/lib/api/ai-traces/queries'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Emails de administradores autorizados
const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]

function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

export async function GET(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)

    // Verificar autenticación
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar que es admin
    if (!isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      )
    }

    // Parsear parámetros de la URL
    const searchParams = request.nextUrl.searchParams
    const params = {
      type: searchParams.get('type') || undefined,
      hasErrors: searchParams.get('hasErrors') === 'true' ? true :
                 searchParams.get('hasErrors') === 'false' ? false : undefined,
      hasFeedback: searchParams.get('hasFeedback') || undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || '0',
      orderBy: searchParams.get('orderBy') || 'created_at',
      orderDir: searchParams.get('orderDir') || 'desc',
    }

    // Validar parámetros
    const validatedParams = getTracesRequestSchema.parse(params)

    // Obtener traces
    const { items, total } = await getTracesList({
      type: validatedParams.type,
      hasErrors: validatedParams.hasErrors,
      hasFeedback: validatedParams.hasFeedback,
      fromDate: validatedParams.fromDate,
      toDate: validatedParams.toDate,
      limit: validatedParams.limit,
      offset: validatedParams.offset,
      orderBy: validatedParams.orderBy,
      orderDir: validatedParams.orderDir,
    })

    // Formatear respuesta
    const response = {
      traces: items.map(item => ({
        logId: item.logId,
        message: item.message,
        createdAt: item.createdAt || new Date().toISOString(),
        feedback: item.feedback,
        hadError: item.hadError ?? false,
        hadDiscrepancy: item.hadDiscrepancy ?? false,
        traceCount: item.traceCount || 0,
        totalDurationMs: item.totalDurationMs,
        traceTypes: [], // Se llena con query adicional si es necesario
        errorCount: item.errorCount || 0,
        modelUsed: item.modelUsed,
        totalTokensIn: null,
        totalTokensOut: null,
      })),
      total,
      limit: validatedParams.limit,
      offset: validatedParams.offset,
      hasMore: total > validatedParams.offset + items.length,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API/admin/ai-traces] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
