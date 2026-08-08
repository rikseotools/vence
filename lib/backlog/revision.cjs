// lib/backlog/revision.cjs — la QUINTA espera: «hecho, esperando que una persona lo revise». (T-539)
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
// El backlog modela cuatro esperas con su campo cada una (persona, tarea, reloj, deploy) y `claim`
// las impide todas. Faltaba la que va a ser MÁS FRECUENTE en cuanto haya trabajadores autónomos:
// el trabajo está hecho, hay un entregable, y no avanza hasta que alguien lo mire.
//
// Hasta hoy se DEDUCÍA del texto de `resume_check` con cinco expresiones regulares
// (`clasificarEspera`), y el propio comentario defendía la heurística diciendo que no hacía falta
// un campo. La primera vuelta del piloto lo desmintió: el trabajador terminó su auditoría, dejó
// una propuesta lista, y no tenía cómo decirlo — acabó en `pause --hasta` con una fecha INVENTADA,
// porque su bloqueo no era el reloj.
//
// Es el mismo patrón corregido dos veces ya en este repo (`snooze_until`, `due_at`): **una
// condición en prosa no es una condición**. Quien escribe «pendiente de que lo mire Manuel» con
// otras palabras se queda fuera de la lista, y quien lo escribe en un título ve cómo envejece.
//
// ── LA NOTA ES OBLIGATORIA, Y NO ES BUROCRACIA ──────────────────────────────────────────────
// Una petición de revisión sin entregable es un «mírame» sin objeto: quien revisa tiene que abrir
// la ficha, reconstruir el contexto y adivinar qué se espera de él. Con varios trabajadores
// entregando a la vez, eso convierte la revisión —el recurso escaso, el tiempo de Manuel— en el
// cuello de botella que el piloto quería evitar. Se exige aquí Y en un CHECK de la tabla.

// La abreviatura de un sid vive en UN sitio (T-538): por segmento, nunca por longitud.
const { sidCorto } = require('../sessions/sid.cjs')

/** Una nota más corta que esto no dice qué revisar. Mismo espíritu que MOTIVO_MIN de los escapes. */
const ENTREGA_MIN = 20

/** Lo que se teclea para quitarse de encima el requisito, no para explicar un entregable. */
const NO_ES_ENTREGA = new Set(['revisar', 'revision', 'revisión', 'listo', 'hecho', 'ok', 'ver', 'mirar'])

/**
 * ¿Vale este texto como descripción del entregable?
 *
 * @returns {ok, problema}
 */
function validarEntrega(texto) {
  const v = String(texto == null ? '' : texto).trim()
  if (!v) return { ok: false, problema: 'hace falta --entrega "qué hay que revisar y dónde está"' }
  if (NO_ES_ENTREGA.has(v.toLowerCase())) {
    return { ok: false, problema: `«${v}» no dice qué revisar: describe el entregable y dónde está` }
  }
  if (v.length < ENTREGA_MIN) {
    return { ok: false, problema: `la entrega tiene ${v.length} caracteres: di QUÉ hay que mirar (mínimo ${ENTREGA_MIN})` }
  }
  return { ok: true, problema: null }
}

// ── DOS ESTADOS, NO UNO (T-486, 06/08) ──────────────────────────────────────────────────────
// `review_requested_at` marca que HAY entregable. `reviewed_at` marca que YA lo miró alguien.
// Son estados distintos y piden acciones distintas: el primero pide un REVISOR, el segundo pide
// una DECISIÓN (mergear, o devolver el trabajo).
//
// Al estrenar el ciclo se leyó solo la primera columna, y eso produjo dos fallos MEDIDOS el 06/08:
//   · `npm run flota` anunciaba «19 entregadas esperando que las revises» cuando **4 ya tenían
//     veredicto escrito** — o sea, el resultado de la revisión quedaba enterrado entre las que
//     seguían sin mirar, y la acción que Manuel tenía pendiente (leerlo y decidir) no se veía.
//   · `claim` respondía «entregada y esperando revisión humana» a una tarea YA revisada, así que
//     una devuelta con veredicto `problemas` no la podía retomar nadie sin `--force`.
// Es el mismo patrón que ya costó `snooze_until`, `due_at` y `revision`: **un estado que no se
// puede expresar se archiva en el cajón de otro**. Aquí el dato SÍ estaba en la tabla; lo que
// faltaba era que el núcleo lo mirase.

