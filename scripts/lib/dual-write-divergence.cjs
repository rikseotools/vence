'use strict'
/**
 * dual-write-divergence.cjs — PURO (sin BD, sin IO) → testeable.
 *
 * Detecta DIVERGENCIA DE VALORES entre la fila legacy `oposiciones` y su
 * convocatoria vigente (`convocatorias` is_current) en los campos que gobierna la
 * convocatoria SSOT (§4g-bis: dual-write). Complementa al check de dual-write
 * INCOMPLETO (campos NULL en la convocatoria): aquí ambos lados tienen valor y
 * DISCREPAN → los lectores legacy (advance-estado, auditores) ven un estado
 * distinto del que la vista `oposiciones_ssot` sirve al front.
 *
 * Por qué existe (24/07/2026): la fila catalogada `tecnico-grado-medio-universidad-
 * de-jaen` tenía la convocatoria en `inscripcion_abierta` (2 plazas) pero la legacy
 * seguía en `oep_aprobada` (plazas NULL) — un dual-write a medias que ningún gate
 * veía. Un barrido destapó 69 casos (bidireccionales: a veces adelanta la
 * convocatoria, a veces la legacy). Este detector los vuelve visibles/tracked; la
 * ADJUDICACIÓN (qué store refleja la realidad) es humana contra fuente oficial,
 * NUNCA copiar en bloque (regresaría los casos en que la legacy va por delante).
 */

// Campos gobernados por la convocatoria SSOT (los que `oposiciones_ssot` resuelve
// desde la convocatoria vigente). Si legacy y convocatoria discrepan, hay drift.
const SSOT_FIELDS = [
  'estado_proceso',
  'plazas_libres',
  'plazas_discapacidad',
  'plazas_promocion_interna',
  'inscription_start',
  'inscription_deadline',
  'exam_date',
]

// Normaliza a un escalar comparable: Date → 'YYYY-MM-DD' (UTC = la fecha
// almacenada, sin el shift de TZ del footgun de pg), número → string, string
// vacío → null. Así dos `date` iguales no fallan por ser objetos Date distintos.
function norm(v) {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') return String(v)
  const s = String(v).trim()
  return s === '' ? null : s
}

/**
 * @param {object} oposicion   fila legacy `oposiciones`
 * @param {object} convocatoria fila `convocatorias` is_current
 * @param {string[]} [fields]   campos a comparar (default SSOT_FIELDS)
 * @returns {Array<{field, legacy, convocatoria}>}  solo los que DISCREPAN con
 *          ambos lados no-null (el hueco NULL lo cubre el check de "incompleto").
 */
function dualWriteDivergences(oposicion, convocatoria, fields) {
  if (!oposicion || !convocatoria) return []
  const out = []
  for (const f of fields || SSOT_FIELDS) {
    const a = norm(oposicion[f])
    const b = norm(convocatoria[f])
    if (a == null || b == null) continue // NULL en un lado = hueco, no divergencia
    if (a !== b) out.push({ field: f, legacy: a, convocatoria: b })
  }
  return out
}

module.exports = { dualWriteDivergences, norm, SSOT_FIELDS }
