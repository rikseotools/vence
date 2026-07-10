// lib/teoria/detectFlattenedTable.ts
//
// Detecta "tablas aplanadas": tablas importadas de PDF que perdieron la rejilla y
// quedaron como una secuencia de celdas cortas en líneas sueltas (p.ej. Grupo→valor
// A1 / E038 / A2 / E023…, o rango→nº 'Hasta 100 residentes' / 3 / …). El render NO
// puede reconstruirlas con seguridad (columnas variables + cifras exactas), así que
// se DETECTAN (sweep nocturno → content_health_findings) y se ARREGLAN por datos con
// verificación humana. Ver docs/runbooks/salud-contenido.md y el runbook de tablas.
//
// FUENTE ÚNICA del criterio. El sweep (scripts/health-sweep.cjs) lleva un mirror
// inline (self-contained .cjs); mantener en sync — los tests fijan las fixtures.

export type TableClassification = 'flattened_table' | 'structure_index' | 'none'

export interface FlattenedTableFinding {
  /** true solo si es una tabla aplanada REAL (no un índice de estructura). */
  detected: boolean
  /** longitud del run de celdas más largo hallado. */
  cellCount: number
  /** las celdas del run (para preview/reconstrucción). */
  cells: string[]
  classification: TableClassification
}

const CELL_MAX_LEN = 30
const MIN_RUN = 4
// Índice de estructura (TÍTULO/CAPÍTULO…) = FALSO positivo: no es tabla, es un
// sumario de secciones → se deja como lista, no se marca.
const STRUCTURE_RE = /\b(T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N|SUBSECCI[OÓ]N|ANEXO|DISPOSICI[OÓ]N|LIBRO)\b/i

/** ¿línea "celda" (corta, sin cierre de frase, no enumerador, con alfanumérico)? */
function isCellLine(l: string): boolean {
  return (
    l.length > 0 &&
    l.length <= CELL_MAX_LEN &&
    !/[.:;]$/.test(l) &&
    !/^([a-zñ]\)|\d{1,3}\.)/.test(l) &&
    /[A-Za-z0-9]/.test(l)
  )
}

export function detectFlattenedTable(content: string | null | undefined): FlattenedTableFinding {
  const none: FlattenedTableFinding = { detected: false, cellCount: 0, cells: [], classification: 'none' }
  if (!content || !content.trim()) return none

  const lines = content.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)
  let best: string[] = []
  let run: string[] = []
  for (const l of lines) {
    if (isCellLine(l)) {
      run.push(l)
      if (run.length > best.length) best = [...run]
    } else {
      run = []
    }
  }

  if (best.length < MIN_RUN) return none
  const classification: TableClassification = STRUCTURE_RE.test(best.join(' '))
    ? 'structure_index'
    : 'flattened_table'
  return {
    detected: classification === 'flattened_table',
    cellCount: best.length,
    cells: best,
    classification,
  }
}
