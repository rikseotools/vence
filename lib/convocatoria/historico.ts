// lib/convocatoria/historico.ts
// Cálculos PUROS del apartado "histórico de convocatorias" de las landings.
// Cada fila del histórico es una CONVOCATORIA. Los números base (fechas, plazas, inscritos,
// presentados) vienen de `convocatorias`; el AÑO y los decretos de OEP vienen de la ENTIDAD
// `oep` vía el puente `convocatoria_oep` (NO del slice de `oep_fecha` — eso era el silo que
// T-108 reemplaza). Todo lo derivado (plazos, medias, ratios) se calcula aquí en render.
// Sin dependencias de red/DB → testeable en aislamiento.

export interface ConvocatoriaHistorica {
  /** Año de la CONVOCATORIA (canónico, inmutable en `convocatorias.año`). */
  año: number
  /** Año de la OEP: MAX(año_oep) de las OEP enlazadas por `convocatoria_oep` (entidad `oep`).
   *  null si la convocatoria no tiene OEP enlazada. Es el año que se MUESTRA (criterio de
   *  producto), derivado del enlace estructurado — nunca del slice de una fecha. */
  añoOep: number | null
  /** Decretos de OEP enlazados (p.ej. ["RD 656/2024","RD 625/2023"]), de la entidad. */
  oepDecretos: string[]
  /** Fecha de la OEP más reciente enlazada (de la entidad), para el plazo OEP→convocatoria. */
  oepFecha: string | null
  isCurrent: boolean
  estadoProceso: string | null
  /** Fecha REAL de la convocatoria. null = aún no convocada (NUNCA se infiere de otra fecha). */
  convocatoriaFecha: string | null
  boeReference: string | null
  programaUrl: string | null
  examDate: string | null
  plazasLibres: number | null
  plazasPromocionInterna: number | null
  plazasDiscapacidad: number | null
  inscritos: number | null
  presentados: number | null
}

export interface ConvocatoriaHistoricaCalculada extends ConvocatoriaHistorica {
  /** Año que identifica la fila: el de la OEP si consta, con fallback al de la convocatoria. */
  añoMostrado: number
  /** Total de plazas convocadas (suma de los turnos no-null). null si no consta ninguna. */
  plazasTotal: number | null
  diasOepAConvocatoria: number | null
  diasConvocatoriaAExamen: number | null
  diasOepAExamen: number | null
  inscritosPorPlaza: number | null
  presentadosPorPlaza: number | null
  tasaPresentacion: number | null
}

export interface HistoricoResumen {
  convocatorias: ConvocatoriaHistoricaCalculada[]
  mediaDiasConvocatoriaAExamen: number | null
  mediaDiasOepAExamen: number | null
  mediaInscritosPorPlaza: number | null
  totalAños: number
}

/** Días naturales entre dos fechas ISO. null si falta alguna o son inválidas. */
export function diffDias(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null
  const a = Date.parse(desde)
  const b = Date.parse(hasta)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}

/** Suma de los turnos de plazas no-null. null si TODOS son null. */
export function plazasTotal(c: Pick<ConvocatoriaHistorica, 'plazasLibres' | 'plazasPromocionInterna' | 'plazasDiscapacidad'>): number | null {
  const partes = [c.plazasLibres, c.plazasPromocionInterna, c.plazasDiscapacidad].filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n)
  )
  if (partes.length === 0) return null
  return partes.reduce((s, n) => s + n, 0)
}

/** Divide con guardas: null si el numerador o denominador falta, o el denominador es 0. */
function ratio(num: number | null, den: number | null): number | null {
  if (num == null || den == null || den === 0) return null
  return num / den
}

/**
 * Año que identifica la fila del histórico: el año de la OEP, tomado del enlace estructurado
 * (`ConvocatoriaHistorica.añoOep`, derivado de la entidad `oep` vía `convocatoria_oep`).
 * Fallback al año de la convocatoria solo si no hay OEP enlazada. NUNCA se deriva del slice
 * de una fecha (ese era el silo que T-108 reemplaza).
 */
export function añoOep(c: Pick<ConvocatoriaHistorica, 'año' | 'añoOep'>): number {
  return c.añoOep ?? c.año
}

/** Cómo se muestra la celda "Convocatoria" del histórico. */
export interface CeldaConvocatoria {
  /** true = aún no convocada → la UI pinta "Pendiente de convocar". */
  pendiente: boolean
  /** Fecha ISO de la convocatoria REAL, o null. NUNCA una fecha inferida de otra fuente. */
  fecha: string | null
}

/**
 * GUARDARRAÍL de integridad: decide qué mostrar en la columna "Convocatoria".
 * Regla dura — la fecha SOLO puede ser `convocatoria_fecha` (la fecha real de la Resolución
 * de convocatoria). Si falta, la convocatoria está PENDIENTE: jamás se sustituye por la fecha
 * de la OEP, la de publicación en BOE, ni ninguna otra, porque eso publicaría una fecha errónea.
 */
export function celdaConvocatoria(c: Pick<ConvocatoriaHistorica, 'convocatoriaFecha'>): CeldaConvocatoria {
  if (!c.convocatoriaFecha) return { pendiente: true, fecha: null }
  return { pendiente: false, fecha: c.convocatoriaFecha }
}

/** Enriquece una convocatoria histórica con todos los derivados. */
export function calcularConvocatoria(c: ConvocatoriaHistorica): ConvocatoriaHistoricaCalculada {
  const total = plazasTotal(c)
  // La competencia se mide contra las plazas de ACCESO LIBRE (los inscritos del turno libre
  // compiten por las plazas libres, no por las de promoción interna).
  const plazasRef = c.plazasLibres ?? total
  return {
    ...c,
    añoMostrado: añoOep(c),
    plazasTotal: total,
    diasOepAConvocatoria: diffDias(c.oepFecha, c.convocatoriaFecha),
    diasConvocatoriaAExamen: diffDias(c.convocatoriaFecha, c.examDate),
    diasOepAExamen: diffDias(c.oepFecha, c.examDate),
    inscritosPorPlaza: ratio(c.inscritos, plazasRef),
    presentadosPorPlaza: ratio(c.presentados, plazasRef),
    tasaPresentacion: ratio(c.presentados, c.inscritos),
  }
}

function media(valores: Array<number | null>): number | null {
  const nums = valores.filter((n): n is number => n != null && Number.isFinite(n))
  if (nums.length === 0) return null
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

/**
 * Construye el resumen del histórico a partir de las filas crudas.
 * Ordena por año de OEP descendente (más reciente primero) y computa las medias.
 */
export function resumenHistorico(rows: ConvocatoriaHistorica[]): HistoricoResumen {
  const convocatorias = rows
    .map(calcularConvocatoria)
    .sort((a, b) => b.añoMostrado - a.añoMostrado)

  return {
    convocatorias,
    mediaDiasConvocatoriaAExamen: media(convocatorias.map((c) => c.diasConvocatoriaAExamen)),
    mediaDiasOepAExamen: media(convocatorias.map((c) => c.diasOepAExamen)),
    mediaInscritosPorPlaza: media(convocatorias.map((c) => c.inscritosPorPlaza)),
    totalAños: convocatorias.length,
  }
}
