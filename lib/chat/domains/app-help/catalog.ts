// lib/chat/domains/app-help/catalog.ts
// Catálogo de funcionalidades de la app Vence con rutas y descripciones.
// Lo usa AppHelpDomain para responder a preguntas tipo "cómo veo X / dónde está Y".
//
// Cómo añadir una nueva feature:
//   1. Añadir entry al array FEATURES con keywords + title + description + routes
//   2. Si la ruta varía por oposición, mapear en `routes` con slug → path,
//      o usar `default` como fallback.
//
// Los `keywords` se buscan en el mensaje del usuario (case-insensitive). El
// match con mejor cobertura (más keywords matcheados) gana.

export interface AppFeature {
  /** Identificador para logs y debug */
  id: string
  /** Palabras clave que indican que el usuario busca esta feature */
  keywords: string[]
  /** Título corto para mostrar al usuario */
  title: string
  /** Descripción breve de qué hace */
  description: string
  /** Rutas por oposición. 'default' para usuarios sin oposición definida */
  routes: Record<string, string>
}

export const FEATURES: AppFeature[] = [
  {
    id: 'repaso-fallos',
    keywords: ['fallo', 'fallos', 'falladas', 'fallidas', 'erroné', 'incorrect', 'equivocad'],
    title: 'Repasar preguntas falladas',
    description:
      'Reintenta las preguntas que has fallado para reforzar lo que peor llevas. Incluye la respuesta correcta y la explicación de cada una.',
    routes: {
      auxiliar_administrativo_estado: '/auxiliar-administrativo-estado/test/ver-fallos',
      tramitacion_procesal: '/tramitacion-procesal/test/ver-fallos',
      default: '/test/repaso-fallos',
    },
  },
  {
    id: 'mi-progreso',
    keywords: ['progreso', 'estadística', 'estadisticas', 'cómo voy', 'como voy', 'rendimiento', 'estoy avanzando'],
    title: 'Tu progreso',
    description:
      'Resumen de tus estadísticas: preguntas respondidas, % de acierto, evolución semanal, áreas más débiles.',
    routes: {
      auxiliar_administrativo_estado: '/auxiliar-administrativo-estado/mi-progreso',
      tramitacion_procesal: '/tramitacion-procesal/mi-progreso',
      default: '/perfil',
    },
  },
  {
    id: 'ranking',
    keywords: ['ranking', 'clasificación', 'clasificacion', 'compararme', 'posición'],
    title: 'Ranking de opositores',
    description:
      'Te compara con otros opositores activos de tu misma oposición. Se actualiza diariamente.',
    routes: {
      auxiliar_administrativo_estado: '/auxiliar-administrativo-estado/ranking',
      tramitacion_procesal: '/tramitacion-procesal/ranking',
      default: '/ranking',
    },
  },
  {
    id: 'temario',
    keywords: ['temario', 'temas', 'epígrafes', 'epigrafes', 'programa de estudio', 'qué entra'],
    title: 'Temario completo',
    description:
      'Lista de temas oficiales de tu oposición con sus epígrafes. Puedes hacer tests por tema.',
    routes: {
      auxiliar_administrativo_estado: '/auxiliar-administrativo-estado/temario',
      tramitacion_procesal: '/tramitacion-procesal/temario',
      default: '/temarios',
    },
  },
  {
    id: 'leyes',
    keywords: ['leyes', 'legislación', 'normativa', 'consultar ley', 'buscar ley'],
    title: 'Catálogo de leyes',
    description:
      'Todas las leyes que entran en tu oposición, con sus artículos. Puedes hacer test por ley o por artículo.',
    routes: {
      auxiliar_administrativo_estado: '/auxiliar-administrativo-estado/leyes',
      tramitacion_procesal: '/tramitacion-procesal/leyes',
      default: '/leyes',
    },
  },
  {
    id: 'simulacro',
    keywords: ['simulacro', 'examen oficial', 'examen real', 'oficiales'],
    title: 'Simulacros oficiales',
    description:
      'Tests con las preguntas reales de exámenes oficiales anteriores. Para entrenar en condiciones reales.',
    routes: {
      auxiliar_administrativo_estado: '/auxiliar-administrativo-estado/test/oficial',
      tramitacion_procesal: '/tramitacion-procesal/test/oficial',
      default: '/oficiales',
    },
  },
  {
    id: 'impugnar',
    keywords: ['impugnar', 'impugnación', 'reportar pregunta', 'pregunta incorrecta', 'pregunta mal'],
    title: 'Impugnar una pregunta',
    description:
      'Si crees que una pregunta tiene error, pulsa el botón "Impugnar" dentro de la propia pregunta. La revisaremos y te ajustaremos el resultado si corresponde.',
    routes: {
      default: '/mis-impugnaciones',
    },
  },
  // NOTA: 'premium' y 'soporte' los maneja KnowledgeBaseDomain con flujo
  // específico (cancelaciones, problemas de pago, racha, etc.). No incluirlos
  // aquí para evitar colisión de routing — KnowledgeBase tiene priority 2
  // pero la lógica de cancelaciones/precios ahí es mucho más rica que un
  // simple link.
  {
    id: 'soporte',
    keywords: ['soporte', 'ayuda', 'contactar', 'reportar bug', 'problema'],
    title: 'Soporte',
    description: 'Contacta con nosotros para resolver dudas o reportar problemas.',
    routes: {
      default: '/soporte',
    },
  },
]

/**
 * Busca la feature que mejor matchea el mensaje del usuario.
 * Devuelve null si ninguna keyword aparece en el mensaje.
 */
export function findBestFeatureMatch(message: string): AppFeature | null {
  const msgLower = message.toLowerCase()
  let bestMatch: { feature: AppFeature; matches: number } | null = null

  for (const feature of FEATURES) {
    let matches = 0
    for (const keyword of feature.keywords) {
      if (msgLower.includes(keyword.toLowerCase())) {
        matches++
      }
    }
    if (matches > 0 && (!bestMatch || matches > bestMatch.matches)) {
      bestMatch = { feature, matches }
    }
  }

  return bestMatch?.feature ?? null
}

/**
 * Devuelve la ruta correcta para una feature según la oposición del usuario.
 */
export function resolveRoute(feature: AppFeature, userOposicion: string | null | undefined): string {
  if (userOposicion && feature.routes[userOposicion]) {
    return feature.routes[userOposicion]
  }
  return feature.routes.default ?? '/'
}
