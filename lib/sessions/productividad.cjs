// lib/sessions/productividad.cjs — ¿la flota produce, y a qué coste para Manuel? (T-486)
//
// ── POR QUÉ EXISTE, Y POR QUÉ ESTAS TRES COSAS Y NO OTRAS ────────────────────────────────────
// La ficha del piloto declaró **antes de empezar** cómo se sabría si salía bien, para no juzgarlo
// por la impresión: (1) tareas cerradas y **verificadas** por trabajador, (2) ratio de escape de
// guardarraíles, (3) **horas de revisión de Manuel por tarea entregada**.
//
// De las tres, solo la (2) tenía comando (`npm run sesiones:friccion`, que se REUSA desde aquí, no
// se copia). Las otras dos no las medía nadie — y la tercera es la que decide: si la flota produce
// el doble pero duplica el tiempo de Manuel, **ha fallado aunque los contadores suban**. Él es el
// recurso escaso, no el cómputo.
//
// ── LO QUE NO SE CUENTA COMO PRODUCCIÓN, A PROPÓSITO ─────────────────────────────────────────
// Una tarea ENTREGADA no está hecha: está esperando a una persona. Contarla como producción es
// exactamente cómo un panel empieza a mentir — el mismo error que «verde = no lo he mirado». Aquí
// las entregas se cuentan en su propia columna, y su ANTIGÜEDAD es el dato que importa: una cola de
// entregas que envejece es el aviso de que el cuello de botella se ha movido a la revisión.
//
// Sin BD ni red: recibe filas y decide. Quien las lea es el CLI.

/** Un id de trabajador de la flota: `w1`, `l3`… Lo demás es una persona. */
const ES_TRABAJADOR = /^(?:w|l)\d+\b/

/** ¿Quién cerró esto? Se deduce del sid, que es el mismo identificador del claim y del latido. */
const quienEs = (sid) => (ES_TRABAJADOR.test(String(sid || '')) ? 'trabajador' : 'persona')

const horas = (ms) => Math.round((ms / 3_600_000) * 10) / 10

/**
 * El parte de productividad.
 *
 * @param cerradas   [{ id, done_at, claimed_by, worked_seconds, esfuerzo }]
 * @param entregadas [{ id, review_requested_at, review_requested_by }]
 * @param ahora
 *
 * @returns {porOrigen, entregas, tiempo, veredicto}
 */
function medir({ cerradas = [], entregadas = [], ahora = new Date() } = {}) {
  const t = new Date(ahora).getTime()

  const porOrigen = { trabajador: 0, persona: 0 }
  let conTiempo = 0
  let segundos = 0
  for (const c of cerradas) {
    porOrigen[quienEs(c.claimed_by)] += 1
    if (c.worked_seconds > 0) { conTiempo += 1; segundos += Number(c.worked_seconds) }
  }

  // La cola de entregas: cuántas y **cuánto llevan esperando**. La mediana dice más que la media,
  // porque una entrega olvidada de hace tres días desplaza la media y esconde el resto.
  const esperas = entregadas
    .filter((e) => e.review_requested_at)
    .map((e) => t - new Date(e.review_requested_at).getTime())
    .sort((a, b) => a - b)
  const mediana = esperas.length
    ? esperas[Math.floor((esperas.length - 1) / 2)]
    : null

  const entregas = {
    pendientes: entregadas.length,
    esperaMedianaH: mediana === null ? null : horas(mediana),
    esperaMaximaH: esperas.length ? horas(esperas[esperas.length - 1]) : null,
    // De quién son: si TODAS vienen de la flota, la cola de revisión es coste que ella genera.
    deLaFlota: entregadas.filter((e) => quienEs(e.review_requested_by) === 'trabajador').length,
  }

  // ── LO QUE LA MÉTRICA DECLARADA NO PODÍA VER ────────────────────────────────────────────
  // La ficha pedía «tareas cerradas y verificadas POR TRABAJADOR»… y eso sale **0 por
  // construcción**: un trabajador no cierra, ENTREGA — cerrar exige verificar, y verificar es de
  // una persona (esa es la quinta espera de [T-539], no un defecto). Medido el 05/08: 162 cerradas
  // en 7 días, todas por personas, con nueve entregas de la flota en cola al mismo tiempo.
  //
  // Así que la producción de la flota son sus ENTREGAS, y lo que dice si sirven es cuántas acaban
  // cerradas. Contar solo cierres haría que una flota que funciona pareciera no producir nada.
  const deFlotaCerradas = cerradas.filter((c) => quienEs(c.review_requested_by) === 'trabajador').length

  return {
    porOrigen,
    produccionFlota: {
      entregadasYaCerradas: deFlotaCerradas,
      enCola: entregas.deLaFlota,
      // Sin ninguna cerrada todavía no se afirma una tasa: sería dividir por la nada.
      tasaAceptacion: deFlotaCerradas + entregas.deLaFlota
        ? Math.round((deFlotaCerradas / (deFlotaCerradas + entregas.deLaFlota)) * 100)
        : null,
    },
    entregas,
    tiempo: {
      // «No medido» se dice, no se rellena: `worked_seconds` solo existe desde [T-414] y las tareas
      // viejas no lo tienen. Promediar sobre las que sí lo tienen y callar cuántas son daría una
      // cifra que nadie puede desmentir.
      conMedida: conTiempo,
      sinMedida: cerradas.length - conTiempo,
      horasTotales: conTiempo ? horas(segundos * 1000) : null,
      horasPorTarea: conTiempo ? Math.round((segundos / conTiempo / 3600) * 10) / 10 : null,
    },
    veredicto: veredicto({ porOrigen, entregas }),
  }
}

