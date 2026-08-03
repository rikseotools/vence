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

  // Obtener conteos de preguntas por tema.
  // NO se captura a propósito (T-506): esta página se cachea (`revalidate = false`, abajo), así
  // que degradar a la lista vacía hornea «0 preguntas» en TODOS los temas y lo sirve durante toda
  // la vida del deploy — un dato falso, y más difícil de ver que un error. Hermano silencioso del
  // fallo de `TestHubPage` (feedback `ddaa31dd`, 03/08/2026).
  // Guardarraíl que lo impide: `lib/calidad/erroresHorneados.cjs`.
  const themeCounts: ThemeQuestionCount[] = await getThemeQuestionCounts(oposicion)

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

// Cache estática (ISR on-demand). Revalidar con:
//   - POST /api/purge-cache {"path": "/<slug>/test/aleatorio"}  (una ruta)
//   - node scripts/purge-all-cache.js                            (todas las rutas ISR)
// Ver docs/maintenance/cache-revalidation.md
export const revalidate = false
