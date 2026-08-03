// components/test/TestHubPage.tsx - Server Component SSR para SEO
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { OPOSICIONES, SLUG_TO_POSITION_TYPE, getOposicionBySlug } from '@/lib/config/oposiciones'
import TestHubClient from './TestHubClient'
import { getThemeQuestionCounts } from '@/lib/api/random-test/queries'
// Otras convocatorias vivas de la MISMA oposición con temario distinto (caso Madrid,
// 30/07/2026): si existen, hay que avisar de que compruebe cuál tiene seleccionada.
import { getConvocatoriasHermanas } from '@/lib/api/convocatoria/hermanas'
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
  const positionType = SLUG_TO_POSITION_TYPE[oposicion]

  // Obtener topics de la BD (cacheado por Next.js). AGNÓSTICO (Fase C1): Drizzle
  // (getAdminDb) en vez de createClient(ANON)+PostgREST — coherente con
  // getThemeQuestionCounts (que ya es Drizzle) en este mismo server component.
  type TopicRow = { id: string; topic_number: number; title: string; description: string | null; is_active: boolean | null }
  // NO se captura este error a propósito (T-506). Esta página se cachea (`revalidate = false`),
  // así que una pantalla de aviso devuelta aquí se HORNEA como si fuera la página buena y se
  // sirve durante toda la vida del deploy. Pasó el 03/08/2026: un tropiezo de la consulta dejó
  // `/administrativo-estado/test` sirviendo «Error cargando temas» ~17 h con los 45 temas
  // intactos en la BD, y lo descubrió un usuario premium (feedback `ddaa31dd`).
  // Dejarlo reventar es mejor en los dos momentos: al construir, el deploy falla y nadie ve la
  // página rota; al regenerar en caliente, Next conserva la última versión BUENA.
  // Guardarraíl que lo impide: `lib/calidad/erroresHorneados.cjs`.
  const res = await getAdminDb().execute(sql`
    SELECT id, topic_number, title, description, is_active
    FROM topics
    WHERE position_type = ${positionType}
    ORDER BY topic_number ASC
  `)
  const topics = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as TopicRow[]

  // Obtener conteos de preguntas por tema (1 query cacheada, no N+1).
  // Tampoco se captura (T-506): quedarse con la lista vacía no enseña un error, enseña un DATO
  // FALSO — todos los temas saldrían como «sin contenido» — y se hornea con la misma permanencia.
  const themeCounts = await getThemeQuestionCounts(oposicion as RandomTestOposicionSlug)
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
  const hermanas = await getConvocatoriasHermanas(oposicion)
  const officialExams = oposicionConfig?.officialExams

  return (
    <TestHubClient
      oposicion={oposicion}
      oposicionInfo={oposicionInfo}
      bloques={bloques}
      basePath={basePath}
      positionType={positionType}
      hermanas={hermanas}
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
