'use strict'
//
// evidenciaReserva — LEER del boletín cómo se relaciona el cupo de discapacidad con el turno libre.
//
// Es la mitad LECTORA de [T-218]. La otra mitad, la que decide si una declaración puede escribirse,
// es `validarDeclaracionReserva` en `correccionPlazas.cjs`. Van juntas a propósito y en este orden:
// esto PROPONE con la evidencia delante, un humano (o Claude) ADJUDICA, y la guarda de la escritura
// vuelve a comprobarlo todo por su cuenta. Nada de lo que salga de aquí entra en la BD sin pasar por
// ella — un proponente que además escribiera sería un detector que se cree juez.
//
// ## Por qué hace falta
//
// Quedan 28 convocatorias sin declarar y cada una es un PDF de boletín de decenas de páginas donde
// el dato vive en una línea. Las tres primeras se leyeron a mano; a ese ritmo, las 28 son una tarde
// entera de buscar a ojo y el riesgo no es el tiempo, es que a la quinta se lea en diagonal.
//
// ## Las formas REALES (todas salen de una convocatoria que ya se declaró)
//
//   DENTRO
//     · prosa:  «Se convocan 54 plazas … DEL TOTAL de las plazas convocadas se reservarán 6»   (UNED)
//     · tabla:  «305 9 13 327» con nuestro turno libre = 327 (el TOTAL) y 9+13 = nuestro cupo   (CLM)
//   APARTE
//     · prosa:  «se dividen en DOS CUPOS: — cupo general: 1.747 — cupo de reserva: 131»       (SERMAS)
//     · tabla:  «89 7 23 3 122» con nuestro turno libre = 89 (la PRIMERA) y 122 = 89+33        (GVA)
//
// Las dos tablas se distinguen sin ambigüedad por DÓNDE cae nuestra cifra: si es el último número
// de la fila, guardamos el total y la reserva va dentro; si es el primero y el último es la suma,
// guardamos el cupo general y la reserva va aparte. No hay que interpretar nada.
//
// Tests: `__tests__/lib/convocatoria/evidenciaReserva.test.js` (los cuatro casos reales + los
// contraejemplos que NO deben proponer nada).

/**
 * Prosa del tipo «DEL TOTAL … se reservan N». Ojo: por sí sola NO dice si el cupo está dentro de
 * NUESTRA cifra — dice que sale del total del boletín, que puede no ser el que guardamos.
 *
 *   · UNED:    «cubrir 54 plazas … del total de las plazas convocadas se reservarán 6» → guardamos
 *              54, que ES el total ⇒ DENTRO.
 *   · Ujieres: «convocatoria de cuarenta plazas … del total … se reservan cuatro» → guardamos 36,
 *              que es 40−4 ⇒ respecto de NUESTRA cifra, el cupo va APARTE.
 *
 * La misma frase, dos veredictos opuestos, y lo que los separa es qué total tenemos guardado. Por
 * eso este patrón no concluye solo: hay que ver qué cifra acompaña a la frase (ver `totalDeLaFrase`).
 * El gap admite 200 caracteres porque los boletines meten en medio la cita legal completa
 * («de conformidad con lo dispuesto en el artículo 11.2 del Estatuto del Personal de las Cortes…»).
 */
// `(?:[^.]|\.(?=\d))` = cualquier cosa MENOS un final de frase, pero admitiendo el punto que va
// dentro de un número («artículo 11.2», «1.747»). Con `[^.]` a secas, la cita legal que los
// boletines meten en medio rompía el patrón — y ese era justo el caso de Ujieres.
const PROSA_DEL_TOTAL = [
  /del total de (?:las |estas )?plazas(?: convocadas)?(?:[^.]|\.(?=\d)){0,220}?se reserv\w+/i,
  /de las cuales(?:[^.]|\.(?=\d)){0,140}?se reserv\w+/i,
  /de estas plazas(?:[^.]|\.(?=\d)){0,140}?se reserv\w+/i,
]

/** Prosa que solo puede significar que el cupo va APARTE (se suma al general). */
const PROSA_APARTE = [
  /se dividen en dos cupos/i,
  /cupo general[^.]{0,80}?cupo de reserva/i,
  /además de las[^.]{0,60}?plazas/i,
]

const VENTANA = 320

/**
 * Vocabulario que convierte una fila de números en EVIDENCIA. Sin esto, el lector propone
 * coincidencias: con cifras pequeñas (una diputación con 3 plazas y 2 de cupo) cualquier listado
 * lleno de fechas produce una fila que «cuadra». Pasó a la primera — de 3 propuestas «limpias», las
 * 3 eran casualidad: en Huelva casaban los días y los años de un índice de procesos, y en el SESCAM
 * la fila visible era de otra categoría. Es la misma lección que el detector de cifras: los números
 * no significan nada por sí solos, lo que decide son las palabras que tienen al lado.
 */
const VOCABULARIO = /discapacidad|discapacitat|reserv|cupo|turno libre|torn lliure|acceso general|enfermedad mental|malaltia mental/i

/** Todos los tramos de ≥3 números seguidos del texto, con su posición. */
function secuenciasNumericas(t) {
  const out = []
  const re = /(?:\b\d{1,6}\b[^\S\n]*){3,}/g
  let m
  while ((m = re.exec(t)) !== null) {
    const nums = (m[0].match(/\b\d{1,6}\b/g) || []).map(Number)
    if (nums.length >= 3) out.push({ nums, index: m.index })
  }
  return out
}

const frag = (t, i) => t.slice(Math.max(0, i - VENTANA), i + VENTANA).trim()

