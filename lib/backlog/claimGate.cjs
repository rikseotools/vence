'use strict'
const { sidCorto } = require('../sessions/sid.cjs')
// El circuito de revisión tiene UN solo criterio (T-486): quién espera revisor, quién espera
// decisión y quién vuelve al trabajo se decide en `revision.cjs`, no leyendo columnas a mano aquí.
const REV = require('./revision.cjs')
/**
 * La PUERTA del claim: ¿se puede coger esta tarea AHORA?
 *
 * ## Por qué existe (29/07/2026)
 *
 * Hasta hoy `claim` comprobaba dos cosas en su UPDATE atómico —que la tarea esté viva y que nadie
 * tenga el lease— y las otras dos condiciones (el reloj del aplazamiento y la dependencia de otra
 * tarea) solo se IMPRIMÍAN después, ya cogida. La migración del 28/07 lo dejó así a propósito:
 * *«claim no lo impide, solo avisa — a veces sí quieres adelantar el trabajo preparatorio»*.
 *
 * Medido 24 h después, no funcionó: **T-221 seguía con `⛔ NO COGER HASTA EL 29/07 07:00 UTC` en
 * el TÍTULO**, con el campo `snooze_until` ya disponible, y T-234 hacía lo mismo con `⏱ MEDIR EL
 * 11/08`. Cuando alguien escala a mayúsculas en el título es que no se fía del aviso. Y un título
 * no vence solo: la fecha de T-221 pasó y el texto sigue diciendo "no coger".
 *
 * Las colas de trabajo llevan décadas resolviéndolo igual (DelaySeconds de SQS, scheduled sets de
 * Sidekiq, ETA de Celery, colas sobre Postgres con `run_at`): **un trabajo aplazado no se avisa,
 * no se entrega**. La condición vive en la consulta que reparte, no en la disciplina de quien coge.
 *
 * El caso legítimo que defendía el aviso no se pierde: pasa a ser explícito y registrado
 * (`claim --force --motivo "…"`, que guarda `force_claim_reason`).
 *
 * ## Reparto de responsabilidades
 *
 * - La ENFORCEMENT vive en el SQL del `claim` (atómica, con el reloj del SERVIDOR: con 2-10
 *   sesiones el reloj de cada portátil no es una fuente de verdad).
 * - Aquí vive la DECISIÓN pura: por qué no se puede y si es forzable. La usa el CLI para explicar
 *   el fallo y los tests para fijarla. Una sola implementación, sin copias.
 */

const CERRADAS = ['done', 'dropped']

/**
 * @param {{status:string, claimed_by:string|null, lease_until:string|Date|null,
 *          snooze_until?:string|Date|null, snooze_reason?:string|null, blocked_by?:string[]}} task
 * @param {string} sid  sesión que intenta cogerla
 * @param {Date} now
 * @param {Set<string>} openIds  ids de tareas VIVAS (para resolver blocked_by)
 * @returns {{ok:boolean, code:'ok'|'closed'|'leased'|'snoozed'|'awaiting_deploy'|'blocked', reason:string|null, forzable:boolean}}
 */
