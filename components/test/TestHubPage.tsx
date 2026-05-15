// components/test/TestHubPage.tsx - Server Component SSR para SEO
import { createClient } from '@supabase/supabase-js'
import { OPOSICIONES, SLUG_TO_POSITION_TYPE, getOposicionBySlug } from '@/lib/config/oposiciones'
import TestHubClient from './TestHubClient'
import { getThemeQuestionCounts } from '@/lib/api/random-test/queries'
import type { OposicionSlug as RandomTestOposicionSlug } from '@/lib/api/random-test/schemas'

type OposicionSlug = string

interface Topic {
  id: string
  topicNumber: number
  displayNumber: number
  title: string
  description: string | null
  hasContent: boolean
  isActive: boolean
}

interface BloqueConfig {
  id: string
  name: string
  icon: string
  min: number
  max: number
}

// Configuración de bloques por oposición (generado desde config central)
const BLOQUE_CONFIG: Record<OposicionSlug, BloqueConfig[]> = Object.fromEntries(
  OPOSICIONES.map(o => [
    o.slug,
    o.blocks.map(block => ({
      id: block.id,
      name: block.title,
      icon: block.icon,
      min: block.themes[0].id,
      max: block.themes[block.themes.length - 1].id,
    })),
  ])
)

// Mapa topic_number → displayNumber (solo para temas donde difiere)
const DISPLAY_NUMBER_MAP: Record<OposicionSlug, Record<number, number>> = Object.fromEntries(
  OPOSICIONES.map(o => [
    o.slug,
    Object.fromEntries(
      o.blocks
        .flatMap(b => b.themes)
        .filter(t => t.displayNumber != null)
        .map(t => [t.id, t.displayNumber!])
    ),
  ])
)

interface Props {
  oposicion: OposicionSlug
}

export default async function TestHubPage({ oposicion }: Props) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const positionType = SLUG_TO_POSITION_TYPE[oposicion]

  // Obtener topics de la BD (cacheado por Next.js)
  const { data: topics, error } = await supabase
    .from('topics')
    .select('id, topic_number, title, description, is_active')
    .eq('position_type', positionType)
    .order('topic_number', { ascending: true })

  if (error) {
    console.error('Error fetching topics:', error)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error cargando temas</p>
        </div>
      </div>
    )
  }

  // Obtener conteos de preguntas por tema (1 query cacheada, no N+1)
  let themeCounts: { themeId: number; count: number }[] = []
  try {
    themeCounts = await getThemeQuestionCounts(oposicion as RandomTestOposicionSlug)
  } catch (error) {
    console.error('Error fetching theme counts:', error)
  }
  const themeCountMap = new Map(themeCounts.map(tc => [tc.themeId, tc.count]))

  // Transformar a formato esperado
  const displayMap = DISPLAY_NUMBER_MAP[oposicion] || {}
  const formattedTopics: Topic[] = (topics || []).map(t => ({
    id: t.id,
    topicNumber: t.topic_number,
    displayNumber: displayMap[t.topic_number] ?? t.topic_number,
    title: t.title,
    description: t.description,
    hasContent: (themeCountMap.get(t.topic_number) || 0) > 0,
    isActive: t.is_active !== false,
  }))

  // Agrupar por bloques
  const bloqueConfig = BLOQUE_CONFIG[oposicion] || []
  const bloques = bloqueConfig.map(bloque => ({
    ...bloque,
    topics: formattedTopics.filter(
      t => t.topicNumber >= bloque.min && t.topicNumber <= bloque.max
    ),
  }))

  const oposicionConfig = getOposicionBySlug(oposicion)
  const oposicionInfo = oposicionConfig
    ? { short: oposicionConfig.shortName, name: oposicionConfig.name, badge: oposicionConfig.badge, icon: oposicionConfig.emoji, oposicionId: oposicionConfig.id }
    : { short: oposicion, badge: '', icon: '', oposicionId: '' }
  const basePath = `/${oposicion}/test/tema`
  const officialExams = oposicionConfig?.officialExams

  return (
    <TestHubClient
      oposicion={oposicion}
      oposicionInfo={oposicionInfo}
      bloques={bloques}
      basePath={basePath}
      positionType={positionType}
      officialExams={officialExams}
      hasSpellingTest={oposicionConfig?.hasSpellingTest}
      hasPsychometricTest={oposicionConfig?.hasPsychometricTest}
    />
  )
}

// Cache estática (ISR on-demand). Revalidar con:
//   - POST /api/purge-cache {"path": "/<slug>/test"}  (una ruta)
//   - node scripts/purge-all-cache.js                  (todas las rutas ISR)
// Ver docs/maintenance/cache-revalidation.md
export const revalidate = false
