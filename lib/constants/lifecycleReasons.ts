// lib/constants/lifecycleReasons.ts
// Taxonomía cerrada del lifecycle de preguntas. Espejo 1:1 del state machine
// definido en SQL (transition_question_state, CHECK constraint en questions.lifecycle_state).
// Roadmap: docs/roadmap/sistema-desactivacion-preguntas.md

// ============================================================================
// LIFECYCLE STATES
// ============================================================================

export const LIFECYCLE_STATES = [
  'draft',
  'needs_review',
  'needs_human',
  'quarantine',
  'approved',
  'tech_approved',
  'retired_duplicate',
  'retired_irreparable',
] as const

export type LifecycleState = (typeof LIFECYCLE_STATES)[number]

/** Estados que hacen visible la pregunta a estudiantes (= is_active=true post fase E). */
export const VISIBLE_STATES: readonly LifecycleState[] = ['approved', 'tech_approved'] as const

/** Estados terminales: no admiten transición de salida. Si una "retired" resulta recuperable, crear pregunta nueva. */
export const TERMINAL_STATES: readonly LifecycleState[] = ['retired_duplicate', 'retired_irreparable'] as const

export function isVisibleState(s: LifecycleState): boolean {
  return (VISIBLE_STATES as readonly string[]).includes(s)
}

export function isTerminalState(s: LifecycleState): boolean {
  return (TERMINAL_STATES as readonly string[]).includes(s)
}

// ============================================================================
// TRANSICIONES LEGALES (espejo del bloque IF en transition_question_state)
// ============================================================================

const LEGAL_TRANSITIONS: Record<LifecycleState, readonly LifecycleState[]> = {
  draft: ['needs_review', 'needs_human', 'approved', 'tech_approved', 'quarantine', 'retired_duplicate', 'retired_irreparable'],
  needs_review: ['approved', 'tech_approved', 'needs_human', 'retired_duplicate', 'retired_irreparable'],
  needs_human: ['approved', 'tech_approved', 'needs_review', 'retired_duplicate', 'retired_irreparable'],
  quarantine: ['draft', 'retired_irreparable'],
  approved: ['needs_review', 'needs_human', 'draft', 'retired_duplicate', 'retired_irreparable'],
  tech_approved: ['needs_review', 'needs_human', 'draft', 'retired_duplicate', 'retired_irreparable'],
  retired_duplicate: [],
  retired_irreparable: [],
}

/** Validación cliente-side de transiciones. La BD enforce esto también vía función SQL. */
export function isLegalTransition(from: LifecycleState, to: LifecycleState): boolean {
  if (from === to) return false
  return (LEGAL_TRANSITIONS[from] as readonly string[]).includes(to)
}

// ============================================================================
// REASON CODES (taxonomía cerrada)
// ============================================================================
// Cada código tiene: label en español + estado destino típico (informativo, no enforcing)