function claimGate(task, sid, now = new Date(), openIds = new Set()) {
  if (CERRADAS.includes(task.status)) {
    return { ok: false, code: 'closed', reason: `ya está cerrada (${task.status})`, forzable: false }
  }

  // 1. Lease ajeno vivo. NO forzable: forzarlo es pisar el trabajo de otra sesión.
  const lease = task.lease_until == null ? null : new Date(task.lease_until)
  const leaseVivo = lease != null && lease.getTime() >= now.getTime()
  const ajena = task.claimed_by != null && task.claimed_by !== sid
  if (ajena && leaseVivo) {
    const mins = Math.max(0, Math.round((lease.getTime() - now.getTime()) / 60000))
    return {
      ok: false,
      code: 'leased',
      reason: `la tiene ${sidCorto(task.claimed_by)} (lease vivo, ${mins} min)`,
      forzable: false,
    }
  }

  // 2. Reloj. SÍ forzable: adelantar la preparación es legítimo si se declara.
  //    Aplica también a la sesión DUEÑA: que la tarea sea tuya no adelanta una fecha externa.
  const snooze = task.snooze_until == null ? null : new Date(task.snooze_until)
  if (snooze != null && snooze.getTime() > now.getTime()) {
    const motivo = task.snooze_reason ? ` — ${task.snooze_reason}` : ''
    return {
      ok: false,
      code: 'snoozed',
      reason: `en espera hasta ${snooze.toISOString()}${motivo}`,
      forzable: true,
    }
  }

  // 2.bis. Espera a que una PERSONA la revise (T-539). SÍ forzable, pero rara vez debería serlo:
  //    forzarla significa seguir trabajando sobre un entregable que nadie ha mirado, que es
  //    exactamente lo que convierte una flota en más trabajo de revisión, no en menos. Va ANTES
  //    del deploy porque una entrega sin revisar no se arregla desplegando.
  //
  //    ⚠️ TRES desenlaces, no uno (T-486, 06/08). Hasta hoy bastaba con `review_requested_at` y
  //    eso metía en el mismo saco a la que nadie ha mirado y a la que ya tiene veredicto. Medido:
  //    una devuelta con `problemas` —cuyo propio veredicto pide retomarla— contestaba «esperando
  //    revisión humana» y exigía `--force`. Un bloqueo que se satisface saltándoselo no protege
  //    nada, y además ensucia el contador de escapes con motivos inventados (misma lección T-375).
  if (REV.esperaRevision(task)) {
    // Por SEGMENTO, no por longitud (T-538): a 8-14 caracteres las cinco sesiones de un mismo día
    // se escriben igual, y quien lee reconoce como suya una fila ajena.
    const quien = task.review_requested_by ? ` (la dejó ${sidCorto(task.review_requested_by)})` : ''
    return {
      ok: false,
      code: 'awaiting_review',
      reason: `entregada y esperando revisión humana${quien}`,
      forzable: true,
    }
  }

  // 2.ter. Revisada y SIN problemas: lo único que falta es que una persona la mergee/cierre.
  //    Sigue bloqueando —ponerse a trabajar encima de un entregable ya aprobado es rehacerlo—
  //    pero lo dice con su motivo real, para que quien lo lea sepa que la pelota es de Manuel.
  if (REV.esperaDecision(task) && !REV.devueltaConProblemas(task)) {
    const quien = task.reviewed_by ? ` (la revisó ${sidCorto(task.reviewed_by)})` : ''
    return {
      ok: false,
      code: 'awaiting_decision',
      reason: `ya revisada y SIN problemas${quien}: falta que una persona la mergee, no más trabajo`,
      forzable: true,
    }
  }

  // …y la devuelta con `problemas` NO bloquea: cae hasta el final y se entrega como cualquier
  // tarea libre. Quien la coja recibe el veredicto en la ficha (ver `retomarTrasProblemas`).

  // 3. Espera a un DEPLOY. SÍ forzable.
  //    No es un reloj: no hay fecha que poner, hay una CONDICIÓN ("mi commit ya está vivo").
  //    Poner una fecha a ojo es peor que no poner nada — si te quedas corto la tarea despierta
  //    y sigue sin poder verificarse, y si te pasas duerme de más.
  if (task.wake_on_deploy_sha) {
    const donde = task.wake_on_deploy_surface && task.wake_on_deploy_surface !== 'both'
      ? ` en ${task.wake_on_deploy_surface}`
      : ''
    return {
      ok: false,
      code: 'awaiting_deploy',
      reason: `espera a que se despliegue ${String(task.wake_on_deploy_sha).slice(0, 8)}${donde}`,
      forzable: true,
    }
  }

  // 4. Dependencia de otra tarea NUESTRA que sigue abierta. SÍ forzable.
  const deps = (task.blocked_by || []).filter((dep) => openIds.has(dep))
  if (deps.length > 0) {
    return {
      ok: false,
      code: 'blocked',
      reason: `depende de ${deps.join(', ')}, que sigue(n) abierta(s)`,
      forzable: true,
    }
  }

  return { ok: true, code: 'ok', reason: null, forzable: false }
}

/**
 * Aplazamiento crónico: a partir de `umbral` veces, aplazar dejó de ser programar y es no decidir.
 * No lo impide —a veces la fecha externa se mueve de verdad— pero deja de ser invisible.
 * @param {{snooze_count?:number|null}} task
 */
function isChronicSnooze(task, umbral = 3) {
  return (task.snooze_count ?? 0) >= umbral
}

/**
 * ¿Se puede despertar una tarea que espera deploy, sabiendo qué sha hay vivo en cada superficie?
 *
 * Puro a propósito: el "está contenido en" lo resuelve git (`merge-base --is-ancestor`) y el sha
 * vivo lo da `/api/health`; aquí solo vive la REGLA, que es lo que hay que poder testear sin red.
 *
 * @param {{wake_on_deploy_sha?:string|null, wake_on_deploy_surface?:string|null}} task
 * @param {{frontend?:boolean, backend?:boolean}} contiene  ¿cada superficie contiene ya el commit?
 */