/**
 * ¿Qué dice el corpus sobre la relación? Devuelve TODAS las candidatas encontradas, con su
 * evidencia, para que quien adjudique vea en qué se basa cada una — nunca un veredicto a secas.
 *
 * @param {string} corpus  texto de los documentos de la convocatoria
 * @param {{plazasLibres:number, plazasDiscapacidad:number}} cifras las que tenemos en BD
 * @returns {Array<{incluidas:boolean, via:string, cita:string}>}
 */
function proponerRelacion(corpus, { plazasLibres, plazasDiscapacidad } = {}) {
  const t = String(corpus || '').replace(/\s+/g, ' ')
  if (!t || !Number.isInteger(plazasLibres) || !Number.isInteger(plazasDiscapacidad) || plazasDiscapacidad <= 0) return []
  const total = plazasLibres + plazasDiscapacidad
  const props = []
  const vistas = new Set()
  const añade = (incluidas, via, cita, nums) => {
    const clave = `${incluidas}|${cita.slice(0, 80)}`
    if (vistas.has(clave)) return
    vistas.add(clave)
    // `nums` viaja en la propuesta para que quien adjudique vea LOS NÚMEROS que casaron, no solo una
    // ventana de texto donde a lo mejor ni se ven. Enseñar la ventana y esconder la cuenta es cómo
    // un falso positivo se lee como un acierto.
    props.push({ incluidas, via, cita, nums: nums || null })
  }

  // ── Tablas. Deterministas: la posición de NUESTRA cifra en la fila lo dice todo.
  for (const { nums, index } of secuenciasNumericas(t)) {
    // Una fila de números sin vocabulario de reserva cerca NO es una tabla de plazas: es un índice,
    // una lista de fechas o un sumario. Se descarta antes de mirar la aritmética.
    if (!VOCABULARIO.test(frag(t, index))) continue
    for (let i = 0; i < nums.length; i++) {
      // DENTRO: nuestra cifra cierra la fila y lo anterior suma el cupo (305 | 9 13 | 327).
      if (nums[i] === plazasLibres && i >= 2) {
        const componentes = nums.slice(0, i).reduce((s, n) => s + n, 0)
        if (componentes === plazasLibres && nums.slice(1, i).reduce((s, n) => s + n, 0) === plazasDiscapacidad) {
          añade(true, 'tabla: nuestra cifra es el TOTAL de la fila y los cupos suman el resto', frag(t, index), nums.slice(0, i + 1))
        }
      }
      // APARTE: nuestra cifra abre la fila y el último número es la suma (89 | 7 23 3 | 122).
      if (nums[i] === plazasLibres && i + 2 < nums.length) {
        const resto = nums.slice(i + 1)
        const fin = resto[resto.length - 1]
        const cupos = resto.slice(0, -1).reduce((s, n) => s + n, 0)
        if (fin === total && cupos === plazasDiscapacidad) {
          añade(false, 'tabla: nuestra cifra es el turno libre y la fila cierra con la suma', frag(t, index), nums.slice(i))
        }
      }
    }
  }

  // ── Prosa. Solo cuenta si la frase está CERCA de nuestras cifras: un boletín habla de reservas en
  //    muchos sitios (bases generales, remisiones a la ley) y esas menciones no prueban nada de ESTA
  //    convocatoria. Se exige que la ventana contenga la cifra del turno libre.
  const cerca = (i) => {
    const v = frag(t, i)
    return new RegExp(`\\b${plazasLibres}\\b|\\b${String(plazasLibres).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}\\b`).test(v)
  }
  // «Del total … se reservan N»: concluye según QUÉ total acompañe a la frase.
  //   · el total es nuestra cifra          → el cupo está DENTRO de lo que guardamos
  //   · el total es nuestra cifra + cupo   → guardamos el general, el cupo va APARTE
  //   · cualquier otro total               → no se concluye nada (nuestra cifra no es de esa frase)
  // El total se busca con `cifraEnTexto`, el mismo predicado del detector, porque los boletines lo
  // escriben en LETRAS más de lo que uno diría («convocatoria de cuarenta plazas»).
  const { cifraEnTexto } = require('./cifraEnTexto.cjs')
  for (const re of PROSA_DEL_TOTAL) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    let m
    while ((m = g.exec(t)) !== null) {
      const v = frag(t, m.index)
      const esNuestra = cifraEnTexto(plazasLibres, v)
      const esLaSuma = cifraEnTexto(total, v)
      if (esNuestra && !esLaSuma) añade(true, 'prosa: «del total…» y ese total ES nuestra cifra', v)
      else if (esLaSuma && !esNuestra) añade(false, 'prosa: «del total…» pero ese total es nuestra cifra MÁS el cupo', v)
      // Si aparecen las dos (o ninguna), no se concluye: que lo lea una persona.
    }
  }
  for (const re of PROSA_APARTE) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    let m
    while ((m = g.exec(t)) !== null) {
      if (cerca(m.index)) añade(false, 'prosa: el boletín enumera dos cupos', frag(t, m.index))
    }
  }

  return props
}

/**
 * ¿Hay una propuesta LIMPIA? Limpia = todas las evidencias apuntan al mismo lado. Si el corpus da
 * las dos, no se elige la que más veces sale: se manda a leer, que es lo que hay que hacer cuando
 * un documento dice dos cosas.
 */
function propuestaUnanime(props) {
  if (!props.length) return null
  const lados = new Set(props.map((p) => p.incluidas))
  if (lados.size !== 1) return null
  return { incluidas: props[0].incluidas, evidencias: props }
}

module.exports = { proponerRelacion, propuestaUnanime, secuenciasNumericas }
