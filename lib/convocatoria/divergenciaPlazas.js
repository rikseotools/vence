'use strict'
//
// divergenciaPlazas — NÚCLEO PURO: explica POR QUÉ divergen las plazas entre la fila legacy
// `oposiciones` y su convocatoria vigente, cuando la causa es la reserva de discapacidad.
//
// POR QUÉ EXISTE (26/07/2026, T-105). De las 20 oposiciones publicadas con `plazas_libres`
// divergente, la inmensa mayoría no discrepan en el DATO sino en la SEMÁNTICA: si la reserva
// de discapacidad va **dentro** de las plazas de turno libre o **aparte**. El boletín lo dice
// de las dos maneras según la administración:
//
//   · «cubrir cincuenta y cuatro plazas […] Del total de las plazas se reservan dos»  → DENTRO
//   · «Dieciocho plazas […] en turno libre. Dos plazas […] en turno reservado»        → APARTE
//
// La convocatoria guarda ese matiz en `plazas_discapacidad_incluidas`; la fila legacy no lo
// tiene, así que a veces guarda el TOTAL y a veces el turno general, y de ahí la divergencia.
//
// Reconocer la ARITMÉTICA convierte 20 juicios a ojo en unos cuantos deterministas más los
// que de verdad hay que mirar. Y eso importa porque el error de bulto aquí es tentador:
// «la legacy siempre está stale, cópiala» — que en T-105 ya se demostró falso (salió 7-7 en
// `estado_proceso`). Aquí no se afirma que gane la convocatoria porque sí, sino porque la
// diferencia se EXPLICA exactamente por la reserva que la convocatoria sí sabe clasificar.

/**
 * @param {object} p
 * @param {number|null} p.legacy    `oposiciones.plazas_libres`
 * @param {number|null} p.conv      `convocatorias.plazas_libres`
 * @param {number|null} [p.discapacidad]      `convocatorias.plazas_discapacidad`
 * @param {number|null} [p.promocionInterna]  `convocatorias.plazas_promocion_interna`
 * @param {boolean|null} [p.incluidas]        `convocatorias.plazas_discapacidad_incluidas`
 * @returns {{patron:'iguales'|'legacy_suma_reserva'|'legacy_resta_reserva'|'legacy_es_total'|'sin_patron',
 *            ganaConvocatoria:boolean, explicacion:string}}
 *
 * `ganaConvocatoria` es `true` SOLO cuando la aritmética explica la diferencia. En
 * `sin_patron` es `false`: no significa que gane la legacy, significa **que hay que leer la
 * cita del boletín**, que es justo lo que este núcleo no puede hacer.
 */
function clasificarDivergenciaPlazas(p) {
  // Este núcleo razona sobre el TURNO LIBRE: todas sus reglas son «cuántas plazas de turno
  // libre hay, contando o no la reserva». Aplicarlo a `plazas_discapacidad` o a
  // `plazas_promocion_interna` produce disparates con pinta de veredicto — al cablearlo al
  // detector soltó «la legacy guarda el turno general (88 convocadas − 88 reservadas = 0)»
  // comparando el campo de discapacidad consigo mismo. Se rechaza aquí, y no en el
  // llamante, para que ningún otro sitio pueda repetir el error.
  if (p.campo !== undefined && p.campo !== 'plazas_libres') {
    return { patron: 'sin_patron', ganaConvocatoria: false, explicacion: `este criterio solo vale para plazas_libres, no para ${p.campo}` }
  }
  const n = (x) => (x === null || x === undefined || x === '' ? null : Number(x))
  const legacy = n(p.legacy)
  const conv = n(p.conv)
  const disc = n(p.discapacidad) || 0
  const pi = n(p.promocionInterna) || 0

  if (legacy === null || conv === null) {
    return { patron: 'sin_patron', ganaConvocatoria: false, explicacion: 'falta uno de los dos valores' }
  }
  if (legacy === conv) return { patron: 'iguales', ganaConvocatoria: false, explicacion: 'no divergen' }

  // La reserva va APARTE y la legacy guardó el total (turno libre + reserva).
  if (p.incluidas === false && disc > 0 && legacy === conv + disc) {
    return {
      patron: 'legacy_suma_reserva',
      ganaConvocatoria: true,
      explicacion: `la legacy guarda el TOTAL (${conv} de turno libre + ${disc} de reserva = ${legacy}); el boletín reserva esas plazas APARTE, así que las de turno libre son ${conv}`,
    }
  }

  // La reserva va DENTRO y la legacy la restó, quedándose con el turno general.
  if (p.incluidas === true && disc > 0 && legacy === conv - disc) {
    return {
      patron: 'legacy_resta_reserva',
      ganaConvocatoria: true,
      explicacion: `la legacy guarda el turno general (${conv} convocadas − ${disc} reservadas = ${legacy}); el boletín reserva DENTRO del total, así que las convocadas son ${conv}`,
    }
  }

  // La legacy guarda el total del proceso entero. OJO con la semántica de la reserva: si va
  // DENTRO ya está contada en `conv`, así que sumarla otra vez sería contarla dos veces. Sin
  // esta distinción, un `legacy = conv + reserva` con la reserva dentro pasaba por "total"
  // siendo en realidad un dato incoherente que hay que mirar (lo cazó su test).
  const sumandos = p.incluidas === true ? [pi] : [disc, pi]
  const total = sumandos.reduce((a, b) => a + b, conv)
  if (legacy === total && sumandos.some((x) => x > 0)) {
    const desglose = p.incluidas === true ? `${conv} turno libre + ${pi} promoción interna` : `${conv} libre + ${disc} discapacidad + ${pi} promoción interna`
    return {
      patron: 'legacy_es_total',
      ganaConvocatoria: true,
      explicacion: `la legacy guarda el total del proceso (${desglose} = ${legacy}); \`plazas_libres\` es solo el turno libre`,
    }
  }

  return {
    patron: 'sin_patron',
    ganaConvocatoria: false,
    explicacion: `la diferencia (${legacy} vs ${conv}) no se explica por la reserva: hay que leer la cita del boletín`,
  }
}

module.exports = { clasificarDivergenciaPlazas }
