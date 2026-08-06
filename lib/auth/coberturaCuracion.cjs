'use strict'
// lib/auth/coberturaCuracion.cjs — ¿alguna señal de cura ya vio a este usuario? (T-633)
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
// Tres mecanismos, cada uno nacido en su propio momento de [T-434], curan o marcan a un usuario
// que rebota con «Usuario no existe»: `auth_perfil_recuperado` (el reintento del servidor,
// 01/08), `sesion_fantasma_soltada` (limpieza cliente de una sesión sin token, 04/08) y
// `auth_identidad_ajena_descartada` (limpieza cliente de un id ajeno arrastrado del
// localStorage, 05/08). Ninguno se diseñó pensando en los otros dos, y nadie había comprobado
// si sus UNIONES cubren a todo el mundo que rebota — o si queda gente cayendo entre las tres
// redes a la vez.
//
// ── MEDIDO EL 06/08/2026 (T-633) — NO cubren a todos ────────────────────────────────────────
// De 49 usuarios con «Usuario no existe» en 48 h, **29 (59 %) no tienen NINGUNA de las tres
// señales** en la misma ventana. De 104 en 7 días, incluye a `140ef91a`, el caso que motivó la
// ficha original de [T-434] el 30/07. Sus eventos mezclan peticiones con `userIdVerified=true`
// y `=false` DENTRO DE LA MISMA SESIÓN (no es una identidad ajena estable que limpiar de una
// vez) y algunos traen `"Session expired (no access_token)"` — un patrón que ninguno de los
// tres mecanismos existentes contempla. NO se ha identificado la causa exacta: esto solo hace
// el HUECO observable, no lo explica ni lo arregla.

/**
 * @param {string[]} afectados  user_id con 'Usuario no existe' en la ventana
 * @param {string[]} curados    user_id con CUALQUIERA de las tres señales de cura, misma ventana
 * @returns {string[]} afectados que ninguna señal existente ha visto — sin duplicados
 */
function sinNingunaCobertura(afectados, curados) {
  const setCurados = new Set(curados || [])
  return [...new Set(afectados || [])].filter((id) => !setCurados.has(id))
}

module.exports = { sinNingunaCobertura }
