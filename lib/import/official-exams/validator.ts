// lib/import/official-exams/validator.ts
//
// Validator puro de payloads de importación de preguntas oficiales.
// Diseñado para llamarse ANTES de cada INSERT a `questions` o
// `psychometric_questions` y al INSERT a `question_official_exams`.
//
// Reglas extraídas del manual canónico:
//   docs/maintenance/importar-examen-oficial-completo.md
//
// Cada regla mapea a una sección concreta del manual o a un incidente
// real documentado. Los errores enumerados están pensados para ser
// auto-explicativos en pantalla cuando un script falle pre-INSERT.
//
// IMPORTANTE — qué NO valida y por qué:
//  - Formato literal de `exam_source`: hay 85 variantes legacy en BD
//    (formato moderno + BOE-A-XXXX + super-legacy "Examen oficial").
//    Forzar un patrón rompería import retroactivo.
//  - Estructura concreta de partes por oposición: la conoce
//    `lib/config/oposiciones.ts` (`OPOSICIONES[].officialExams[].partes[].id`).
//    El validator deriva de allí — NO hardcodea "primera"/"segunda".
//  - Vocabulario de `parteId`: abierto. Hoy son {primera, segunda, unica,
//    completo, supuesto, tercer-ejercicio} pero futuras oposiciones
//    podrían usar otros (`cuarto-ejercicio`, `psicotecnico-bloque-a`...).
//
// Este módulo NO toca BD. NO transitiona lifecycle. NO ejecuta INSERTs.
// Solo: recibe payload → devuelve {ok, errors[]}.

import { OPOSICIONES } from '@/lib/config/oposiciones'
import { getValidExamPositions } from '@/lib/config/exam-positions'
import type { LifecycleState } from '@/lib/constants/lifecycleReasons'

// ============================================================================
// TIPOS
// ============================================================================

export type ValidationContext = {
  /** Slug de la oposición (guion). Debe existir en OPOSICIONES. */
  oposicionSlug: string
  /** Fecha del examen en formato 'YYYY-MM-DD'. Debe coincidir con un
   *  `OPOSICIONES[X].officialExams[].date`. */
  examDate: string
  /** ID de la parte. Debe estar declarado en `officialExams[X].partes[].id`
   *  de la convocatoria. Vocabulario actual: 'primera' | 'segunda' | 'unica'
   *  | 'completo' | 'supuesto' | 'tercer-ejercicio'. ABIERTO. */
  parteId: string
}

export type QuestionPayload = {
  exam_position: string
  exam_source: string
  exam_date: string
  is_official_exam?: boolean
  lifecycle_state?: LifecycleState
  primary_article_id?: string | null
  exam_case_id?: string | null
}

export type QOEPayload = {
  exam_date: string
  exam_source: string
  exam_part?: string | null
  oposicion_type: string
  is_reserve?: boolean
}

export type ValidatePayload = {
  question: QuestionPayload
  qoe: QOEPayload
}

export type ValidateResult =
  | { ok: true; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] }

// Regex UUID v4 / sin versión específica (acepta cualquier UUID 8-4-4-4-12)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// ============================================================================
// VALIDATOR PRINCIPAL
// ============================================================================

/**
 * Valida el payload completo antes de INSERTs. Devuelve `ok: true` o lista de
 * errores legibles. NO toca BD.
 *
 * Reglas chequeadas (referencias al manual):
 *  1. Oposición existe en OPOSICIONES               (§4, §9.4 del manual)
 *  2. Convocatoria declarada en officialExams       (§9.4)
 *  3. parteId declarado en convocatoria.partes[]    (§9.4)
 *  4. exam_position en EXAM_POSITION_MAP            (§5.5 + memoria feedback_oposicion_type_slug_convention)
 *  5. QOE.oposicion_type es SLUG (guion)            (§5.5 — incidente 23/05/2026)
 *  6. exam_date coincide entre question y QOE       (consistencia)
 *  7. exam_source coincide entre question y QOE     (consistencia)
 *  8. lifecycle_state inicial es 'draft' o ausente  (§0 anti-patrón Madrid 18/05/2026)
 *  9. is_official_exam = true                       (§5.1)
 * 10. "Supuesto práctico" → exam_case_id presente   (§7.4 + trigger BD 2026-05-19)
 * 11. primary_article_id es UUID válido si presente
 *
 * Warnings (no bloquean import pero deberías saberlos):
 *  - exam_source no contiene ninguno de los marcadores de parte conocidos
 *    ("Primera parte"/"Segunda parte"/"Único ejercicio"/etc.). getExamPart()
 *    en queries.ts:140 actualmente solo reconoce "Primera parte"/"Segunda parte"
 *    — si tu oposición usa otra parte, asegúrate de que el endpoint la sirva.
 */