function deployWakeReady(task, contiene) {
  if (!task.wake_on_deploy_sha) return true
  const surface = task.wake_on_deploy_surface || 'both'
  if (surface === 'frontend') return contiene.frontend === true
  if (surface === 'backend') return contiene.backend === true
  // 'both': hace falta que las DOS lo tengan. Despertar con media verdad manda a alguien a
  // verificar algo que aún no está entero.
  return contiene.frontend === true && contiene.backend === true
}

/**
 * ¿Esta tarea está DESPIERTA y esperando que alguien verifique lo que quedó pendiente?
 *
 * El aviso de que un deploy despertó una tarea se imprimía SOLO en el log del deploy —al final
 * de 10-15 minutos de salida, y únicamente para quien desplegó—. La sesión que la pausó no se
 * enteraba, así que la tarea se quedaba lista para verificar sin que nadie lo supiera. Este
 * predicado es lo que permite sacarlas a la superficie donde las sesiones ya miran (`list`).
 *
 * Una tarea cuenta como "lista para verificar" cuando:
 *   · alguien la pausó dejando escrito qué falta (`resume_check`),
 *   · ya no espera un deploy (`wake_on_deploy_sha` a NULL = el deploy la despertó),
 *   · ya no espera un reloj (`snooze_until` vencido o ausente),
 *   · y NADIE la está trabajando ahora mismo (si hay lease vivo, su dueño ya la tiene).
 *
 * @param {{resume_check?:string|null, wake_on_deploy_sha?:string|null, snooze_until?:string|Date|null,
 *          claimed_by?:string|null, lease_until?:string|Date|null, status?:string}} task
 * @param {Date} [now]
 */
function isAwaitingVerification(task, now = new Date()) {
  if (!task || !task.resume_check) return false
  // Esperar REVISIÓN no es esperar verificación (T-539): la primera la desbloquea una persona
  // mirando el entregable, la segunda la desbloqueamos nosotros comprobando producción. Mezclarlas
  // mandaría a una sesión a "cerrar en minutos" algo que aún nadie ha aprobado.
  // Entregada —mirada o no— NO es «lista para verificar»: la desbloquea una persona, no una
  // comprobación nuestra en producción. Vale para las tres (sin revisar, revisada ok, devuelta).
  if (REV.tieneEntrega(task)) return false
  if (task.status && !['open', 'in_progress', 'blocked'].includes(task.status)) return false
  if (task.wake_on_deploy_sha) return false        // sigue esperando el deploy
  if (task.snooze_until && new Date(task.snooze_until).getTime() > now.getTime()) return false
  // Lease VIVO = ya tiene dueño trabajándola; no es un aviso para el resto.
  if (task.lease_until && new Date(task.lease_until).getTime() > now.getTime()) return false
  return true
}

/**
 * ¿Se puede marcar esta tarea como VERIFICADA sin cerrarla? (T-449)
 *
 * Es el gemelo que le faltaba a `pause`: uno dice «aún no se puede comprobar», el otro «ya se
 * comprobó y sigue habiendo trabajo». Sin él, una tarea verificada que sigue viva **no tenía cómo
 * decirlo**: `done` la cerraría en falso, `pause` tendría que inventarse una espera —lo mismo que
 * un CHECK impide en `due_at`— y `release` no toca `resume_check`, así que la suelta con el texto
 * obsoleto intacto.
 *
 * COSTÓ TIEMPO REAL el 01/08: `list` ofrecía [T-385] arriba del todo como «IMPLEMENTADA Y SIN
 * COMPROBAR» con un pendiente que otra sesión acababa de resolver; la sesión `centro-inferior`
 * montó un worktree y la reclamó para repetir trabajo hecho. Y lo paga siempre la sesión más
 * diligente: la que hace caso al orden sugerido.
 *
 * Reglas, y todas dicen que NO por un motivo distinto:
 *   · sin `resume_check` no hay nada que marcar (evita el uso decorativo del verbo);
 *   · una tarea CERRADA no se verifica: se reabre;
 *   · si TODAVÍA espera (deploy o reloj), la comprobación no ha podido hacerse — marcarla sería
 *     exactamente la mentira que este verbo viene a borrar;
 *   · y no se toca la que otra sesión tiene con lease VIVO: su dueño sabe mejor si comprobó.
 *
 * @returns {{ok:true} | {ok:false, motivo:string}}
 */
