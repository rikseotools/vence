// lib/observability/friccionSesiones.cjs — medir lo que cuesta trabajar en paralelo. (T-423)
//
// ── LO QUE NO SE VEÍA ────────────────────────────────────────────────────────────────────────
// El 31/07 se construyeron seis piezas para que 2-10 sesiones no se pisen (claim, latido, huella,
// reserva de la cola, árbol de deploy propio, índice no compartido). Todas contestan la pregunta
// «¿qué pasa AHORA?». **Ninguna deja serie temporal**, así que no se puede contestar:
//
//   · ¿la fricción entre sesiones sube o baja esta semana?
//   · ¿cuánto se pierde esperando el lock de deploy?
//   · ¿con qué frecuencia una sesión le roba la tarea a otra por lease vencido?
//   · y sobre todo: **¿cuántas veces se está RODEANDO un guardarraíl?**
//
// ── LA SEÑAL QUE MÁS IMPORTA ES EL ESCAPE, NO EL BLOQUEO ─────────────────────────────────────
// Un guardarraíl que se salta de forma sistemática **está muerto y nadie se ha enterado**: sigue
// dando la lata, ya no protege, y encima da la falsa sensación de que el hueco está cubierto. El
// 31/07 murieron tres exactamente así — el aviso que gritaba en falso hasta que se ignoró, el
// bloqueo imposible de satisfacer que enseñaba a apagar el guard entero, y el escape general que
// se volvió rutina. Los tres se descubrieron por casualidad, no por un dato.
//
// El ratio de escape es un **indicador ADELANTADO**: se ve subir antes de que el guardarraíl deje
// de servir. Por eso lo caro no es contar bloqueos —eso solo dice que el guard trabaja— sino
// contar cuántos de esos bloqueos acabaron rodeados.
//
// Emitir es SIEMPRE best-effort: esto vive dentro de hooks de git. Una avería del bus de
// observabilidad no puede impedirle a nadie commitear ni pushear.

const EVENT_TYPE = 'sesion_friccion'

/** Lo que se mide. Cerrado a propósito: un catálogo abierto acaba siendo texto libre sin agregar. */
const CLASES = {
  guard_bloqueo: 'un guardarraíl paró a una sesión',
  guard_escape: 'una sesión rodeó un guardarraíl con su escape',
  lease_robado: 'una sesión se llevó una tarea cuyo lease había vencido',
  deploy_espera: 'una sesión esperó al lock de deploy',
  indice_compartido: 'dos o más sesiones trabajando en el mismo directorio',
  // T-431. Es fricción del mismo tipo, pero de la que solo se ve DESPUÉS: la sesión ya no está
  // para contarlo y su trabajo sigue ahí. Va en este catálogo y no en un evento propio porque la
  // pregunta que contesta es la misma —¿cuánto nos cuesta trabajar en paralelo?— y porque el
  // ratio de escape necesita que bloqueos y rodeos vivan juntos.
  trabajo_huerfano: 'un worktree abandonado guarda trabajo que no existe en ningún otro sitio',
  // T-484. Hermano de `indice_compartido` un piso más abajo: allí dos sesiones comparten
  // DIRECTORIO, aquí comparten IDENTIDAD, que es peor —el claim, el lease y la huella cuelgan del
  // sid, así que una sesión suelta la tarea de otra creyéndola suya— y además es INVISIBLE: la PK
  // de `worktree_sessions` es el sid, o sea que las dos máquinas escriben sobre la misma fila y el
  // mapa enseña UNA sesión donde hay dos. Solo lo puede ver quien escribe: el propio latido.
  identidad_compartida: 'dos máquinas laten con el MISMO session-id',
}

const esClase = (c) => Object.prototype.hasOwnProperty.call(CLASES, c)

/**
 * Con qué severidad entra cada clase en el bus. La política vive AQUÍ (una sola vez) y no en el
 * emisor: si cada llamante elige, la serie deja de ser comparable consigo misma.
 *
 * `info` es lo normal —la fricción se lee agregada, no evento a evento—, con dos excepciones:
 *  · `guard_escape`: el ratio de escape es el indicador adelantado de un guardarraíl muriéndose,
 *    y en `info` se perdería entre el ruido.
 *  · `identidad_compartida` (T-484): no es fricción rutinaria, es el reparto ROTO — dos sesiones
 *    con el mismo sid se sueltan la tarea la una a la otra. Y nadie más puede verlo, porque las
 *    dos escriben sobre la misma fila.
 */