export function validateOfficialExamImport(
  payload: ValidatePayload,
  ctx: ValidationContext
): ValidateResult {
  const errors: string[] = []
  const warnings: string[] = []

  // ---- 1-3. Oposición + convocatoria + parteId declarados en config ----
  const oposicion = OPOSICIONES.find((o) => o.slug === ctx.oposicionSlug)
  if (!oposicion) {
    errors.push(
      `[CTX-1] Oposición slug='${ctx.oposicionSlug}' no existe en OPOSICIONES (lib/config/oposiciones.ts).`
    )
    // Sin oposición no podemos validar 2-3, devolvemos lo que llevamos
    return { ok: false, errors, warnings }
  }

  const convocatoria = oposicion.officialExams?.find(
    (c) => c.date === ctx.examDate
  )
  if (!convocatoria) {
    const declaradas =
      oposicion.officialExams?.map((c) => c.date).join(', ') ||
      '(ninguna declarada)'
    errors.push(
      `[CTX-2] Convocatoria date='${ctx.examDate}' no declarada en officialExams de '${ctx.oposicionSlug}'. ` +
        `Declaradas: ${declaradas}. Añade entry en lib/config/oposiciones.ts antes de importar (manual §9.4).`
    )
    return { ok: false, errors, warnings }
  }

  const validPartes = convocatoria.partes.map((p) => p.id)
  if (!validPartes.includes(ctx.parteId)) {
    errors.push(
      `[CTX-3] parteId='${ctx.parteId}' no declarado en convocatoria ${ctx.examDate} de '${ctx.oposicionSlug}'. ` +
        `Válidos: [${validPartes.join(', ')}]. Si necesitas una parte nueva, añádela a partes[] en oposiciones.ts.`
    )
  }

  // ---- 4. exam_position en EXAM_POSITION_MAP ----
  const validExamPositions = getValidExamPositions(oposicion.positionType)
  if (validExamPositions.length === 0) {
    errors.push(
      `[Q-4-MAP] positionType='${oposicion.positionType}' no tiene entry en EXAM_POSITION_MAP ` +
        `(lib/config/exam-positions.ts). Añade la oposición allí primero.`
    )
  } else if (!validExamPositions.includes(payload.question.exam_position)) {
    errors.push(
      `[Q-4] exam_position='${payload.question.exam_position}' no es válido para ` +
        `positionType='${oposicion.positionType}'. EXAM_POSITION_MAP espera: ` +
        `[${validExamPositions.join(', ')}]. ` +
        `(Incidente 23/05/2026: import con guion cuando endpoint espera underscore → ` +
        `preguntas invisibles en API. Ver memoria feedback_oposicion_type_slug_convention.)`
    )
  }

  // ---- 5. QOE.oposicion_type debe ser SLUG (guion), no positionType (underscore) ----
  if (payload.qoe.oposicion_type !== ctx.oposicionSlug) {
    if (payload.qoe.oposicion_type === oposicion.positionType) {
      errors.push(
        `[QOE-5] oposicion_type='${payload.qoe.oposicion_type}' es positionType (underscore). ` +
          `question_official_exams espera SLUG con guion ('${ctx.oposicionSlug}'). ` +
          `Convención del manual §5.5: questions.exam_position usa underscore, ` +
          `QOE.oposicion_type y exam_cases.oposicion_type usan guion.`
      )
    } else {
      errors.push(
        `[QOE-5] oposicion_type='${payload.qoe.oposicion_type}' no coincide con el slug ` +
          `de la oposición ('${ctx.oposicionSlug}'). Deben ser idénticos.`
      )
    }
  }

  // ---- 6. exam_date coherente entre question y QOE ----
  if (payload.question.exam_date !== payload.qoe.exam_date) {
    errors.push(
      `[CONS-6] questions.exam_date='${payload.question.exam_date}' ≠ QOE.exam_date='${payload.qoe.exam_date}'`
    )
  }
  if (payload.question.exam_date !== ctx.examDate) {
    errors.push(
      `[CONS-6b] questions.exam_date='${payload.question.exam_date}' ≠ contexto examDate='${ctx.examDate}'`
    )
  }
  if (!ISO_DATE_REGEX.test(payload.question.exam_date)) {
    errors.push(
      `[Q-6c] exam_date='${payload.question.exam_date}' no es ISO YYYY-MM-DD`
    )
  }

  // ---- 7. exam_source coherente entre question y QOE ----
  if (payload.question.exam_source !== payload.qoe.exam_source) {
    errors.push(
      `[CONS-7] questions.exam_source ≠ QOE.exam_source. ` +
        `Deben ser idénticos para que el join sea consistente.`
    )
  }
  if (!payload.question.exam_source || payload.question.exam_source.length < 10) {
    errors.push(
      `[Q-7b] exam_source vacío o demasiado corto. Patrón recomendado del manual §5.2: ` +
        `"Examen <Cuerpo> - OEP <año> - Convocatoria <fecha> - <Parte>".`
    )
  }

  // ---- 8. lifecycle_state inicial: solo 'draft' o ausente (default draft) ----
  if (
    payload.question.lifecycle_state &&
    payload.question.lifecycle_state !== 'draft'
  ) {
    errors.push(
      `[Q-8] lifecycle_state='${payload.question.lifecycle_state}' al INSERT viola §0 manual ` +
        `("importar draft, activar tras verificación"). Anti-patrón Madrid 18/05/2026: ` +
        `importar approved/tech_approved directo obliga a parche retroactivo vía needs_review. ` +
        `Deja el campo ausente (default draft) y deja que el pipeline §8.3 transicione tras IA.`
    )
  }

  // ---- 9. is_official_exam = true ----
  if (payload.question.is_official_exam === false) {
    errors.push(
      `[Q-9] is_official_exam=false. Para preguntas de examen oficial debe ser true.`
    )
  }

  // ---- 10. "Supuesto práctico" en exam_source → exam_case_id obligatorio ----
  if (/supuesto\s+pr[áa]ctico/i.test(payload.question.exam_source)) {
    if (!payload.question.exam_case_id) {
      errors.push(
        `[Q-10] exam_source contiene "Supuesto práctico" pero exam_case_id=null. ` +
          `Trigger BD (2026-05-19) lo rechazará al activar. Crea fila en exam_cases primero ` +
          `(manual §7.4) y referencia su id aquí.`
      )
    } else if (!UUID_REGEX.test(payload.question.exam_case_id)) {
      errors.push(
        `[Q-10b] exam_case_id='${payload.question.exam_case_id}' no es UUID válido`
      )
    }
  }

  // ---- 11. primary_article_id válido si presente ----
  if (
    payload.question.primary_article_id &&
    !UUID_REGEX.test(payload.question.primary_article_id)
  ) {
    errors.push(
      `[Q-11] primary_article_id='${payload.question.primary_article_id}' no es UUID válido`
    )
  }

  // ---- WARNINGS (no bloquean) ----
  // getExamPart() en queries.ts:140 hoy solo reconoce "Primera parte"/"Segunda parte".
  // Si tu oposición usa otra parte, el filtro fallará silenciosamente. Avisar.
  const tienesMarcadorParte =
    /primera\s+parte|segunda\s+parte|único\s+ejercicio|primer\s+ejercicio|segundo\s+ejercicio|tercer\s+ejercicio|supuesto\s+pr[áa]ctico/i.test(
      payload.question.exam_source
    )
  if (!tienesMarcadorParte) {
    warnings.push(
      `[W-EXAMSOURCE] exam_source no contiene ningún marcador de parte conocido ` +
        `("Primera parte"/"Segunda parte"/"Tercer ejercicio"/"Único ejercicio"/etc.). ` +
        `getExamPart() en lib/api/official-exams/queries.ts:140 solo reconoce ` +
        `"Primera parte" y "Segunda parte" — si la API filtra por ?parte=X, esta pregunta ` +
        `puede no aparecer. Verifica el endpoint antes de cerrar el import.`
    )
  }

  return errors.length === 0
    ? { ok: true, warnings }
    : { ok: false, errors, warnings }
}

// ============================================================================
// HELPERS AUXILIARES (exports para tests o usos puntuales)
// ============================================================================

/**
 * Devuelve los parteId válidos para una (oposicion, fecha). Útil para
 * que los scripts de import construyan su propio menú de selección.
 */
export function getValidParteIds(
  oposicionSlug: string,
  examDate: string
): string[] {
  const oposicion = OPOSICIONES.find((o) => o.slug === oposicionSlug)
  if (!oposicion) return []
  const conv = oposicion.officialExams?.find((c) => c.date === examDate)
  if (!conv) return []
  return conv.partes.map((p) => p.id)
}

/**
 * Devuelve la convocatoria declarada en config o null. Útil para que
 * el script de import lea metadatos (oep, title, partes[]) en vez de
 * hardcodearlos.
 */
export function findConvocatoria(oposicionSlug: string, examDate: string) {
  const oposicion = OPOSICIONES.find((o) => o.slug === oposicionSlug)
  if (!oposicion) return null
  return (
    oposicion.officialExams?.find((c) => c.date === examDate) ?? null
  )
}
