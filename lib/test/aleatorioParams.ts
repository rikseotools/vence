// lib/test/aleatorioParams.ts
//
// Constructor PURO de los query params del Test Aleatorio (página
// /[oposicion]/test/aleatorio → RandomTestClient). Extraído para poder testarlo
// y, sobre todo, para centralizar el guardarraíl de los filtros que dependen de
// exámenes oficiales PROPIOS de la oposición.
//
// Contexto (caso Pilar, 2026-06-22): Administrativo CARM (C1) no tiene exámenes
// oficiales propios cargados (officialCount = 0). El toggle "Artículos
// imprescindibles" generaba una URL con `focus_essential=true` que la generación
// no podía satisfacer (0 preguntas) → pantalla de error "no puede generarlo".
// La UI ahora oculta esos toggles cuando no hay oficiales propios; este helper es
// la segunda barrera: aunque el flag llegara activado, NO se emite el param.

export interface AleatorioParamsInput {
  selectedThemes: number[]
  numQuestions: number
  difficulty: string
  /** modo de test: 'examen' usa otra ruta, pero los params son los mismos */
  onlyOfficialQuestions: boolean
  includeSharedOfficials: boolean
  focusEssentialArticles: boolean
  adaptiveMode: boolean
  includeSeenQuestions: boolean
  /** true si la oposición tiene ≥1 pregunta oficial PROPIA (totalOfficialQuestions > 0) */
  hasOwnOfficialQuestions: boolean
}

/**
 * Construye los params de `/[oposicion]/test/test-personalizado`.
 * Los filtros que dependen de oficiales propios (`official_only`,
 * `include_shared_officials`, `focus_essential`) solo se emiten cuando
 * `hasOwnOfficialQuestions === true`.
 */
export function buildAleatorioTestParams(input: AleatorioParamsInput): URLSearchParams {
  const params = new URLSearchParams({
    themes: input.selectedThemes.join(','),
    n: String(input.numQuestions),
    difficulty: input.difficulty,
    mode: 'aleatorio',
  })

  if (input.hasOwnOfficialQuestions) {
    if (input.onlyOfficialQuestions) {
      // Doble alias a propósito: los dos destinos de RandomTestClient leen
      // nombres distintos — test-personalizado (TestPersonalizadoPage) lee
      // `only_official`, mientras que test-aleatorio-examen (ExamAleatorioClient)
      // lee `official_only`. Emitimos ambos para que el toggle "Solo oficiales"
      // surta efecto sea cual sea el modo (práctica vs examen). Antes solo se
      // emitía `official_only` y el filtro se ignoraba en práctica.
      params.append('only_official', 'true')
      params.append('official_only', 'true')
    }
    if (input.includeSharedOfficials) params.append('include_shared_officials', 'true')
    if (input.focusEssentialArticles) params.append('focus_essential', 'true')
  }

  if (input.adaptiveMode) params.append('adaptive', 'true')
  // Solo se pasa el flag cuando el usuario opta explícitamente por incluir vistas;
  // el default del fetcher es priorizar nunca-vistas (preserva comportamiento previo).
  if (input.includeSeenQuestions) params.append('prioritize_never_seen', 'false')

  return params
}
