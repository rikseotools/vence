// app/api/v2/topic-progress/weak-articles/route.ts
// API v2 para obtener artículos débiles por tema - Usa Drizzle + Zod
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getWeakArticlesForUser,
  safeParseGetWeakArticles,
  type GetWeakArticlesRequest,
} from '@/lib/api/topic-progress'

// Cliente Supabase solo para auth
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  console.log('🎯 [API/v2/weak-articles] Request received')

  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('🎯 [API/v2/weak-articles] No auth header')
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.log('🎯 [API/v2/weak-articles] Auth error:', authError?.message)
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    console.log('🎯 [API/v2/weak-articles] User authenticated:', user.id.substring(0, 8))

    // Parsear query params
    const { searchParams } = new URL(request.url)
    const params = {
      userId: user.id,
      minAttempts: parseInt(searchParams.get('minAttempts') || '2'),
      maxSuccessRate: parseInt(searchParams.get('maxSuccessRate') || '60'),
      maxPerTopic: parseInt(searchParams.get('maxPerTopic') || '5'),
      positionType: searchParams.get('positionType') || undefined,
    }

    // Validar con Zod
    const parseResult = safeParseGetWeakArticles(params)

    if (!parseResult.success) {
      console.log('🎯 [API/v2/weak-articles] Validation error:', parseResult.error.errors)
      return NextResponse.json({
        success: false,
        error: 'Parámetros inválidos',
        details: parseResult.error.errors,
      }, { status: 400 })
    }

    const validatedParams: GetWeakArticlesRequest = parseResult.data
    console.log('🎯 [API/v2/weak-articles] Validated params:', {
      minAttempts: validatedParams.minAttempts,
      maxSuccessRate: validatedParams.maxSuccessRate,
      maxPerTopic: validatedParams.maxPerTopic,
    })

    // Ejecutar query con Drizzle
    const result = await getWeakArticlesForUser(validatedParams)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    const topicCount = Object.keys(result.weakArticlesByTopic || {}).length
    console.log('🎯 [API/v2/weak-articles] Returning weak articles for', topicCount, 'topics')

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/v2/weak-articles] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