function puedeMarcarseVerificada(task, sid, now = new Date()) {
  if (!task) return { ok: false, motivo: 'no existe' }
  if (task.status && !['open', 'in_progress', 'blocked'].includes(task.status)) {
    return { ok: false, motivo: `está ${task.status}: una tarea cerrada no se verifica, se reabre` }
  }
  if (!task.resume_check) {
    return { ok: false, motivo: 'no tenía nada pendiente de comprobar (`resume_check` vacío)' }
  }
  if (task.wake_on_deploy_sha) {
    return { ok: false, motivo: 'sigue esperando un DEPLOY: si no está vivo, no has podido comprobarlo' }
  }
  if (task.snooze_until && new Date(task.snooze_until).getTime() > now.getTime()) {
    return { ok: false, motivo: 'sigue esperando un RELOJ: hasta esa hora no hay nada que mirar' }
  }
  const leaseVivo = task.lease_until && new Date(task.lease_until).getTime() > now.getTime()
  if (leaseVivo && task.claimed_by && task.claimed_by !== sid) {
    return { ok: false, motivo: `la tiene ${sidCorto(task.claimed_by)} con lease vivo — coordina` }
  }
  return { ok: true }
}

/**
 * Deuda de deploy de UNA superficie: qué hay pusheado en `main` que todavía no está vivo.
 *
 * Puro a propósito — el sha vivo lo da `/api/health` y la lista de commits la da git; aquí solo
 * vive la LECTURA, que es la que decide si toca desplegar o esperar a juntar más.
 *
 * La política del proyecto es AGRUPAR: una sola sesión despliega por todas, porque cada deploy
 * cuesta build + minutos de Fargate y, con 2-10 sesiones pusheando, desplegar por cada push
 * multiplica ese gasto sin que nada llegue antes. Por eso lo que importa no es "¿hay algo sin
 * desplegar?" (casi siempre sí) sino **¿hay alguien ESPERÁNDOLO?**: una tarea pausada
 * `--tras-deploy` es trabajo terminado que no se puede cerrar hasta que se despliegue.
 *
 * @param {{commits:number, tareasEsperando:number}} input
 * @returns {{nivel:'al-dia'|'acumulando'|'toca-desplegar', motivo:string}}
 */
function deployDebtLevel({ commits = 0, tareasEsperando = 0 } = {}) {
  if (commits <= 0) return { nivel: 'al-dia', motivo: 'nada sin desplegar' }
  if (tareasEsperando > 0) {
    return {
      nivel: 'toca-desplegar',
      motivo: `${tareasEsperando} tarea(s) terminada(s) esperando este deploy para poder cerrarse`,
    }
  }
  return {
    nivel: 'acumulando',
    motivo: `${commits} commit(s) sin desplegar y nadie esperándolos — se puede seguir agrupando`,
  }
}


/**
 * De qué tipo de espera se trata, leyendo lo que dejó escrito quien la pausó.
 *
 * Nace de una observación de Manuel (30/07): en «listas para verificar» estaban mezcladas dos
 * cosas que se atienden de forma distinta. De seis tareas despiertas, solo tres esperaban una
 * comprobación NUESTRA; las otras tres esperaban una DECISIÓN suya (encender un flag, aprobar un
 * plan, elegir un diseño). Por muy despiertas que estén, Claude no puede cerrarlas — y ahí
 * llevaban 10, 16 y 1 horas sin que nadie se las pusiera delante.
 *
 * La heurística mira el texto porque no hay campo para esto y añadir uno costaría una migración
 * para algo que se resuelve leyendo lo que la gente YA escribe. Ante la duda devuelve
 * `verificacion`: que una decisión se cuele en la lista de verificar molesta; que una verificación
 * se esconda en «esperando a Manuel» la deja sin hacer.
 *
 * @param {string|null|undefined} resumeCheck
 * @returns {'verificacion'|'decision'}
 */
function clasificarEspera(resumeCheck) {
  if (!resumeCheck || typeof resumeCheck !== 'string') return 'verificacion'
  const t = resumeCheck.toLowerCase()
  const pideDecision =
    /decisi[oó]n de manuel/.test(t) ||
    /esperando a que manuel/.test(t) ||
    /ok de manuel/.test(t) ||
    /\bdecidir\b/.test(t) ||
    /aprobaci[oó]n de manuel/.test(t)
  return pideDecision ? 'decision' : 'verificacion'
}


