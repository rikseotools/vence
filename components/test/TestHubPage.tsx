// components/test/TestHubPage.tsx - Server Component SSR para SEO
import { createClient } from '@supabase/supabase-js'
import { OPOSICION_TO_POSITION_TYPE } from '@/lib/api/topic-data/schemas'
import TestHubClient from './TestHubClient'

type OposicionSlug = keyof typeof OPOSICION_TO_POSITION_TYPE

interface Topic {
  id: string
  topicNumber: number
  title: string
  description: string | null
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
}

// Nombres cortos para el header
const OPOSICION_NAMES: Record<OposicionSlug, { short: string; badge: string; icon: string }> = {
  'tramitacion-procesal': { short: 'Tramitación Procesal', badge: 'C1', icon: '⚖️' },
  'auxiliar-administrativo-estado': { short: 'Auxiliar Administrativo', badge: 'C2', icon: '👤' },
  'administrativo-estado': { short: 'Administrativo del Estado', badge: 'C1', icon: '👨‍💼' },
  'auxilio-judicial': { short: 'Auxilio Judicial', badge: 'C2', icon: '⚖️' },
}

interface Props {
  oposicion: OposicionSlug
}

export default async function TestHubPage({ oposicion }: Props) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const positionType = OPOSICION_TO_POSITION_TYPE[oposicion]

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

  // Transformar a formato esperado
  const formattedTopics: Topic[] = (topics || []).map(t => ({
    id: t.id,
    topicNumber: t.topic_number,
    title: t.title,
    description: t.description,
  }))

  // Agrupar por bloques
  const bloqueConfig = BLOQUE_CONFIG[oposicion] || []
  const bloques = bloqueConfig.map(bloque => ({
    ...bloque,
    topics: formattedTopics.filter(
      t => t.topicNumber >= bloque.min && t.topicNumber <= bloque.max
    ),
  }))

  const oposicionInfo = OPOSICION_NAMES[oposicion]
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
