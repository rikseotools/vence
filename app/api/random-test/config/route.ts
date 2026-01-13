// app/api/random-test/config/route.ts - API para configuración de test aleatorio
import { NextRequest, NextResponse } from 'next/server'
import { getThemeQuestionCounts } from '@/lib/api/random-test/queries'
import {
  GetConfigRequestSchema,
  getOposicionConfig,
  isValidOposicion,
  type ConfigResponse,
} from '@/lib/api/random-test/schemas'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse<ConfigResponse>> {
  try {
    const { searchParams } = new URL(request.url)
    const oposicion = searchParams.get('oposicion')

    // Validar parámetro
    if (!oposicion || !isValidOposicion(oposicion)) {
      return NextResponse.json({
        success: false,
        error: 'Oposición no válida. Valores permitidos: auxiliar-administrativo-estado, administrativo-estado, tramitacion-procesal',
      }, { status: 400 })
    }

    // Obtener configuración de bloques
    const config = getOposicionConfig(oposicion)

    // Obtener conteos de preguntas por tema
    const themeCounts = await getThemeQuestionCounts(oposicion)

    // Enriquecer config con conteos
    const enrichedConfig = {
      ...config,
      blocks: config.blocks.map(block => ({
        ...block,
        themes: block.themes.map(theme => {
          const countData = themeCounts.find(tc => tc.themeId === theme.id)
          return {
            ...theme,
            questionCount: countData?.count || 0,
            officialCount: countData?.officialCount || 0,
          }
        }),
      })),
    }

    return NextResponse.json({
      success: true,
      config: enrichedConfig,
      themeCounts,
    })
  } catch (error) {
    console.error('❌ [API/random-test/config] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    }, { status: 500 })
  }
}
