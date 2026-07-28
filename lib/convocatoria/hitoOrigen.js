// lib/convocatoria/hitoOrigen.js — ¿el `origen` de un hito dice la verdad?
//
// ## Por qué existe (T-256, 28/07/2026)
//
// `convocatoria_hitos.origen` NO es documentación: **el render decide con él**. Un hito
// `registro` (= fecha REAL registrada) se MUESTRA; uno `estimacion` se oculta desde el 20/07
// precisamente para no vender una previsión como oficial.
//
// Medido: de **960** hitos `registro`, **642 (67%)** no tienen NI url, NI `cita_literal`, NI
// `source_documento_id`. Caso verificado contra dos fuentes: el Ayto. de Huesca anuncia
// "Primer ejercicio (examen) → 01/11/2026" en nuestra landing y **ni el Ayuntamiento ni el
// BOE han publicado fecha alguna**. Al opositor se le enseña como oficial un dato inventado.
//
// ## La regla de seguridad, que es el motivo de que esto sea un módulo y no un `UPDATE`
//
// **«Sin respaldo» NO significa «inventada».** Muchos cierres de plazo derivan de
// `inscription_deadline`, que sí está verificado en la convocatoria: les falta la CITA, no la
// verdad (eso es provenance, T-147). Degradarlos en bloque sería cambiar un error por otro.
//
// Por eso solo se degrada AUTOMÁTICAMENTE lo que se delata solo:
//   · el hito cuyo TÍTULO dice que es una previsión mientras el campo afirma `registro`
//     (contradicción interna: no hace falta ir a ningún boletín para verla).
// Todo lo demás sale como `requiere_fuente`: hay que mirarlo contra su boletín y, si se
// confirma que no consta, degradarlo con `--verificado` y su motivo por escrito.

/** Estados de origen que maneja el modelo. `registro` es el único que el render muestra. */
const ORIGENES = ['registro', 'estimacion', 'inferencia']

/**
 * Títulos que confiesan ser una previsión. Se busca en el TÍTULO porque es lo que el equipo
 * escribe en cristiano cuando sabe que la fecha es un marcador — y es lo único que permite
 * afirmar "esto no es un registro" sin salir de nuestros datos.
 */
const RE_TITULO_PREVISION = /previsi[óo]n|pendiente de fecha oficial|estimad[oa]|orientativ[oa]|aproximad[oa]/i

/** ¿El hito trae ALGO que respalde su fecha? */
function tieneRespaldo(hito) {
  return Boolean(
    (hito.url && String(hito.url).trim()) ||
    (hito.cita_literal && String(hito.cita_literal).trim()) ||
    hito.source_documento_id,
  )
}

/**
 * Clasifica qué hacer con un hito.
 *
 * @returns {{accion: 'dejar'|'degradar'|'requiere_fuente', motivo: string}}
 *   · `dejar`            — o no es `registro`, o tiene respaldo: no hay nada que discutir.
 *   · `degradar`         — se contradice a sí mismo; se puede degradar SIN ir al boletín.
 *   · `requiere_fuente`  — sospechoso, pero NO se toca sin verificar contra el boletín.
 */
function clasificarHito(hito) {
  if (!hito || !ORIGENES.includes(hito.origen)) {
    return { accion: 'dejar', motivo: 'origen desconocido o no aplicable' }
  }
  if (hito.origen !== 'registro') {
    return { accion: 'dejar', motivo: `origen '${hito.origen}': el render ya no lo presenta como oficial` }
  }
  if (tieneRespaldo(hito)) {
    return { accion: 'dejar', motivo: 'registro CON respaldo (url, cita o documento)' }
  }
  if (RE_TITULO_PREVISION.test(hito.titulo || '')) {
    return {
      accion: 'degradar',
      motivo: 'el título dice que es una previsión y el campo afirma `registro`: se contradice solo',
    }
  }
  return {
    accion: 'requiere_fuente',
    motivo: 'registro SIN respaldo: puede ser una fecha real sin cita (provenance) o una inventada — verificar contra su boletín ANTES de tocarla',
  }
}

/**
 * ¿Es este hito de los que más daño hacen? Fecha de EJERCICIO/EXAMEN, futura y sin respaldo:
 * es el dato por el que un opositor organiza meses de estudio.
 */
const RE_TITULO_EXAMEN = /ejercicio|examen|prueba/i
function esFechaDeExamen(hito) {
  return RE_TITULO_EXAMEN.test(hito?.titulo || '')
}

module.exports = {
  ORIGENES,
  RE_TITULO_PREVISION,
  tieneRespaldo,
  clasificarHito,
  esFechaDeExamen,
}