const SEVERIDAD = { guard_escape: 'warn', identidad_compartida: 'warn' }
const severidad = (c) => SEVERIDAD[c] || 'info'

/**
 * Ratio de escape por guardarraíl: de las veces que paró, ¿cuántas se rodearon?
 *
 * @param eventos  [{ clase, guard }]
 * @returns Array<{ guard, bloqueos, escapes, ratio, veredicto }> ordenado por ratio desc.
 *
 * Bandas, y el corte no es arbitrario:
 *  · `sano`      — se rodea menos de 1 de cada 4. El escape hace de válvula, que es su función.
 *  · `erosion`   — entre 1/4 y 2/3. El guardarraíl estorba más de lo que protege: hay que mirar
 *                  QUÉ caso lo dispara, porque casi seguro hay uno legítimo sin contemplar.
 *  · `muerto`    — se rodea 2 de cada 3 veces o más. Ya no protege: es un peaje. O se arregla el
 *                  criterio o se quita, pero dejarlo así es lo peor de los dos mundos.
 *
 * Con pocos datos NO opina (`sin_datos`): declarar muerto un guardarraíl por 1 escape de 1
 * bloqueo sería el mismo error que este módulo existe para cazar.
 */
function ratioEscape(eventos, { minimo = 4 } = {}) {
  const por = new Map()
  for (const e of eventos || []) {
    if (!e || !e.guard) continue
    if (e.clase !== 'guard_bloqueo' && e.clase !== 'guard_escape') continue
    if (!por.has(e.guard)) por.set(e.guard, { guard: e.guard, bloqueos: 0, escapes: 0 })
    por.get(e.guard)[e.clase === 'guard_escape' ? 'escapes' : 'bloqueos']++
  }
  return [...por.values()]
    .map((g) => {
      const total = g.bloqueos + g.escapes
      const ratio = total ? g.escapes / total : 0
      const veredicto = total < minimo ? 'sin_datos'
        : ratio >= 2 / 3 ? 'muerto'
        : ratio >= 0.25 ? 'erosion'
        : 'sano'
      return { ...g, total, ratio: Math.round(ratio * 100) / 100, veredicto }
    })
    .sort((a, b) => b.ratio - a.ratio || b.total - a.total)
}

/** Frase para el informe: dice qué hacer, no solo qué pasa. */
function diagnostico(g) {
  const pct = Math.round(g.ratio * 100)
  switch (g.veredicto) {
    case 'muerto': return `🔴 ${g.guard}: rodeado el ${pct}% (${g.escapes}/${g.total}). YA NO PROTEGE — arregla el criterio o quítalo.`
    case 'erosion': return `🟠 ${g.guard}: rodeado el ${pct}% (${g.escapes}/${g.total}). Mira QUÉ caso legítimo no contempla.`
    case 'sano': return `🟢 ${g.guard}: rodeado el ${pct}% (${g.escapes}/${g.total}). El escape hace de válvula.`
    default: return `⚪ ${g.guard}: solo ${g.total} evento(s), aún no dice nada.`
  }
}

// ── UN ESCAPE QUE SE SATISFACE CON UN «1» SE CONVIERTE EN PREFIJO (T-496/T-497) ─────────────
// Medido sobre 7 días: `indice-compartido` rodeado el 67% (banda «muerto»), pero 6 de sus 10
// escapes NUNCA respondieron a un bloqueo de esa sesión — el `=1` se copiaba de un comando a
// otro. Y el hermano mayor: `backlog-push`, 13 de 23. Un motivo no se arrastra sin darse cuenta,
// y además queda escrito, que es lo que convierte el escape en un dato en vez de un agujero.
//
// Vive aquí, junto a la medida, y no en cada guardarraíl: dos criterios sobre lo que vale como
// escape acabarían divergiendo, que es como nacieron los cinco escritores de `seguimiento_url`.

/** Un motivo más corto que esto es un «xx» para saltarse la comprobación. */
const MOTIVO_MIN = 12

/** Valores que NO son un motivo: lo que se teclea para quitarse de encima una comprobación. */
const NO_ES_MOTIVO = new Set(['1', 'true', 'yes', 'si', 'sí', 'ok', 'y', 'skip'])

