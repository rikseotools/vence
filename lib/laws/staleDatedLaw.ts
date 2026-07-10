// lib/laws/staleDatedLaw.ts
//
// Detecta leyes ANUALES caducadas: su nombre lleva un AÑO OBJETIVO explícito
// ("para el año XXXX", "del ejercicio XXXX") ya pasado. Típico de las leyes de
// Presupuestos Generales, que se sustituyen cada enero por la del año siguiente
// (una ley NUEVA con otro número/URL) → ni el radar de epígrafes (comprueba
// materia, no vigencia) ni el monitor BOE (comprueba texto, no supersesión) las
// cazan. Gap real: jinayda32 encontró la Ley 9/2024 (Presupuestos CM 2025) viva
// en el T12 de Madrid en julio de 2026.
//
// PRECISIÓN > recall a propósito: exigimos la frase de AÑO OBJETIVO, no "presupuest"
// a secas, para NO marcar la Ley 47/2003 "General Presupuestaria" (marco permanente,
// sin año objetivo) ni fechas de promulgación ("de 2003").
//
// FUENTE ÚNICA del criterio. El sweep (scripts/health-sweep.cjs) lleva un mirror
// inline (self-contained .cjs); mantener EN SYNC — el test fija las fixtures.

export interface StaleDatedLawResult {
  /** el nombre declara un año objetivo (ley anual/con-año). */
  isDated: boolean
  /** año objetivo declarado en el nombre, o null. */
  targetYear: number | null
  /** isDated && targetYear < currentYear. */
  isStale: boolean
}

// "para el año 2025" | "para 2025" | "del año 2025" | "del ejercicio 2025"
const TARGET_YEAR_RE = /\bpara\s+(?:el\s+a[ñn]o\s+)?(\d{4})\b|\bdel\s+(?:a[ñn]o|ejercicio)\s+(\d{4})\b/i

export function detectStaleDatedLaw(
  name: string | null | undefined,
  currentYear: number,
): StaleDatedLawResult {
  if (!name) return { isDated: false, targetYear: null, isStale: false }
  const m = name.match(TARGET_YEAR_RE)
  const targetYear = m ? Number(m[1] || m[2]) : null
  const isDated = targetYear != null
  const isStale = isDated && targetYear! < currentYear
  return { isDated, targetYear, isStale }
}
