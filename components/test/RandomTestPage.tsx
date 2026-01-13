// components/test/RandomTestPage.tsx - Server Component SSR para Test Aleatorio
import { createClient } from '@supabase/supabase-js'
import RandomTestClient from './RandomTestClient'
import {
  getOposicionConfig,
  type OposicionSlug,
  type ThemeQuestionCount,
} from '@/lib/api/random-test/schemas'
import { getThemeQuestionCounts } from '@/lib/api/random-test/queries'

interface Props {
  oposicion: OposicionSlug
}

export default async function RandomTestPage({ oposicion }: Props) {
  // Obtener configuración estática
  const config = getOposicionConfig(oposicion)

  // Obtener conteos de preguntas por tema
  let themeCounts: ThemeQuestionCount[] = []
  try {
    themeCounts = await getThemeQuestionCounts(oposicion)
  } catch (error) {
    console.error('Error fetching theme counts:', error)
  }

  // Enriquecer configuración con conteos
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

  // Calcular totales
  const totalQuestions = themeCounts.reduce((sum, tc) => sum + tc.count, 0)
  const totalOfficialQuestions = themeCounts.reduce((sum, tc) => sum + tc.officialCount, 0)

  return (
    <RandomTestClient
      oposicion={oposicion}
      config={enrichedConfig}
      totalQuestions={totalQuestions}
      totalOfficialQuestions={totalOfficialQuestions}
    />
  )
}

// Revalidar cada día (los conteos pueden cambiar con nuevas preguntas)
export const revalidate = 86400 // 24 horas
