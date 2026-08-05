'use strict'
/**
 * siguienteId.cjs — qué número le toca a la próxima ficha del backlog. (T-563)
 *
 * ## Por qué esto es una función y no una línea dentro del script
 *
 * `backlog.cjs reserve` calculaba el siguiente id así:
 *
 *     parseInt(String(r.id).replace(/\D/g, ''), 10)   // sobre TODOS los ids
 *
 * Quitarle los no-dígitos a **cualquier** id significa que un id que no tenga la forma `T-NNN`
 * también vota. El 05/08/2026 la tabla tenía una fila de canario llamada **`CANARY-coord-20450`**
 * (la escribe el canario del rol de coordinación, no una persona), que se leyó como **20450** —
 * y la ficha siguiente nació como **`T-20451`**, a veinte mil de la serie.
 *
 * **Y no falló nada**, que es lo que lo hacía peligroso: la unicidad la garantiza la PK, así que
 * el `INSERT` fue correcto. El backlog simplemente habría seguido en T-20452, T-20453… hasta que
 * alguien mirase la lista y se preguntara qué había pasado. Un cálculo que se equivoca **sin
 * romperse** es el que nadie descubre.
 *
 * La regla, por tanto: **solo votan los ids que SON de la serie.** Cualquier otra cosa en la tabla
 * —canarios, reservas de herramientas, lo que venga— es invisible para la numeración.
 */

/** La forma canónica de un id de ficha. Todo lo demás no participa en la numeración. */
const RE_ID = /^T-(\d+)$/

/**
 * @param {Array<string|{id:string}>} ids  filas o ids de `backlog_tasks`
 * @returns {{siguiente: string, maximo: number, ignorados: string[]}}
 *   `ignorados` no es adorno: es lo que permite ver, al depurar, QUÉ había en la tabla que no
 *   era una ficha — que es justo el dato que faltaba el día que apareció el T-20451.
 */
function siguienteId(ids) {
  const lista = (ids || []).map((x) => (x && typeof x === 'object' ? x.id : x)).map(String)
  const nums = []
  const ignorados = []
  for (const id of lista) {
    const m = RE_ID.exec(id)
    if (m) nums.push(parseInt(m[1], 10))
    else ignorados.push(id)
  }
  const maximo = nums.length ? Math.max(...nums) : 0
  return {
    siguiente: `T-${String(maximo + 1).padStart(3, '0')}`,
    maximo,
    ignorados,
  }
}

module.exports = { siguienteId, RE_ID }
