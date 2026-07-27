/**
 * Reparación de la POSICIÓN de la opción correcta (§2.2-ter del manual
 * `generar-preguntas-con-ia.md`) — el paso que faltaba junto al que ya la DETECTA.
 *
 * `analizarLote` (lib/generacion/simularBatch.js) bloquea el lote cuando la correcta
 * se concentra en una letra (>40% / <10%) o cuando la secuencia describe un ciclo
 * regular de periodo 4. Hasta ahora la reparación se hacía A MANO, y hacerla a mano
 * es justo lo que falla: en el batch `gen_atc_t209` (25/07/2026) se rotaron las
 * cuatro opciones y dos viñetas quedaron describiendo la opción equivocada. La clave
 * seguía siendo correcta y el gate mecánico daba verde —comprueba que la cabecera
 * case con `correct_option`, no que cada viñeta describa SU opción—, así que el
 * defecto llegó vivo hasta una auditoría ciega.
 *
 * De ahí las dos reglas que este módulo impone por construcción:
 *
 *   1. **Transposición de DOS posiciones, nunca una permutación de cuatro.** Con 4
 *      opciones una transposición basta siempre para llevar la correcta a cualquier
 *      letra, y solo obliga a remapear DOS viñetas en vez de cuatro.
 *   2. **La explicación viaja con las opciones.** Al intercambiar i↔j: la cabecera
 *      pasa a nombrar la letra de destino, y la viñeta que describía al distractor
 *      que ocupaba el destino se rotula con la letra de origen. Ninguna otra se toca.
 *
 * Si la explicación no está sincronizada con `correct_option` ANTES de transponer,
 * se aborta en vez de propagar el desajuste (ese residuo es precisamente lo que
 * `analizarCabecera` denuncia).
 *
 * Núcleo PURO: sin I/O, sin `Math.random` — mismo plan para el mismo lote, que es lo
 * que permite re-simular y comparar. Tests: `__tests__/lib/generacion/transponerPosicion.test.js`.
 */

const LETRA = ['A', 'B', 'C', 'D']

const reCabecera = (l) => new RegExp(`\\*\\*Por qué ${l} es correcta:\\*\\*`)
const reVinieta = (l) => new RegExp(`^- \\*\\*${l}\\)\\*\\* `, 'm')

/**
 * Lleva la opción correcta de una pregunta a la posición `destino` intercambiándola
 * con la que allí estuviera, y remapea la explicación letra-anclada.
 *
 * @param {{options:string[], correct_option:number, explanation:string, explanation_data?:object}} pregunta
 * @param {number} destino Índice 0-3 al que debe ir la correcta.
 * @returns {{pregunta:object, movida:boolean, de:string, a:string}}
 * @throws {Error} si el destino es inválido o la explicación no está sincronizada.
 */
function transponer(pregunta, destino) {
  const i = pregunta.correct_option
  if (!Number.isInteger(destino) || destino < 0 || destino > 3) {
    throw new Error(`destino fuera de rango: ${destino}`)
  }
  if (!Array.isArray(pregunta.options) || pregunta.options.length !== 4) {
    throw new Error('la pregunta no trae exactamente 4 opciones')
  }
  if (!Number.isInteger(i) || i < 0 || i > 3) {
    throw new Error(`correct_option fuera de rango: ${i}`)
  }
  if (destino === i) return { pregunta, movida: false, de: LETRA[i], a: LETRA[i] }

  const exp = String(pregunta.explanation || '')
  if (!reCabecera(LETRA[i]).test(exp)) {
    throw new Error(
      `la explicación no lleva cabecera "**Por qué ${LETRA[i]} es correcta:**" (clave ${LETRA[i]}): ` +
        'sincronízala antes de transponer, o estarías propagando un desajuste',
    )
  }
  if (!reVinieta(LETRA[destino]).test(exp)) {
    throw new Error(
      `la explicación no lleva viñeta "- **${LETRA[destino]})**" para el distractor que ocupa el destino`,
    )
  }

  const options = pregunta.options.slice()
  ;[options[i], options[destino]] = [options[destino], options[i]]

  // Cabecera → letra de destino. Viñeta del destino → letra de origen. Nada más.
  let explanation = exp
    .replace(reCabecera(LETRA[i]), `**Por qué ${LETRA[destino]} es correcta:**`)
    .replace(reVinieta(LETRA[destino]), `- **${LETRA[i]})** `)

  // Las viñetas se leen en orden alfabético; reordenarlas evita que el remapeo se note.
  const corte = '**Por qué las demás son incorrectas:**'
  if (explanation.includes(corte)) {
    const [cabeza, cola] = explanation.split(corte)
    const items = cola.split('\n').filter((l) => l.trim())
    explanation = cabeza + corte + '\n' + items.sort().join('\n')
  }

  const out = { ...pregunta, options, correct_option: destino, explanation }

  // Formato estructurado §8.2: las razones van keadas al índice de la opción, así que
  // al mover la opción se mueve su razón. Hoy el inserter no lo persiste (T-080 Fase 2),
  // pero si el borrador lo trae hay que mantenerlo coherente.
  const d = pregunta.explanation_data
  if (d && d.options) {
    const opts = { ...d.options }
    const a = opts[String(i)]
    const b = opts[String(destino)]
    if (a !== undefined) opts[String(destino)] = a
    if (b !== undefined) opts[String(i)] = b
    out.explanation_data = { ...d, options: opts }
  }

  return { pregunta: out, movida: true, de: LETRA[i], a: LETRA[destino] }
}