/**
 * ¿El valor de la variable de escape justifica saltarse el guardarraíl?
 *
 * @returns {usa, permitido, motivo, problema}
 *   · `usa`       — se ha intentado escapar. Se cuenta aunque no valga.
 *   · `permitido` — hay un motivo de verdad.
 *   · `problema`  — qué le falta, para poder decirlo en vez de fallar de forma muda.
 *
 * **Que un valor no valga NO puede añadir un bloqueo nuevo:** el guardarraíl se limita a
 * evaluarse, y en el caso preventivo (nadie más en el directorio, ninguna tarea sin reclamar)
 * pasa igual. Solo deja de ser una llave maestra.
 */
function evaluarEscape(valor) {
  const v = String(valor == null ? '' : valor).trim()
  if (!v) return { usa: false, permitido: false, motivo: null, problema: null }
  if (NO_ES_MOTIVO.has(v.toLowerCase())) {
    return { usa: true, permitido: false, motivo: null,
      problema: 'el escape ya no acepta un «1»: escribe POR QUÉ te lo saltas' }
  }
  if (v.length < MOTIVO_MIN) {
    return { usa: true, permitido: false, motivo: v,
      problema: `el motivo tiene ${v.length} caracteres: di qué estás haciendo, no «${v}»` }
  }
  return { usa: true, permitido: true, motivo: v, problema: null }
}

/**
 * De los escapes de un guardarraíl, ¿cuántos NO respondían a ningún bloqueo de esa sesión? (T-496)
 *
 * Es la pregunta que el ratio solo no puede contestar, y sin ella se arregla lo que no es. Medido
 * el 02/08 sobre `indice-compartido`: rodeado el **67%** (banda `muerto`), lo que se lee como «el
 * guardarraíl estorba». Al desglosarlo, **6 de los 10 escapes nunca fueron precedidos de un
 * bloqueo a esa sesión** — dos sesiones escaparon dos veces cada una sin que el guard las hubiera
 * parado jamás. No estorbaba: el escape se había vuelto un PREFIJO que se copia de un comando a
 * otro. El arreglo de una lectura y de la otra es opuesto (relajar el criterio vs. cobrar por el
 * escape), así que distinguirlas no es un matiz.
 *
 * Se cuenta POR SESIÓN y no en total: un escape solo puede responder a un bloqueo que te hayan
 * hecho a TI. Es una cota inferior a propósito — si una sesión escapa tres veces tras un bloqueo
 * legítimo, solo cuenta dos como preventivos; conviene equivocarse por lo bajo antes de acusar.
 *
 * @param eventos [{ clase, guard, sid }]
 * @returns Array<{ guard, escapes, preventivos, ratioPreventivo }> ordenado por preventivos desc.
 */
function escapesSinBloqueo(eventos) {
  const por = new Map()
  for (const e of eventos || []) {
    if (!e || !e.guard || !e.sid) continue
    if (e.clase !== 'guard_bloqueo' && e.clase !== 'guard_escape') continue
    const k = `${e.guard}\u0000${e.sid}`
    if (!por.has(k)) por.set(k, { guard: e.guard, bloqueos: 0, escapes: 0 })
    por.get(k)[e.clase === 'guard_escape' ? 'escapes' : 'bloqueos']++
  }
  const porGuard = new Map()
  for (const v of por.values()) {
    if (!porGuard.has(v.guard)) porGuard.set(v.guard, { guard: v.guard, escapes: 0, preventivos: 0 })
    const g = porGuard.get(v.guard)
    g.escapes += v.escapes
    g.preventivos += Math.max(0, v.escapes - v.bloqueos)
  }
  return [...porGuard.values()]
    .filter((g) => g.escapes > 0)
    .map((g) => ({ ...g, ratioPreventivo: Math.round((g.preventivos / g.escapes) * 100) / 100 }))
    .sort((a, b) => b.preventivos - a.preventivos)
}

/** Segundos perdidos esperando el lock de deploy, que es tiempo de sesión tirado. */
function esperaDeploy(eventos) {
  const esperas = (eventos || []).filter((e) => e && e.clase === 'deploy_espera' && Number(e.segundos) > 0)
  const total = esperas.reduce((a, e) => a + Number(e.segundos), 0)
  return { veces: esperas.length, segundos: total, minutos: Math.round(total / 60) }
}

module.exports = {
  EVENT_TYPE, CLASES, esClase, severidad,
  evaluarEscape, MOTIVO_MIN,
  ratioEscape, escapesSinBloqueo, diagnostico, esperaDeploy,
}
