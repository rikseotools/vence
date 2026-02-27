// components/test/TestHubPage.tsx - Server Component SSR para SEO
import { createClient } from '@supabase/supabase-js'
import { SLUG_TO_POSITION_TYPE, getOposicionBySlug } from '@/lib/config/oposiciones'
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

// Configuración de bloques por oposición
const BLOQUE_CONFIG: Record<OposicionSlug, BloqueConfig[]> = {
  'tramitacion-procesal': [
    { id: 'bloque1', name: 'Bloque I: Organización del Estado y Administración de Justicia', icon: '⚖️', min: 1, max: 15 },
    { id: 'bloque2', name: 'Bloque II: Derecho Procesal', icon: '📜', min: 16, max: 31 },
    { id: 'bloque3', name: 'Bloque III: Informática', icon: '💻', min: 32, max: 37 },
  ],
  'auxiliar-administrativo-estado': [
    { id: 'bloque1', name: 'Bloque I: Organización Pública', icon: '🏛️', min: 1, max: 14 },
    { id: 'bloque2', name: 'Bloque II: Actividad Administrativa', icon: '📋', min: 15, max: 28 },
  ],
  'administrativo-estado': [
    { id: 'bloque1', name: 'Bloque I: Organización del Estado', icon: '🏛️', min: 1, max: 14 },
    { id: 'bloque2', name: 'Bloque II: Administración General del Estado', icon: '📋', min: 101, max: 114 },
    { id: 'bloque3', name: 'Bloque III: Gestión de Personal', icon: '👥', min: 201, max: 210 },
    { id: 'bloque4', name: 'Bloque IV: Gestión Financiera', icon: '💰', min: 301, max: 309 },
    { id: 'bloque5', name: 'Bloque V: Informática Básica', icon: '💻', min: 501, max: 506 },
    { id: 'bloque6', name: 'Bloque VI: Administración Electrónica', icon: '🌐', min: 601, max: 608 },
  ],
  'auxilio-judicial': [
    { id: 'bloque1', name: 'Bloque I: Derecho Constitucional y Organización del Estado', icon: '🏛️', min: 1, max: 5 },
    { id: 'bloque2', name: 'Bloque II: Organización Judicial y Funcionarios', icon: '⚖️', min: 6, max: 15 },
    { id: 'bloque3', name: 'Bloque III: Procedimientos y Actos Procesales', icon: '📜', min: 16, max: 26 },
  ],
  'auxiliar-administrativo-carm': [
    { id: 'bloque1', name: 'Bloque I: Derecho Constitucional y Administrativo', icon: '⚖️', min: 1, max: 9 },
    { id: 'bloque2', name: 'Bloque II: Gestión y Administración Pública', icon: '📋', min: 10, max: 16 },
  ],
}

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
    ? { short: oposicionConfig.shortName, badge: oposicionConfig.badge, icon: oposicionConfig.emoji }
    : { short: oposicion, badge: '', icon: '' }
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
