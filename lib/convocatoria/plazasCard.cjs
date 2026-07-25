// lib/convocatoria/plazasCard.cjs
// Núcleo PURO: qué números puede mostrar legítimamente una TARJETA de "plazas" de una landing.
//
// POR QUÉ EXISTE (falso positivo real, 26/07): el gate `audit:coherencia` marcaba en ROJO
// `administrativo-aragon` — la tarjeta dice "144 plazas convocadas" y la convocatoria tenía
// libres=139, discapacidad=0, promoción=0. Pero el BOA nº 247 de 23/12/2025 (Anexo I, código
// 250102) convoca literalmente «144 (3 reservadas a víctimas de violencia de género, 1
// reservada a víctimas de terrorismo y 1 reservada a personas transexuales)»: la tarjeta era
// CORRECTA y el detector estaba ciego a `plazas_otros_turnos` (jsonb con esas reservas
// especiales, que NO son libre/discapacidad/PI pero SÍ suman al total convocado).
//
// El mirror del backend (content-health-sweep.service.ts) ya sumaba `O`; el script del gate se
// había quedado atrás. Este núcleo es la fuente única para que no vuelvan a divergir, y hace
// citable la regla: un falso rojo en el gate cuesta tanto como un fallo no detectado, porque
// enseña a ignorar el gate.

/**
 * Suma las plazas de `plazas_otros_turnos` (jsonb: [{turno, plazas, cita, documento}, ...]).
 * Tolera null/no-array/entradas sin `plazas`, porque el dato viene de BD sin garantía de forma.
 * @param {unknown} otros
 * @returns {number}
 */
function sumaOtrosTurnos(otros) {
  if (!Array.isArray(otros)) return 0
  return otros.reduce((acc, t) => acc + (Number(t && t.plazas) || 0), 0)
}

/**
 * Números que una tarjeta de "plazas" puede mostrar sin estar stale: cualquier turno suelto
 * (incluidas las reservas especiales, una a una) y cualquier SUMA de turnos — hasta el total
 * convocado. Deliberadamente permisivo con las COMBINACIONES y estricto con los números que
 * no salen de la convocatoria: lo que caza es el dato hardcodeado que se quedó viejo
 * (la FAQ dice 46 cuando la convocatoria da 42), no la elección de qué turno destacar.
 *
 * @param {{libres?:number|null, discapacidad?:number|null, promocionInterna?:number|null, otrosTurnos?:unknown}} c
 * @returns {Set<number>} valores > 0 admisibles
 */
function combinacionesValidasPlazas(c) {
  const L = Number((c && c.libres) || 0)
  const D = Number((c && c.discapacidad) || 0)
  const P = Number((c && c.promocionInterna) || 0)
  const O = sumaOtrosTurnos(c && c.otrosTurnos)

  const validos = new Set()
  // subconjuntos de {L, D, P, O}: 15 sumas posibles (el vacío no cuenta)
  for (let mask = 1; mask < 16; mask++) {
    const suma =
      (mask & 1 ? L : 0) + (mask & 2 ? D : 0) + (mask & 4 ? P : 0) + (mask & 8 ? O : 0)
    if (suma > 0) validos.add(suma)
  }
  // cada reserva especial por separado ("3 plazas reservadas a violencia de género")
  if (Array.isArray(c && c.otrosTurnos)) {
    for (const t of c.otrosTurnos) {
      const n = Number(t && t.plazas) || 0
      if (n > 0) validos.add(n)
    }
  }
  return validos
}

module.exports = { sumaOtrosTurnos, combinacionesValidasPlazas }