/**
 * ¿El texto con el que se cierra una tarea CONFIESA que queda trabajo?
 *
 * Nace de una observación de Manuel (30/07): *"si no se quedan en el olvido y tengo que fiarme de
 * que tú te acuerdes de ponerles un temporizador"*. Exacto — y esa es la parte que no puede
 * depender de la memoria de nadie. Cerrar con un `outcome` que dice «PENDIENTE: desplegar» deja la
 * tarea fuera del backlog **y** el trabajo sin hacer: lo peor de los dos mundos, porque además
 * parece terminada.
 *
 * El CLI usa esto para NEGARSE a cerrar y mandar a `pause`, que sí programa el regreso (por deploy
 * o por reloj). No es un aviso: es una puerta. Un aviso se ignora cuando hay prisa, que es
 * justamente cuando se cierra en falso.
 *
 * Se mira el texto porque es donde la gente ya escribe la verdad. Los marcadores son los que
 * aparecen de verdad en las fichas del proyecto.
 *
 * @param {string|null|undefined} outcome
 * @returns {{pendiente: boolean, motivo: string|null}}
 */
function detectarTrabajoPendiente(outcome) {
  if (!outcome || typeof outcome !== 'string') return { pendiente: false, motivo: null }
  const t = outcome.toLowerCase()

  // EXENCIONES: narrar en pasado un pendiente YA resuelto NO es dejar trabajo. Salieron de los
  // outcomes reales del proyecto al revisar 70 cierres (30/07): «el pendiente ERA Osakidetza…»,
  // «ya estaba resuelta», «censo posterior: 0». Sin esto, la puerta bloquearía cierres legítimos
  // y acabaría esquivándose con `--igualmente`, que es como muere un guardarraíl.
  const narraPasado =
    /\bel pendiente era\b|\bya estaba resuelt|\bya venía de\b|\bya existía\b/.test(t) ||
    /censo posterior:?\s*0\b|quedan?\s*0\b|->\s*0\b|→\s*0\b/.test(t) ||
    /\b(cancelada|wontfix|descartada)\b/.test(t)
  if (narraPasado) return { pendiente: false, motivo: null }

  // ── UNA MEDIDA DEL PASADO NO ES UN PLAZO (T-499, 03/08/2026) ─────────────────────────────
  // El marcador temporal («en N días») nació para cazar la promesa *«medir en 14 días»*. Pero
  // casa igual con *«medido sobre 30 días de historial»*, que es justo lo contrario: una medida
  // YA hecha. Pasó cerrando [T-497] y costó caro — al aislar qué disparaba la puerta, la tarea se
  // cerró con el outcome literal «test» y hubo que reabrirla.
  //
  // La exención se aplica **solo al marcador temporal** y solo si el contexto INMEDIATO delata el
  // pasado. Relajar el patrón entero abriría el caso que la puerta existe para cazar ([T-363] se
  // cerró con el código sin desplegar y un outcome que sonaba terminado): esto es un matiz, no
  // una amnistía.
  const PASADO = /\b(últimos?|ultimos?|última|ultima|historial|medid[oa]s?|midi[oó]|contad[oa]s?|durante|pasad[oa]s?|hace|llevaba|llevaban|recogid[oa]s?)\b/

  /** ¿El «en N días» que se ha encontrado habla de una ventana ya medida? */
  // Ventana CORTA a propósito (30 caracteres antes, 25 después): con una ventana ancha, un
  // outcome que mezcla las dos cosas —«medido hace 30 días; hay que repetirlo en 14 días»— se
  // exime entero por la palabra del principio, y ahí sí queda trabajo. La pista tiene que estar
  // pegada a la fecha.
  const esMedidaPasada = (texto, indice) => {
    const antes = texto.slice(Math.max(0, indice - 30), indice)
    if (PASADO.test(antes + texto.slice(indice, indice + 25))) return true
    // ── T-531: «9 eventos EN 2 DÍAS» ────────────────────────────────────────────────────────
    // Lo que separa una ventana ya medida de una promesa es lo que va DELANTE, y no siempre es
    // una de las palabras de PASADO: en «9 eventos en 2 días» el delator es que ahí hay una
    // CANTIDAD contada. Una promesa, en cambio, lleva un verbo («medir en 14 días»). Se mira
    // solo lo pegado a la fecha, igual que el resto de esta exención.
    return /\b\d[\d.,]*\s+[a-záéíóúñ]+(?:s)?\s*$/i.test(antes)
  }

  /**
   * ¿El disparo cae dentro de una CITA de lo que la tarea pedía, en vez de anunciar trabajo?
   *
   * [T-531] Un outcome bueno suele describir el pendiente que acaba de resolver —«la descripción
   * de lo que hay que comprobar sigue ahí detrás»—, y ahí «hay que comprobar» no promete nada:
   * está entrecomillando el enunciado. El corte es estrecho a propósito: exige un sustantivo de
   * CITA pegado delante y el «lo que» que lo convierte en sintagma. Sin esas dos condiciones,
   * «hay que comprobar X» sigue abortando, que es para lo que está la puerta.
   */
  const CITA = /\b(descripci[oó]n|texto|enunciado|ficha|nota|recordatorio|resume_check|pendiente|apartado)\b[^.]{0,18}\blo que\s*$/
  const esCitaDelEnunciado = (texto, indice) => CITA.test(texto.slice(Math.max(0, indice - 60), indice))

  /**
   * ¿«pendiente» se está usando como SUSTANTIVO —el texto guardado— y no como adjetivo?
   *
   * [T-531] «el pendiente COMPLETO sigue ahí» habla del `resume_check`, no de trabajo. Se exige
   * un determinante delante Y un calificador que delate que se refiere al texto; «el pendiente
   * sigue ahí» a secas NO se exime, porque eso sí puede significar que queda trabajo, y abrir esa
   * puerta es justo el caso para el que nació ([T-363], cobros cerrados sin desplegar).
   */
  const PENDIENTE_SUSTANTIVO = /\b(el|ese|este|su|mi)\s+pendiente\s+(anterior|previo|completo|entero|original|de la ficha)\b/

  const marcadores = [
    [/\bpendiente\b(?!\s+de\s+nada)/, 'dice "pendiente"'],
    [/\bfalta\b|\bfaltan\b/, 'dice "falta/faltan"'],
    [/\bqueda\b|\bquedan\b/, 'dice "queda/quedan"'],
    [/sin desplegar|no desplegad|falta desplegar|hay que desplegar/, 'menciona que falta desplegar'],
    [/\bhay que (verificar|comprobar|medir|revisar)\b/, 'menciona una comprobación por hacer'],
    [/\bverificar (tras|despu[eé]s|cuando)\b/, 'aplaza una verificación'],
    [/\bmañana\b|\ben \d+ (d[ií]as?|horas?)\b/, 'apunta a un momento futuro'],
  ]
  /**
   * ¿La palabra que ha disparado está ENTRECOMILLADA, es decir, se la nombra en vez de usarla?
   *
   * [T-531] Un outcome que habla de la propia puerta escribe cosas como «se rechazaba por
   * "quedan"», y ahí la palabra es el OBJETO de la frase, no una confesión. Salió cerrando esta
   * misma tarea: el texto que explicaba el arreglo lo bloqueaba el arreglo.
   *
   * Corte deliberadamente mínimo: las comillas tienen que abrazar la palabra, pegadas. Citar una
   * FRASE entera («queda por verificar») no se exime, porque ahí sí se está describiendo trabajo.
   */
  const ABRE = ['«', '"', '‘', '“', "'"]
  const CIERRA = ['»', '"', '’', '”', "'"]
  const esPalabraCitada = (texto, indice, palabra) =>
    ABRE.includes(texto[indice - 1]) && CIERRA.includes(texto[indice + palabra.length])

  for (const [re, motivo] of marcadores) {
    const m = t.match(re)
    if (!m) continue
    if (esPalabraCitada(t, m.index, m[0])) continue
    if (motivo === 'apunta a un momento futuro' && esMedidaPasada(t, m.index)) continue
    if (motivo === 'menciona una comprobación por hacer' && esCitaDelEnunciado(t, m.index)) continue
    if (motivo === 'dice "pendiente"' && PENDIENTE_SUSTANTIVO.test(t)) continue
    // `fragmento` no es adorno: un guardarraíl que no dice QUÉ frase lo disparó empuja a probar
    // con basura hasta que pasa — que es literalmente lo que ocurrió al cerrar [T-497].
    return { pendiente: true, motivo, fragmento: m[0] }
  }
  return { pendiente: false, motivo: null }
}

module.exports = {
  claimGate,
  isChronicSnooze,
  deployWakeReady,
  isAwaitingVerification,
  puedeMarcarseVerificada,
  deployDebtLevel,
  clasificarEspera,
  detectarTrabajoPendiente,
}