/**
 * Propone a qué letra debe ir la correcta de cada pregunta para que el lote cumpla
 * §2.2-ter: reparto plano (±1) y sin ciclo regular de periodo 4.
 *
 * Determinista: recorre el lote en orden y solo mueve las preguntas cuya letra está
 * en exceso, hacia la que más déficit acumula (desempate por índice de letra). Mover
 * el mínimo número de preguntas es deliberado — cada movimiento toca una explicación.
 *
 * @param {Array<{correct_option:number}>} preguntas
 * @returns {Array<{i:number, de:number, a:number}>} movimientos propuestos (vacío = ya cumple)
 */
function planEquilibrio(preguntas) {
  const n = preguntas.length
  if (!n) return []
  const cupoMax = Math.ceil(n / 4)
  const cupoMin = Math.floor(n / 4)
  const cuenta = [0, 0, 0, 0]
  preguntas.forEach((q) => { if (cuenta[q.correct_option] != null) cuenta[q.correct_option]++ })

  const mov = []
  const destinos = preguntas.map((q) => q.correct_option)

  preguntas.forEach((q, i) => {
    const de = q.correct_option
    if (cuenta[de] <= cupoMax) return
    // Letra con menor cuenta que aún tenga hueco (< cupoMax); a igualdad, la de menor
    // índice. Ojo: el criterio NO puede ser "solo las que están por debajo de cupoMin" —
    // con 11 de 15 correctas en C se llenaban las tres deficitarias hasta el mínimo y el
    // reparto se detenía con C al 40%, o sea justo en el borde que el gate tolera. Lo
    // destapó el canario sobre un lote real de 15; los tests lo hacían con 8, donde
    // cupoMin y cupoMax coinciden y el fallo no puede aparecer.
    let a = -1
    for (let k = 0; k < 4; k++) {
      if (k === de || cuenta[k] >= cupoMax) continue
      if (a === -1 || cuenta[k] < cuenta[a]) a = k
    }
    if (a === -1) return
    cuenta[de]--
    cuenta[a]++
    destinos[i] = a
    mov.push({ i, de, a })
  })

  // Ciclo regular de periodo 4: predecible aunque el reparto sea plano (§2.2-ter,
  // batch gen_dec19_2011_b3). Se rompe con el menor cambio posible: intercambiar el
  // destino de dos preguntas contiguas que difieran.
  if (n >= 8 && destinos.every((d, k) => k < 4 || d === destinos[k - 4])) {
    for (let k = 0; k + 1 < n; k++) {
      if (destinos[k] === destinos[k + 1]) continue
      const [x, y] = [destinos[k], destinos[k + 1]]
      empujar(mov, k, preguntas[k].correct_option, y)
      empujar(mov, k + 1, preguntas[k + 1].correct_option, x)
      break
    }
  }
  return mov.filter((m) => m.de !== m.a)
}

function empujar(mov, i, de, a) {
  const prev = mov.find((m) => m.i === i)
  if (prev) prev.a = a
  else mov.push({ i, de, a })
}

/**
 * Aplica `planEquilibrio` con `transponer`. No muta la entrada.
 *
 * @param {Array<object>} preguntas
 * @returns {{preguntas:Array<object>, movimientos:Array<{i:number,de:string,a:string}>}}
 */
function equilibrarLote(preguntas) {
  const plan = planEquilibrio(preguntas)
  const out = preguntas.slice()
  const movimientos = []
  for (const m of plan) {
    const r = transponer(out[m.i], m.a)
    out[m.i] = r.pregunta
    if (r.movida) movimientos.push({ i: m.i, de: r.de, a: r.a })
  }
  return { preguntas: out, movimientos }
}

module.exports = { transponer, planEquilibrio, equilibrarLote, LETRA }
