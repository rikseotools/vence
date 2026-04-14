// lib/api/oep-signals/hito-validation.ts
//
// Utilidad para validar que un hito sea apropiado para una oposición ANTES de
// insertarlo en `convocatoria_hitos`. Pensado para el flujo de señales OEP y
// cualquier otro código que cree hitos (cron de seguimiento, scripts manuales).
//
// Caso de origen (14/04/2026): se añadió a la oposición libre de Galicia un
// hito "Lista provisional admitidos y excluidos (DOG)" del 27/03/2026 que en
// realidad era del turno de PROMOCIÓN INTERNA. Isabel detectó la inconsistencia
// en un newsletter cross-sell. Ver `docs/maintenance/oeps-convocatorias-seguimiento.md` §4f.

export interface HitoCandidate {
  titulo: string
  descripcion?: string | null
  fecha: string
  /**
   * Texto del DOG/BOE origen (opcional pero recomendado). Se analiza para
   * detectar el turno mencionado en la resolución y compararlo con el turno
   * de la oposición destino.
   */
  sourceText?: string | null
}

export interface OposicionForValidation {
  slug: string
  tipo_acceso: string | null
}

export type HitoValidationSeverity = 'error' | 'warning'

export interface HitoValidationIssue {
  severity: HitoValidationSeverity
  code: string
  message: string
}

// Palabras clave por turno. Mantener listas cortas y específicas.
const PROMOCION_INTERNA_KEYWORDS = [
  /\bpromoci[oó]n\s+interna\b/i,
  /\bturno\s+(de\s+)?promoci[oó]n\s+interna\b/i,
  /\bturno\s+interno\b/i,
  /\bacceso\s+interno\b/i,
]

const LIBRE_KEYWORDS = [
  /\bturno\s+libre\b/i,
  /\bacceso\s+libre\b/i,
  /\boposici[oó]n\s+libre\b/i,
  /\bsistema\s+de\s+oposici[oó]n\s+libre\b/i,
]

function detectTurno(text: string | null | undefined): 'libre' | 'promocion_interna' | 'ambos' | 'desconocido' {
  if (!text) return 'desconocido'
  const hasInterna = PROMOCION_INTERNA_KEYWORDS.some(re => re.test(text))
  const hasLibre = LIBRE_KEYWORDS.some(re => re.test(text))
  if (hasInterna && hasLibre) return 'ambos'
  if (hasInterna) return 'promocion_interna'
  if (hasLibre) return 'libre'
  return 'desconocido'
}

/**
 * Valida si un hito candidato es apropiado para una oposición dada. Devuelve
 * una lista de incidencias. `severity='error'` bloquea la inserción; `'warning'`
 * solo alerta pero no bloquea.
 *
 * El consumidor decide qué hacer con los warnings (mostrarlos al admin,
 * loguearlos, etc.). Las errors son "no insertar hasta resolver".
 */
export function validateHitoForOposicion(
  hito: HitoCandidate,
  oposicion: OposicionForValidation
): HitoValidationIssue[] {
  const issues: HitoValidationIssue[] = []

  // Combinar títulos/descripciones y sourceText para detectar turno en cualquiera
  const combined = [hito.titulo, hito.descripcion, hito.sourceText].filter(Boolean).join(' · ')
  const turnoDetectado = detectTurno(combined)

  if (oposicion.tipo_acceso === 'libre') {
    // Error duro: el texto menciona explícitamente promoción interna Y NO menciona libre
    // → el hito es de otro turno, no aplica a esta oposición
    if (turnoDetectado === 'promocion_interna') {
      issues.push({
        severity: 'error',
        code: 'TURNO_MISMATCH',
        message: `El hito menciona "promoción interna" pero la oposición ${oposicion.slug} es de tipo_acceso=libre. Probablemente pertenece a otra oposición (la del turno interno).`,
      })
    }
  } else if (oposicion.tipo_acceso === 'promocion_interna') {
    // Caso simétrico
    if (turnoDetectado === 'libre') {
      issues.push({
        severity: 'error',
        code: 'TURNO_MISMATCH',
        message: `El hito menciona "turno libre" pero la oposición ${oposicion.slug} es de tipo_acceso=promocion_interna.`,
      })
    }
  }

  // Fecha futura con status 'completed' = imposible (ver manual §4e)
  // Solo se valida si el hito trae un status; lo dejamos como aviso porque
  // el consumidor puede decidirlo después.
  if (hito.fecha) {
    const hoy = new Date()
    hoy.setUTCHours(0, 0, 0, 0)
    const fechaHito = new Date(hito.fecha)
    if (!isNaN(fechaHito.getTime()) && fechaHito > hoy) {
      // No sabemos el status desde HitoCandidate — el consumidor lo checkea.
      // Dejamos solo un warning informativo si la fecha es muy lejana.
      const diasFuturo = Math.round((fechaHito.getTime() - hoy.getTime()) / 86400000)
      if (diasFuturo > 365 * 2) {
        issues.push({
          severity: 'warning',
          code: 'FECHA_LEJANA',
          message: `La fecha del hito (${hito.fecha}) está a más de 2 años en el futuro. Verifica que no sea una estimación sin base oficial (ver manual §4e).`,
        })
      }
    }
  }

  return issues
}

/**
 * Atajo: devuelve true si hay al menos una incidencia de severity='error'.
 * El consumidor puede usar esto como gate antes del INSERT.
 */
export function hasBlockingErrors(issues: HitoValidationIssue[]): boolean {
  return issues.some(i => i.severity === 'error')
}

// Export interno para testing
export const __internal = { detectTurno }
