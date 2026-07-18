// lib/laws/completeness.ts
//
// Estado HONESTO de verificación de una ley contra su FUENTE oficial.
//
// Gap que cierra (caso Ana Llano, ULE T18, 18/07/2026): una ley se importó a
// medias (9 de 74 artículos), sin `boe_url`, NUNCA verificada, pero marcada
// `verification_status='actualizada'` → invisible justo para el sistema que la
// habría cazado (el monitor BOE `verify-articles` → `missing_in_db` → badge).
// El monitor BOE solo parsea el BOE consolidado, así que las 400 leyes
// regionales (BOCYL/DOGV/DOG/BOJA/BOCM) quedan fuera; y una ley puede fingir
// estar verificada poniendo el label sin evidencia (`last_verification_summary`).
//
// Este módulo NO confía en `verification_status` (el label mentiroso). Deriva el
// estado REAL de la EVIDENCIA (`last_verification_summary`) + si hay fuente:
//
//   verified   — summary con is_ok, sin artículos faltantes ni discrepancias
//   incomplete — summary con missing_in_db>0 (o boe_count>db_count): faltan arts
//   issues     — summary con content/title mismatch: contenido divergente
//   never_verified — sin summary (nunca comparada contra fuente)
//   no_source  — no virtual y sin URL de fuente → INVERIFICABLE por construcción
//   false_green — label 'actualizada' pero SIN summary: miente (subcaso alarmante)
//
// FUENTE ÚNICA del criterio. El sweep (scripts/health-sweep.cjs) y el audit
// (scripts/audit-law-completeness.cjs) llevan un mirror inline self-contained;
// mantener EN SYNC — el test fija las fixtures.

export type LawVerificationState =
  | 'verified'
  | 'incomplete'
  | 'issues'
  | 'never_verified'
  | 'no_source'
  | 'false_green'

/** Forma (parcial) de laws.last_verification_summary — solo lo que miramos. */
export interface LawVerificationSummary {
  is_ok?: boolean | null
  boe_count?: number | null
  db_count?: number | null
  missing_in_db?: number | null
  content_mismatch?: number | null
  title_mismatch?: number | null
  /** doc administrativo sin articulado parseable: verificado-por-clasificación. */
  no_consolidated_text?: boolean | null
  /** versión anual sustituida: válida para su ejercicio, no se re-verifica. */
  historical?: boolean | null
}

export interface LawCompletenessInput {
  isVirtual?: boolean | null
  scope?: string | null
  /** URL de la fuente oficial (BOE o boletín autonómico). null = sin fuente. */
  boeUrl?: string | null
  /** el label declarado — NO se confía en él, solo se usa para detectar la mentira. */
  verificationStatus?: string | null
  lastVerificationSummary?: LawVerificationSummary | null
}

export interface LawCompletenessResult {
  /** estado REAL derivado de la evidencia, ignorando el label. */
  state: LawVerificationState
  /** ¿tiene la ley una fuente oficial contra la que verificar? */
  hasSource: boolean
  /** artículos en la fuente que faltan en BD, si se conoce; null si no. */
  missingInDb: number | null
  /** el label decía "actualizada" pero no hay evidencia = falso verde. */
  isFalseGreen: boolean
  /** merece encender el badge / abrir un hallazgo. */
  actionable: boolean
}

function n(x: number | null | undefined): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

/**
 * Clasifica el estado real de verificación de una ley contra su fuente.
 * Determinista y puro: mismas entradas → mismo resultado.
 */
export function classifyLawCompleteness(input: LawCompletenessInput): LawCompletenessResult {
  const isVirtual = input.isVirtual === true
  const hasSource = !!(input.boeUrl && String(input.boeUrl).trim())
  const status = (input.verificationStatus || '').toLowerCase()
  const claimsVerified = status === 'actualizada' || status === 'verificada'
  const su = input.lastVerificationSummary || null

  // Leyes virtuales/contenedores: son editoriales por diseño, no tienen "fuente
  // oficial de N artículos" que comparar (su universo = lo que decida el epígrafe).
  // No entran en este detector (se cubren por el sistema de scope↔epígrafe).
  if (isVirtual) {
    return { state: 'verified', hasSource, missingInDb: null, isFalseGreen: false, actionable: false }
  }

  // Sin evidencia de verificación.
  if (!su) {
    if (claimsVerified) {
      // Miente: dice "actualizada" sin haber comparado con nada.
      return { state: 'false_green', hasSource, missingInDb: null, isFalseGreen: true, actionable: true }
    }
    if (!hasSource) {
      // Inverificable por construcción: ni fuente ni evidencia.
      return { state: 'no_source', hasSource: false, missingInDb: null, isFalseGreen: false, actionable: true }
    }
    return { state: 'never_verified', hasSource, missingInDb: null, isFalseGreen: false, actionable: true }
  }

  // Con evidencia: clasificar por lo que dice el summary.
  // Casos legítimamente cerrados: doc sin articulado parseable, o versión histórica.
  if (su.no_consolidated_text === true || su.historical === true) {
    return { state: 'verified', hasSource, missingInDb: null, isFalseGreen: false, actionable: false }
  }

  const boe = n(su.boe_count)
  const db = n(su.db_count)
  const missing = n(su.missing_in_db) ?? (boe != null && db != null ? Math.max(0, boe - db) : null)
  const contentMismatch = n(su.content_mismatch) ?? 0
  const titleMismatch = n(su.title_mismatch) ?? 0

  if (missing != null && missing > 0) {
    return { state: 'incomplete', hasSource, missingInDb: missing, isFalseGreen: false, actionable: true }
  }
  if (contentMismatch > 0 || titleMismatch > 0) {
    return { state: 'issues', hasSource, missingInDb: missing, isFalseGreen: false, actionable: true }
  }
  return { state: 'verified', hasSource, missingInDb: missing ?? 0, isFalseGreen: false, actionable: false }
}
