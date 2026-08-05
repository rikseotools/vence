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

/**
 * Previsión: con lo que queda y el ritmo medido, ¿cuánto falta?
 *
 * ── LA TRAMPA QUE HAY QUE ESQUIVAR ──────────────────────────────────────────────────────────
 * Lo primero que uno mira es `worked_seconds`… y **no mide esfuerzo, mide tiempo con la tarea
 * COGIDA**. Medido el 05/08: entregas con «22 h» y «18 h» que son tareas reclamadas y dejadas de
 * un turno para otro. Dividir 251 tareas entre eso daría años, y sería falso.
 *
 * Lo que sí es medible sin interpretar nada: **cuántas entregas produce la flota por hora de
 * reloj**, contadas en una ventana real. Eso incluye ya sus paradas, sus reintentos y sus turnos
 * muertos, que es exactamente lo que una previsión tiene que incluir.
 *
 * ── Y EL CUELLO DE BOTELLA NO ES PRODUCIR ───────────────────────────────────────────────────
 * Una entrega no es una tarea terminada hasta que alguien la revisa. Si Manuel revisa más despacio
 * de lo que la flota entrega, **la previsión la manda la revisión**, no la producción — y añadir
 * trabajadores no acorta nada, solo alarga la cola. Por eso se calculan los dos ritmos y se dice
 * cuál manda: es la diferencia entre «necesito más trabajadores» y «necesito revisar».
 */
function prevision({ pendientes = 0, entregasVentana = 0, cerradasVentana = 0, horasVentana = 0, trabajadores = 0 } = {}) {
  if (!horasVentana || horasVentana <= 0) {
    return { hay: false, motivo: 'sin ventana de medida: no se puede calcular un ritmo' }
  }
  // Menos de 3 entregas no es un ritmo, es una anécdota: extrapolarlo a 251 tareas daría una cifra
  // con tres dígitos de precisión falsa.
  if (entregasVentana < 3) {
    return { hay: false, motivo: `solo ${entregasVentana} entrega(s) medida(s): hace falta más rodaje para dar un ritmo` }
  }

  const entregasPorHora = entregasVentana / horasVentana
  const cerradasPorHora = cerradasVentana / horasVentana
  // El ritmo REAL de tareas terminadas es el menor de los dos: producir sin revisar solo hace cola.
  const cuelloRevision = cerradasVentana > 0 && cerradasPorHora < entregasPorHora
  const ritmo = cuelloRevision ? cerradasPorHora : entregasPorHora

  const horas = pendientes / ritmo
  return {
    hay: true,
    entregasPorHora: Math.round(entregasPorHora * 10) / 10,
    cerradasPorHora: cerradasVentana > 0 ? Math.round(cerradasPorHora * 10) / 10 : null,
    manda: cuelloRevision ? 'revision' : 'produccion',
    horas: Math.round(horas),
    dias: Math.round((horas / 24) * 10) / 10,
    // Con la flota parada de noche, los días de reloj no son días de trabajo. Se da también la
    // cuenta a 8 h/día, que es lo que una persona reconoce como «jornadas».
    jornadas: Math.round(horas / 8),
    porTrabajador: trabajadores ? Math.round((entregasPorHora / trabajadores) * 100) / 100 : null,
  }
}

/**
 * ¿Vamos mejor o peor que antes?
 *
 * ── LO QUE SE COMPARA, Y POR QUÉ NO EL VEREDICTO ────────────────────────────────────────────
 * Comparar colores no dice nada: dos ámbares seguidos pueden ser uno subiendo y otro bajando. Se
 * comparan las CIFRAS, y cada una tiene su dirección buena — que no es la misma para todas:
 * más ritmo es mejor, pero **más cola de revisión es peor**, y ahí está el matiz que importa.
 *
 * Y se dice «igual» cuando la variación es pequeña: con muestras de pocas horas, un ±10 % es
 * ruido, y llamarlo «mejora» enseña a no creerse la serie.
 */
const RUIDO = 0.1

/** Para cada métrica: ¿subir es bueno? */
const DIRECCION = {
  entregasPorHora: 'sube',
  cerradasPorHora: 'sube',
  pendientes: 'baja',
  entregasEnCola: 'baja',
  esperaMedianaH: 'baja',
  horasEstimadas: 'baja',
}

/**
 * @param actual, anterior  dos filas del histórico (o los objetos equivalentes)
 * @returns [{ metrica, de, a, cambio, veredicto }] — solo lo que ha cambiado de verdad
 */
function comparar(actual, anterior) {
  if (!anterior) return { hay: false, motivo: 'es la primera medida: no hay con qué comparar' }
  const filas = []
  for (const [k, dir] of Object.entries(DIRECCION)) {
    const a = Number(anterior[k]); const b = Number(actual[k])
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) continue
    const cambio = (b - a) / a
    if (Math.abs(cambio) < RUIDO) { filas.push({ metrica: k, de: a, a: b, cambio, veredicto: 'igual' }); continue }
    const subeYEsBueno = dir === 'sube'
    const mejora = cambio > 0 ? subeYEsBueno : !subeYEsBueno
    filas.push({ metrica: k, de: a, a: b, cambio, veredicto: mejora ? 'mejora' : 'empeora' })
  }
  return {
    hay: true,
    filas,
    // El resumen mira lo que DECIDE el plazo, no la media de todo: si el plazo estimado baja,
    // vamos mejor, se mueva lo que se mueva el resto.
    resumen: filas.find((f) => f.metrica === 'horasEstimadas')?.veredicto
      || (filas.filter((f) => f.veredicto === 'mejora').length >= filas.filter((f) => f.veredicto === 'empeora').length
        ? 'mejora' : 'empeora'),
  }
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
  // ── PREVISIÓN ────────────────────────────────────────────────────────────────────────────
  if (m.prevision) {
    l.push('')
    l.push('PREVISIÓN')
    l.push('-'.repeat(58))
    if (!m.prevision.hay) {
      l.push(`  no se puede dar todavía: ${m.prevision.motivo}`)
    } else {
      const p = m.prevision
      l.push(`  quedan ${m.pendientes} tarea(s) abiertas · ${m.trabajadores} trabajador(es)`)
      l.push(`  ritmo medido: ${p.entregasPorHora} entregas/h` +
        (p.cerradasPorHora !== null ? ` · ${p.cerradasPorHora} cerradas/h` : '') +
        (p.porTrabajador ? `   (${p.porTrabajador}/h por trabajador)` : ''))
      l.push(`  → ${p.horas} h ≈ ${p.dias} días de reloj ≈ ${p.jornadas} jornadas de 8 h`)
      l.push(p.manda === 'revision'
        ? '  ⚠️ MANDA LA REVISIÓN, no la producción: se entrega más rápido de lo que se revisa.'
        : '  el límite está en producir: añadir trabajadores acortaría el plazo.')
      if (p.manda === 'revision') {
        l.push('     Añadir trabajadores NO acorta esto — solo alarga la cola que te espera.')
      }
    }
  }

  const icono = { verde: '✅', ambar: '🟠', rojo: '🔴' }[m.veredicto.color]
  l.push(`${icono} ${m.veredicto.razon}`)
  if (m.veredicto.color !== 'verde') {
    l.push('   (el criterio de fracaso lo declaró la propia ficha del piloto: si tu tiempo de')
    l.push('    revisión por tarea entregada sube, la flota ha fallado aunque produzca más)')
  }
  return l
}

module.exports = { ES_TRABAJADOR, quienEs, medir, veredicto, prevision, comparar, DIRECCION, RUIDO, formatear }