export const LIFECYCLE_REASONS = {
  // Sistema (se emiten automáticamente)
  created:                          { label: 'Pregunta creada',                              typicalTarget: 'draft' },
  imported_unreviewed:              { label: 'Importada sin verificar',                      typicalTarget: 'draft' },
  backfill_2026_05:                 { label: 'Backfill inicial 2026-05',                     typicalTarget: null },
  bypass_detected:                  { label: '⚠️ UPDATE directo detectado por trigger fallback', typicalTarget: null },

  // IA (se emiten desde verify endpoint)
  ai_verified_perfect:              { label: 'IA verificó: perfect',                         typicalTarget: 'approved' },
  ai_verified_tech_perfect:         { label: 'IA verificó: tech_perfect',                    typicalTarget: 'tech_approved' },
  ai_detected_bad_explanation:      { label: 'IA detectó: explicación incorrecta',           typicalTarget: 'needs_review' },
  ai_detected_bad_answer:           { label: 'IA detectó: respuesta incorrecta',             typicalTarget: 'needs_review' },
  ai_detected_bad_answer_and_explanation: { label: 'IA detectó: respuesta y explicación incorrectas', typicalTarget: 'needs_review' },
  ai_detected_wrong_article:        { label: 'IA detectó: artículo vinculado incorrecto',    typicalTarget: 'needs_human' },
  ai_detected_all_wrong:            { label: 'IA detectó: todo incorrecto',                  typicalTarget: 'needs_human' },
  ai_detected_tech_bad_explanation: { label: 'IA detectó: explicación incorrecta (informática)', typicalTarget: 'needs_review' },
  ai_detected_tech_bad_answer:      { label: 'IA detectó: respuesta incorrecta (informática)', typicalTarget: 'needs_review' },
  ai_detected_tech_bad_answer_and_explanation: { label: 'IA detectó: respuesta y explicación incorrectas (informática)', typicalTarget: 'needs_review' },
  structural_invalid:               { label: 'Validación estructural: opciones/correct_option inválidos', typicalTarget: 'quarantine' },

  // Admin manual (se emiten desde panel)
  admin_marked_perfect:             { label: 'Admin: marcada como perfect',                  typicalTarget: 'approved' },
  admin_marked_problem:             { label: 'Admin: marcada con problema',                  typicalTarget: 'needs_human' },
  admin_image_unavailable:          { label: 'Admin: imagen no disponible',                  typicalTarget: 'retired_irreparable' },
  admin_duplicate_of:               { label: 'Admin: duplicada de otra (ver notes)',         typicalTarget: 'retired_duplicate' },
  admin_law_derogated:              { label: 'Admin: ley derogada',                          typicalTarget: 'retired_irreparable' },
  admin_exam_annulled:              { label: 'Admin: pregunta anulada en examen oficial',    typicalTarget: 'retired_irreparable' },
  admin_repaired_quarantine:        { label: 'Admin: estructural reparada',                  typicalTarget: 'draft' },

  // Pipelines automatizados
  auto_fix_applied:                 { label: 'Pipeline batch-fix: aplicó explanation_fix',   typicalTarget: 'approved' },
  cron_legacy_grandfather_expired:  { label: 'Cron 90d: legacy approved sin verificar → draft', typicalTarget: 'draft' },
} as const

export type LifecycleReasonCode = keyof typeof LIFECYCLE_REASONS

export const LIFECYCLE_REASON_CODES = Object.keys(LIFECYCLE_REASONS) as readonly LifecycleReasonCode[]

export function isValidReasonCode(code: string): code is LifecycleReasonCode {
  return code in LIFECYCLE_REASONS
}

export function reasonLabel(code: string): string {
  return isValidReasonCode(code) ? LIFECYCLE_REASONS[code].label : code
}

// ============================================================================
// UI HELPERS
// ============================================================================

/** Colores y emojis para badges en admin panel (espejo de §6 del manual revisar-temas). */
export const STATE_BADGE: Record<LifecycleState, { color: string; emoji: string; label: string }> = {
  draft:               { color: 'gray',   emoji: '⏳', label: 'Sin revisar' },
  needs_review:        { color: 'yellow', emoji: '📝', label: 'Necesita arreglo (con fix sugerido)' },
  needs_human:         { color: 'orange', emoji: '👤', label: 'Requiere decisión humana' },
  quarantine:          { color: 'purple', emoji: '🔧', label: 'Estructural roto (reparable)' },
  approved:            { color: 'green',  emoji: '✅', label: 'Visible' },
  tech_approved:       { color: 'cyan',   emoji: '💻✅', label: 'Visible (informática)' },
  retired_duplicate:   { color: 'gray',   emoji: '🗑️', label: 'Jubilada (duplicada)' },
  retired_irreparable: { color: 'red',    emoji: '⛔', label: 'Jubilada (irrecuperable)' },
}

// ============================================================================
// LEGACY MAPPING (espejo de las reglas de backfill, fase B §5 del roadmap)
// ============================================================================
// Para que código nuevo que reciba un topic_review_status legacy (string) pueda
// derivar el lifecycle_state correspondiente sin reimplementar las reglas SQL.

