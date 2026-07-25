'use strict';
//
// resolveTemarioEfectivo — PURA, sin I/O. Resuelve qué temario_version se sirve para una
// convocatoria (Fase 3 de temario-versionado-por-convocatoria). Espeja la lógica de la vista SQL
// `convocatoria_temario_efectivo` (migración 20260725_temario_efectivo). MANTENER EN SYNC.
//
// Regla (requisito del dueño de producto):
//   1. Si la convocatoria tiene su propia versión SERVIBLE (active|verified) → esa.
//   2. Si no (OEP aprobada sin temario propio, o versión draft) → FALLBACK a la versión default
//      servible más reciente de la oposición (el temario de la convocatoria anterior).
//   3. Si no hay ninguna servible → 'sin_temario' (no se sirve temario sin validar).

const SERVIBLE = new Set(['active', 'verified']);
const esServible = (v) => !!v && SERVIBLE.has(v.estado);

// Clave de recencia estable (verified_at si existe, si no created_at). Strings ISO comparables.
const recencia = (v) => v.verified_at || v.created_at || '';

/**
 * @param {{temario_version_id?: string|null}} convocatoria
 * @param {Array<{id:string, es_default:boolean, estado:string, verified_at?:string, created_at?:string}>} versions
 *        versiones de la oposición de esa convocatoria
 * @returns {{temarioVersionId: string|null, origen: 'propia'|'fallback_anterior'|'sin_temario'}}
 */
function resolveTemarioEfectivo(convocatoria, versions) {
  const vs = Array.isArray(versions) ? versions : [];
  // 1. versión propia servible
  const own = vs.find((v) => v.id === (convocatoria && convocatoria.temario_version_id));
  if (esServible(own)) return { temarioVersionId: own.id, origen: 'propia' };
  // 2. fallback: default servible más reciente
  const fallbacks = vs
    .filter((v) => v.es_default && esServible(v))
    .sort((a, b) => String(recencia(b)).localeCompare(String(recencia(a))));
  if (fallbacks.length) return { temarioVersionId: fallbacks[0].id, origen: 'fallback_anterior' };
  // 3. sin temario servible
  return { temarioVersionId: null, origen: 'sin_temario' };
}

module.exports = { resolveTemarioEfectivo, esServible };