/** ¿Ya la miró alguien y dejó veredicto? */
function yaRevisada(task) {
  return Boolean(task && task.reviewed_at)
}

/** ¿Hay entregable, mirado o no? Es el predicado de «está en el circuito de revisión». */
function tieneEntrega(task) {
  return Boolean(task && task.review_requested_at)
}

/**
 * ¿Esta tarea está esperando que ALGUIEN la revise? (entregada y todavía SIN veredicto)
 *
 * Cuidado al tocarlo: el nombre promete «espera revisión», así que una vez revisada tiene que
 * decir `false`. Que dijera `true` para siempre es justo el defecto que se corrige aquí.
 */
function esperaRevision(task) {
  return tieneEntrega(task) && !yaRevisada(task)
}

/** ¿Ya tiene veredicto y lo que falta es que una PERSONA decida qué hacer con él? */
function esperaDecision(task) {
  return tieneEntrega(task) && yaRevisada(task)
}

/**
 * ¿El veredicto devuelve el trabajo a quien lo hizo?
 *
 * Un `problemas` NO es una espera: es trabajo pendiente otra vez. Por eso no bloquea el claim —
 * bloquearlo obligaba a `--force` para retomar algo que el propio veredicto pide retomar, y un
 * bloqueo que se satisface saltándoselo no protege nada (T-375).
 */
function devueltaConProblemas(task) {
  return esperaDecision(task) && task.review_verdict === 'problemas'
}

// ── UNA REVISIÓN NO PUEDE APROBAR TRABAJO QUE NO ESTÁ A SALVO (T-632) ────────────────────────
//
// Reconstruido el 06/08 sobre [T-560], y **nadie mintió en ningún paso**:
//   1. `w1` hizo el trabajo de verdad — commit `db2c44e2c`, tres consultas arregladas + un test.
//   2. `w2` lo revisó BIEN: leyó el diff línea a línea y **reprodujo la medición contra RDS** en
//      vez de fiarse del número. Veredicto `ok`, merecido.
//   3. `w1` no pudo empujarlo (sin credenciales de git, [T-628]).
//   4. Después su rama se movió, y el commit quedó **huérfano**: existe como objeto y NINGUNA
//      rama lo contiene. A un `git gc` de desaparecer.
// Resultado: una ficha que dice «arreglado», con veredicto `ok`, y el bug intacto en `main`.
//
// **El hueco no está en el trabajo ni en la revisión: está en QUÉ se revisó.** Se verificó un
// COMMIT, no un ESTADO ALCANZABLE. Un commit que no cuelga de ninguna referencia publicada no es
// un entregable, es un objeto suelto — y revisarlo da una garantía que se evapora sola.
//
// Se comprueba aquí, en el punto de escritura del veredicto, que es donde hay alguien delante y
// donde el dato es cierto (mismo principio que [T-620] con las esperas imposibles).

/**
 * ¿Se puede emitir un veredicto sobre esto?
 *
 * @param {{alcanzable?:boolean|null, referencias?:string[]}} hechos
 *   · `alcanzable` — ¿el trabajo entregado cuelga de alguna referencia REMOTA? `null` = no se
 *     pudo mirar (sin git, sin red), y entonces NO se bloquea: esto es una comprobación, no una
 *     autoridad, y dejar a la flota sin poder revisar por una avería local sería peor.
 *
 * @returns {{permitido:boolean, motivo:string}}
 */
function puedeRevisarse(hechos = {}) {
  if (hechos.alcanzable === false) {
    return {
      permitido: false,
      motivo: 'el trabajo entregado no cuelga de ninguna rama publicada: es un commit suelto que '
        + 'el recolector de basura se puede llevar, así que aprobarlo daría una garantía que se evapora',
    }
  }
  if (hechos.alcanzable === true) {
    return { permitido: true, motivo: `a salvo en ${(hechos.referencias || []).length || 'alguna'} referencia(s) remota(s)` }
  }
  return { permitido: true, motivo: 'no se ha podido comprobar si está a salvo (se deja pasar: esto no puede parar una revisión)' }
}

