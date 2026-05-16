// lib/api/simulacro/config.ts
// Config UI-safe del simulacro (sin Drizzle ni dependencias server-only).
// Pensado para consumirse desde componentes cliente (TestHubClient, paywall,
// landings) que necesitan saber cuántas preguntas y minutos tiene el
// simulacro de cada oposición sin importar el módulo de queries.
//
// La verdad operacional (positionType, examSourcePattern, breakdown final
// con texto en español…) sigue viviendo en `queries.ts` junto a la lógica
// SQL. Aquí solo lo que el cliente necesita renderizar antes de entrar al
// simulacro.

export interface SimulacroPublicConfig {
  /** Número total de preguntas del simulacro (incluye legislativas + psico). */
  totalQuestions: number
  /** Duración máxima del cronómetro de cuenta atrás (en minutos). */
  durationMinutes: number
  /** Resumen breve para mostrar en paywalls (ej. "30 programa + 30 psico + 50 ofimática"). */
  shortBreakdown: string
  /**
   * Desglose detallado en líneas (una por parte) según las bases oficiales
   * de la convocatoria. Se muestra en la card del simulacro con letra pequeña
   * para que el usuario sepa exactamente qué va a hacer antes de empezar.
   */
  breakdownLines: string[]
}

/**
 * Config pública del simulacro por oposición (slug).
 * Si el slug no está en este mapa, la oposición NO tiene simulacro disponible
 * y el componente debe ocultar la card.
 */
export const SIMULACRO_PUBLIC_CONFIG: Record<string, SimulacroPublicConfig> = {
  'auxiliar-administrativo-estado': {
    totalQuestions: 110,
    durationMinutes: 90,
    shortBreakdown: '30 programa + 30 psicotécnicas + 50 Bloque II',
    breakdownLines: [
      'Primera parte (60): 30 del Bloque I del programa + 30 psicotécnicas',
      'Segunda parte (50): Bloque II — actividad administrativa y ofimática (Windows 11 y Microsoft 365)',
    ],
  },
}

/** Lista de oposiciones que tienen simulacro disponible (derivada del config). */
export const SIMULACRO_AVAILABLE_OPOSICIONES: string[] = Object.keys(SIMULACRO_PUBLIC_CONFIG)

/** Devuelve la config pública del simulacro para una oposición, o null si no tiene. */
export function getSimulacroConfig(oposicionSlug: string): SimulacroPublicConfig | null {
  return SIMULACRO_PUBLIC_CONFIG[oposicionSlug] ?? null
}