/**
 * El semáforo. **Mira la cola de revisión, no la producción**, porque es lo que la ficha declaró
 * como criterio de fracaso: producir más a costa del tiempo de Manuel es perder.
 *
 * Umbrales deliberadamente flojos y explicados: no hay serie histórica todavía, así que esto es un
 * punto de partida que se recalibra cuando la haya, no una verdad medida.
 */
function veredicto({ porOrigen, entregas }) {
  if (entregas.pendientes === 0) {
    return { color: 'verde', razon: 'no hay nada esperando revisión' }
  }
  if (entregas.esperaMedianaH !== null && entregas.esperaMedianaH >= 24) {
    return {
      color: 'rojo',
      razon: `la mitad de las ${entregas.pendientes} entregas lleva ≥${entregas.esperaMedianaH} h sin revisar: ` +
        'el cuello de botella ya no es producir, es revisar — y ese era el criterio de fracaso declarado',
    }
  }
  if (entregas.pendientes >= 8) {
    return {
      color: 'ambar',
      razon: `${entregas.pendientes} entregas en cola (${entregas.deLaFlota} de la flota): ` +
        'se acumulan más rápido de lo que se revisan',
    }
  }
  return { color: 'verde', razon: `${entregas.pendientes} entrega(s) en cola, al día` }
}

/** Las líneas del informe. La prosa va aquí para que el CLI no invente su propia versión. */
function formatear(m, { dias = 7 } = {}) {
  const l = []
  const total = m.porOrigen.trabajador + m.porOrigen.persona
  l.push(`PRODUCTIVIDAD — últimos ${dias} días`)
  l.push('='.repeat(58))
  l.push(`  cerradas: ${total}   (flota ${m.porOrigen.trabajador} · personas ${m.porOrigen.persona})`)
  // «Cerradas por trabajador» sale 0 por construcción: ellos entregan, cierra una persona. Sin
  // esta línea el parte parecería decir que la flota no produce nada.
  const pf = m.produccionFlota
  l.push(`  producción de la FLOTA: ${pf.entregadasYaCerradas} entrega(s) ya cerrada(s) · ${pf.enCola} en cola` +
    (pf.tasaAceptacion === null ? '   (aún sin tasa: nada cerrado todavía)' : `   → ${pf.tasaAceptacion}% aceptadas`))
  l.push(m.tiempo.conMedida
    ? `  tiempo medido: ${m.tiempo.horasTotales} h en ${m.tiempo.conMedida} tarea(s) → ${m.tiempo.horasPorTarea} h/tarea` +
      (m.tiempo.sinMedida ? `   (${m.tiempo.sinMedida} sin medir)` : '')
    : '  tiempo medido: ninguna tarea lo trae (worked_seconds existe desde T-414)')
  l.push('')
  l.push(`🙋 ESPERANDO TU REVISIÓN: ${m.entregas.pendientes}` +
    (m.entregas.deLaFlota ? `  (${m.entregas.deLaFlota} de la flota)` : ''))
  if (m.entregas.esperaMedianaH !== null) {
    l.push(`   llevan esperando: ${m.entregas.esperaMedianaH} h la mitad · ${m.entregas.esperaMaximaH} h la más vieja`)
  }
  l.push('')
  const icono = { verde: '✅', ambar: '🟠', rojo: '🔴' }[m.veredicto.color]
  l.push(`${icono} ${m.veredicto.razon}`)
  if (m.veredicto.color !== 'verde') {
    l.push('   (el criterio de fracaso lo declaró la propia ficha del piloto: si tu tiempo de')
    l.push('    revisión por tarea entregada sube, la flota ha fallado aunque produzca más)')
  }
  return l
}

module.exports = { ES_TRABAJADOR, quienEs, medir, veredicto, formatear }