// ── QUÉ CLASE DE ESPERA ES UNA «REVISADA» (T-629) ────────────────────────────────────────────
//
// El cajón 🙋 se presenta entero como «esperando tu decisión», y NO lo está. Medido el 06/08: de
// 24 revisadas, **6 no esperaban ninguna decisión** — su nota decía *«CÓDIGO COMPLETO… PERO NO SE
// HA PODIDO PUSHEAR»*, o sea que esperaban una tubería ([T-628]), no un criterio. El panel pedía
// juicio sobre un fallo de infraestructura, y mientras estén mezcladas la cola no se puede vaciar
// por partes: o se lee entera o no se lee.
//
// Es el mismo patrón que [T-486] arregló un escalón más abajo: **una cola que parece esperar a una
// persona y en realidad espera a una máquina**.
//
// ⚠️ **EL CRITERIO POR PROSA ES FALSO, y está medido antes de escribir esto.** Clasificar leyendo
// `review_note` (buscar «rama», «commit», «pusheada»…) sobre las 27 reales deja **15 sin
// clasificar**. Quince de veintisiete es no tener criterio — la lección que este repo ya aprendió
// con `snooze_until`, `due_at` y `review_requested_at`: una condición en prosa no es una condición.
// Por eso aquí se decide con HECHOS que el llamante ya ha medido contra git.

/**
 * En qué clase de espera está una tarea ya revisada.
 *
 * No toca git ni la BD: recibe los hechos. Así se testea sin repositorio y el criterio vive en un
 * solo sitio, igual que el resto de este módulo.
 *
 * @param {{review_verdict?:string}} task
 * @param {{ramasSinFusionar?:number, tocaServido?:boolean}} hechos
 *   · `ramasSinFusionar` — cuántas ramas de `origin` que declaran esta tarea tienen contenido que
 *     `main` no tiene. **Medido por CONTENIDO, no por sha**: `git cherry` compara parches, así que
 *     una rama reescrita sigue marcando «único» aunque su contenido ya esté dentro (visto tres
 *     veces el 06/08 al rescatar `flota/w3`).
 *   · `tocaServido` — si su código llega a una superficie servida. Ahí decide una persona aunque
 *     el merge sea trivial: es el mismo criterio que la puerta del `done` ([T-392]).
 *
 * @returns {{clase:'criterio'|'solo_mergear'|'solo_cerrar', motivo:string}}
 */
function claseDeEspera(task, hechos = {}) {
  if (task && task.review_verdict === 'problemas') {
    return { clase: 'criterio', motivo: 'el veredicto la devuelve con problemas: hay que leerla' }
  }
  if (hechos.tocaServido) {
    return { clase: 'criterio', motivo: 'toca superficie servida: el merge lo decide una persona' }
  }
  const n = Number(hechos.ramasSinFusionar)
  if (Number.isFinite(n) && n > 0) {
    // Lo que se afirma es exactamente esto: existe una rama sin fusionar que DECLARA esta tarea.
    // NO es «su código no está en main» — la rama puede traer además trabajo de otras tareas, y
    // una parte del suyo puede estar ya dentro. Es un indicio fuerte, no una prueba, y por eso se
    // redacta así: quien lo lea tiene que saber qué se ha comprobado y qué no.
    return { clase: 'solo_mergear', motivo: `${n} rama(s) sin fusionar la declaran — hay que mirar el merge` }
  }
  if (n === 0) {
    // La asimetría manda: un falso «solo mergear» cuesta una mirada; un falso «solo cerrar»
    // cierra algo cuyo código no está vivo. Por eso esto solo se dice cuando NINGUNA rama sin
    // fusionar la nombra, que es la señal más conservadora disponible.
    return { clase: 'solo_cerrar', motivo: 'ninguna rama sin fusionar la declara: parece que solo falta cerrarla' }
  }
  // Sin medir no se afirma nada: se manda al cajón que SÍ mira una persona. Mismo criterio que
  // [T-615] — cuando no se ha podido comprobar, no se emite un veredicto tranquilizador.
  return { clase: 'criterio', motivo: 'no se ha podido mirar git: no se puede afirmar que sea mecánica' }
}