/**
 * Mapeo de legacy `topic_review_status` → transición a lifecycle. Usar SOLO desde
 * los writers existentes (verify endpoint + updateQuestionStatus) durante fase D.
 * Devuelve null si el status no implica transición (ej. 'pending' = no-op).
 *
 * `source` decide el reason_code: 'ai' (verificación IA) vs 'admin' (panel manual).
 */
export function legacyStatusToTransition(
  legacyStatus: string,
  source: 'ai' | 'admin',
): { newState: LifecycleState; reasonCode: LifecycleReasonCode } | null {
  const map: Record<string, LifecycleState> = {
    perfect: 'approved',
    tech_perfect: 'tech_approved',
    bad_explanation: 'needs_review',
    bad_answer: 'needs_review',
    bad_answer_and_explanation: 'needs_review',
    tech_bad_explanation: 'needs_review',
    tech_bad_answer: 'needs_review',
    tech_bad_answer_and_explanation: 'needs_review',
    wrong_article: 'needs_human',
    wrong_article_bad_explanation: 'needs_human',
    wrong_article_bad_answer: 'needs_human',
    all_wrong: 'needs_human',
    invalid_structure: 'quarantine',
    needs_review: 'needs_human',  // legacy "needs_review" status = ambiguo, requiere humano
  }
  const newState = map[legacyStatus]
  if (!newState) return null  // 'pending' u otros = no-op

  let reasonCode: LifecycleReasonCode
  if (source === 'ai') {
    if (newState === 'approved') reasonCode = 'ai_verified_perfect'
    else if (newState === 'tech_approved') reasonCode = 'ai_verified_tech_perfect'
    else if (newState === 'quarantine') reasonCode = 'structural_invalid'
    else {
      // ai_detected_<status>; usar el status legacy específico para máxima información
      const aiCode = `ai_detected_${legacyStatus}` as LifecycleReasonCode
      reasonCode = isValidReasonCode(aiCode) ? aiCode : 'ai_detected_bad_explanation'
    }
  } else {
    reasonCode = newState === 'approved' || newState === 'tech_approved'
      ? 'admin_marked_perfect'
      : 'admin_marked_problem'
  }

  return { newState, reasonCode }
}

export function legacyStatusToLifecycle(
  legacyStatus: string | null,
  isActive: boolean,
  deactivationReason: string | null,
): LifecycleState | null {
  // Reproducción simplificada del CASE de backfill. Si esta función diverge del
  // SQL, hay un bug. Los tests deben asegurar paridad.

  if (legacyStatus && ['perfect', 'verified', 'verificado', 'verified_ok', 'reviewed', 'approved', 'ai_verified'].includes(legacyStatus)) {
    return isActive ? 'approved' : 'needs_human'  // decisión #2: deact-perfecta no se reactiva
  }
  if (legacyStatus === 'tech_perfect') {
    return isActive ? 'tech_approved' : 'needs_human'
  }
  if (!legacyStatus || legacyStatus === 'pending') {
    return isActive ? 'approved' : 'draft'  // decisión #1 (active legacy grandfather) o #3 (deact orphan)
  }
  if (['bad_explanation', 'bad_answer', 'bad_answer_and_explanation', 'tech_bad_explanation', 'tech_bad_answer', 'tech_bad_answer_and_explanation', 'wrong_answer'].includes(legacyStatus)) {
    return 'needs_review'
  }
  if (['wrong_article', 'wrong_article_bad_answer', 'all_wrong', 'bad_article', 'out_of_scope', 'ambiguous', 'unverifiable', 'flagged', 'defective', 'tech_pending_adaptation', 'needs_review', 'deactivated', 'error', 'has_errors', 'discarded'].includes(legacyStatus)) {
    return 'needs_human'
  }
  if (['invalid_structure', 'bad_options'].includes(legacyStatus)) {
    return 'quarantine'
  }
  if (['rejected', 'outdated'].includes(legacyStatus)) {
    return 'retired_irreparable'
  }
  return null
}
