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

module.exports = {
  ENTREGA_MIN, validarEntrega,
  tieneEntrega, yaRevisada, esperaRevision, esperaDecision, devueltaConProblemas,
  clasificarEsperaTarea, antiguedad, esperandoDesde, lineaRevision, lineaRevisada,
  retomarTrasProblemas,
}