/**
 * En qué cajón cae una tarea que ya no está en curso.
 *
 * @returns 'revision' | 'decision' | 'verificacion'
 *
 * **La columna MANDA sobre el texto.** La heurística de `resume_check` se conserva solo para las
 * filas de antes de esta migración: sin ese respaldo, las tareas que hoy están en el cajón 🙋 por
 * su redacción se caerían al de «verificar» el día que esto entre, y eso es justo el fallo que se
 * está corrigiendo (una espera que se esconde no se hace).
 *
 * @param task            fila de backlog_tasks
 * @param clasificarTexto la heurística legacy (se inyecta para no duplicar criterio ni crear un ciclo)
 */
function clasificarEsperaTarea(task, clasificarTexto) {
  if (esperaRevision(task)) return 'revision'
  // Ya revisada = lo que queda es decidir, que es de Manuel. Va al MISMO cajón 🙋 que el resto de
  // decisiones suyas en vez de estrenar uno: un cajón nuevo por cada matiz es una lista que nadie
  // abre. Lo que lo distingue es la línea, que lleva el veredicto.
  if (esperaDecision(task)) return 'decision'
  if (typeof clasificarTexto === 'function') return clasificarTexto(task && task.resume_check)
  return 'verificacion'
}

/** Antigüedad legible en horas/días. Compartida por las dos líneas para no tener dos redacciones. */
function antiguedad(desde, ahora = new Date()) {
  const h = Math.floor((new Date(ahora).getTime() - new Date(desde).getTime()) / 3_600_000)
  if (h < 1) return 'hace menos de 1 h'
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} día(s)`
}

/**
 * Antigüedad legible de la PETICIÓN: una revisión que lleva días parada es el dato que importa.
 * Se mide sobre `tieneEntrega` y no sobre `esperaRevision` a propósito — así la línea de la ya
 * revisada también puede decir cuánto tardó en mirarse, que es la métrica del cuello de botella.
 */
function esperandoDesde(task, ahora = new Date()) {
  if (!tieneEntrega(task)) return null
  return antiguedad(task.review_requested_at, ahora)
}

/** Línea para `list`/`parte`. Dice qué revisar y desde cuándo espera, no solo que existe. */
function lineaRevision(task, ahora = new Date()) {
  if (!esperaRevision(task)) return null
  // Por SEGMENTO, no por longitud (T-538): cortar un sid por caracteres corta justo por donde no
  // es —lo distintivo va al principio— y cinco sesiones del mismo día acaban escribiéndose igual.
  const quien = task.review_requested_by ? ` · la dejó ${sidCorto(task.review_requested_by)}` : ''
  return `   ${task.id}  ${String(task.title || '').slice(0, 62)}\n` +
         `      🙋 esperando revisión ${esperandoDesde(task, ahora)}${quien}\n` +
         `      ▶ ${String(task.review_note || '').slice(0, 200)}`
}

/**
 * Línea para una tarea YA revisada. Lo que manda aquí es el VEREDICTO y los hallazgos: quien la
 * lee tiene que poder decidir sin abrir nada más. Sin esta línea, el resultado de la revisión solo
 * existía en una columna que ninguna pantalla enseñaba.
 */
function lineaRevisada(task, ahora = new Date()) {
  if (!esperaDecision(task)) return null
  const ok = task.review_verdict === 'ok'
  const quien = task.reviewed_by ? ` por ${sidCorto(task.reviewed_by)}` : ''
  const que = ok
    ? `✅ REVISADA sin problemas${quien} ${antiguedad(task.reviewed_at, ahora)} — decides tú si se mergea`
    : `⚠️  REVISADA CON PROBLEMAS${quien} ${antiguedad(task.reviewed_at, ahora)} — vuelve a quien la retome`
  return `   ${task.id}  ${String(task.title || '').slice(0, 62)}\n` +
         `      ${que}\n` +
         `      ▶ ${String(task.review_findings || '').slice(0, 300)}`
}

/**
 * Lo que hay que ESCRIBIR al retomar una tarea devuelta con problemas: el circuito se vacía para
 * que vuelva a estar «en curso», pero el veredicto NO se pierde — baja a `progress_note`.
 *
 * Se devuelve como datos y no como SQL para que el criterio sea testeable sin base de datos, igual
 * que hace `verificado` con `resume_check`. Borrarlo a secas dejaría a la siguiente sesión sin
 * saber por qué volvió, que es justo lo que la revisión acababa de averiguar.
 *
 * @returns {null|{nota: string}} null si esta tarea no es una devolución
 */
function retomarTrasProblemas(task) {
  if (!devueltaConProblemas(task)) return null
  const quien = task.reviewed_by ? sidCorto(task.reviewed_by) : 'otra sesión'
  // ⚠️ NO se recorta (T-518, 06/08/2026). Esta copia es la ÚNICA que sobrevive: al retomar,
  // `review_findings` se pone a NULL para vaciar el circuito, así que lo que no se copie aquí
  // deja de existir. Estaba cortado a 800 caracteres y los veredictos reales miden 2.400-4.600
  // (medido sobre los que aún no se habían retomado), o sea que retomar destruía el 70-85% del
  // trabajo de quien revisó — y precisamente la COLA, porque un veredicto empieza diciendo lo
  // que está bien y termina con los problemas. Dos tareas ya lo sufrieron, T-443 y T-518, las
  // dos cortadas en seco a 843 caracteres exactos (43 del prefijo + 800) en mitad de la frase
  // que enumeraba los hallazgos. El recorte no ahorraba nada: la columna es `text`. Para NO
  // inundar la pantalla, lo que se recorta es la IMPRESIÓN (`lineaRevisada`, 300), no el dato.
  return {
    nota: `DEVUELTA POR LA REVISIÓN (${quien}): ${String(task.review_findings || '')}`,
  }
}

/**
 * Reparte las revisadas en «ya no tienen rama pendiente» y «hay que mirar el merge». (T-720)
 *
 * PURO a propósito: recibe los hechos de git ya resueltos (`hechosDe(id)`), igual que
 * `claseDeEspera`, para poder probarlo sin repositorio. Quien pregunta a git es el llamante.
 *
 * POR QUÉ EXISTE: `reviewed_at` se pone y no se quita nunca, así que una tarea mergeada al minuto
 * siguiente seguía saliendo como pendiente para siempre. Medido el 08/08 al vaciar la cola: **29
 * de 36 ya estaban en `main`**. Una lista en la que 4 de cada 5 son fantasmas se deja de mirar, y
 * con ella se pierden las que sí piden merge.
 *
 * El criterio NO se reescribe: se delega en `claseDeEspera`, que ya sabe distinguir «ninguna rama
 * sin fusionar la declara» de «no se ha podido mirar git». Esa distinción es la que hace esto
 * seguro — sin medición, la tarea NO se da por integrada (fail-open hacia el trabajo humano).
 *
 * @param {Array<object>} revisadas  tareas que ya cumplen `esperaDecision`
 * @param {(id:string)=>object} hechosDe  hechos de git por tarea (`{}` si no se pudo mirar)
 * @returns {{integradas:object[], pendientes:object[]}}
 */
function repartirRevisadas(revisadas, hechosDe) {
  const integradas = []
  const pendientes = []
  for (const t of revisadas || []) {
    let clase = 'criterio'
    try {
      clase = claseDeEspera(t, typeof hechosDe === 'function' ? hechosDe(t.id) : {}).clase
    } catch {
      clase = 'criterio'                    // sin poder decidir, va al montón que mira una persona
    }
    ;(clase === 'solo_cerrar' ? integradas : pendientes).push(t)
  }
  return { integradas, pendientes }
}

module.exports = {
  ENTREGA_MIN, validarEntrega,
  tieneEntrega, yaRevisada, esperaRevision, esperaDecision, devueltaConProblemas,
  clasificarEsperaTarea, antiguedad, esperandoDesde, lineaRevision, lineaRevisada,
  retomarTrasProblemas, claseDeEspera, puedeRevisarse, repartirRevisadas,
}
