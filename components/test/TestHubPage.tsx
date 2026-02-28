// components/test/TestHubPage.tsx - Server Component SSR para SEO
import { createClient } from '@supabase/supabase-js'
import { OPOSICIONES, SLUG_TO_POSITION_TYPE, getOposicionBySlug } from '@/lib/config/oposiciones'
import TestHubClient from './TestHubClient'

type OposicionSlug = string

interface Topic {
  id: string
  topicNumber: number
  title: string
  description: string | null
  hasContent: boolean
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
    .select('id, topic_number, title, description')
    .eq('position_type', positionType)
    .eq('is_active', true)
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

  // Consultar qué temas tienen contenido (topic_scope)
  const topicIds = (topics || []).map(t => t.id)
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('topic_id')
    .in('topic_id', topicIds)

  const topicsWithScope = new Set((scopes || []).map(s => s.topic_id))

  // Transformar a formato esperado
  const formattedTopics: Topic[] = (topics || []).map(t => ({
    id: t.id,
    topicNumber: t.topic_number,
    title: t.title,
    description: t.description,
    hasContent: topicsWithScope.has(t.id),
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
    ? { short: oposicionConfig.shortName, badge: oposicionConfig.badge, icon: oposicionConfig.emoji, oposicionId: oposicionConfig.id }
    : { short: oposicion, badge: '', icon: '', oposicionId: '' }
  const basePath = `/${oposicion}/test/tema`

  return (
    <TestHubClient
      oposicion={oposicion}
      oposicionInfo={oposicionInfo}
      bloques={bloques}
      basePath={basePath}
      positionType={positionType}
    />
  )
}

// Revalidar cada mes (los temas no cambian)
export const revalidate = 2592000 // 30 días
