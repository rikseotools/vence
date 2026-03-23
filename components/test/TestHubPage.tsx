// components/test/TestHubPage.tsx - Server Component SSR para SEO
import { createClient } from '@supabase/supabase-js'
import { OPOSICIONES, SLUG_TO_POSITION_TYPE, getOposicionBySlug } from '@/lib/config/oposiciones'
import TestHubClient from './TestHubClient'

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

  // Consultar qué temas tienen contenido (topic_scope + preguntas)
  const topicIds = (topics || []).map(t => t.id)
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('topic_id')
    .in('topic_id', topicIds)

  const topicsWithScope = new Set((scopes || []).map(s => s.topic_id))

  // Para temas con scope, verificar cuáles tienen al menos 1 pregunta
  const topicsWithQuestions = new Set<string>()
  for (const topicId of topicsWithScope) {
    const { data: scopeRows } = await supabase
      .from('topic_scope')
      .select('law_id, article_numbers')
      .eq('topic_id', topicId)

    let articleIds: string[] = []
    for (const s of scopeRows || []) {
      if (!s.article_numbers) {
        const { data: arts } = await supabase.from('articles').select('id').eq('law_id', s.law_id).limit(100)
        articleIds.push(...(arts || []).map(a => a.id))
      } else {
        const { data: arts } = await supabase.from('articles').select('id').eq('law_id', s.law_id).in('article_number', s.article_numbers).limit(500)
        articleIds.push(...(arts || []).map(a => a.id))
      }
    }

    if (articleIds.length > 0) {
      const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('is_active', true).in('primary_article_id', articleIds.slice(0, 500))
      if (count && count > 0) topicsWithQuestions.add(topicId)
    }
  }

  // Transformar a formato esperado
  const displayMap = DISPLAY_NUMBER_MAP[oposicion] || {}
  const formattedTopics: Topic[] = (topics || []).map(t => ({
    id: t.id,
    topicNumber: t.topic_number,
    displayNumber: displayMap[t.topic_number] ?? t.topic_number,
    title: t.title,
    description: t.description,
    hasContent: topicsWithQuestions.has(t.id),
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
    />
  )
}

// Revalidar cada mes (los temas no cambian)
export const revalidate = 2592000 // 30 días
