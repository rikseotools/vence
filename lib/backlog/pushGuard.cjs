// lib/backlog/pushGuard.cjs — lógica PURA del guardrail de push del backlog (sin BD, sin git).
const { sidCorto } = require('../sessions/sid.cjs')
// El criterio de «revisada y solo falta mergear» es de `revision.cjs` (T-539/T-486) — el MISMO
// que usa `claimGate` para negarse a entregar el claim (T-665: dos puertas, un solo criterio).
const REV = require('./revision.cjs')
//
// Por qué existe: el claim atómico (`backlog_tasks` + `scripts/backlog.cjs claim`) impide que
// dos sesiones cojan la MISMA fila, pero NADA obliga a reclamar antes de trabajar. El fallo real
// es el OLVIDO (colisión T-047/T-050 del 20/07: dos sesiones tocaron el mismo tema sin claim).
//
// Este guardrail cierra ese hueco en el punto donde el olvido hace daño: el PUSH (cuando el
// trabajo se comparte). Si un commit que empujas menciona un `T-NNN` que está VIVO en el
// registro y NO tienes tú, bloquea. Un commit local sin pushear no molesta a nadie → el guard
// va en pre-push, no pre-commit.
//
// JS plano (no .ts) a propósito: el hook de husky corre `node` pelado y el test hace `require`
// de ESTE mismo fichero → una sola fuente de verdad, sin copia que se desincronice (misma
// lección que lib/backlog/claim.ts).

const OPEN_STATUSES = ['open', 'in_progress', 'blocked']

/** El fichero de fichas: un push que SOLO lo toca es papeleo de backlog, no trabajo. Ver `esSoloFichas`. */
const MD_BACKLOG = 'docs/roadmap/tareas-pendientes.md'

/** Extrae los ids `T-NNN` únicos de un texto (mensajes de commit + nombre de rama). */
function extractTaskIds(text) {
  const ids = new Set()
  for (const m of String(text || '').matchAll(/\bT-\d{3}\b/g)) ids.add(m[0])
  return [...ids]
}

/**
 * Separadores de registro/campo del `git log` que lee el bridge (ASCII 30/31: no aparecen en un
 * mensaje de commit). Viven aquí, junto al parser, para que el formato que PIDE el bridge y el
 * que ESPERA el parser no puedan divergir.
 */
const RS = '\x1e'
const FS = '\x1f'
/** Formato de `git log` que produce lo que `parseGitLog` sabe leer. */
const GIT_LOG_FORMAT = `--format=${RS}%s${FS}%b`

/**
 * Parsea la salida de `git log ${GIT_LOG_FORMAT}` → [{ subject, body }].
 *
 * Está en el núcleo puro (y no en el bridge, que es donde nació) porque de este parseo depende
 * toda la regla de T-403: si el asunto y el cuerpo se mezclan, cada cita vuelve a bloquear. Un
 * trozo de pegamento sin test es justo donde se pierde la distinción que el resto del fichero
 * defiende.
 */
function parseGitLog(raw) {
  return String(raw || '')
    .split(RS)
    .filter((r) => r.trim())
    .map((r) => {
      const i = r.indexOf(FS)
      return i === -1
        ? { subject: r.trim(), body: '' }
        : { subject: r.slice(0, i).trim(), body: r.slice(i + 1) }
    })
}

/**
 * Separa lo que el push DECLARA como trabajo de lo que solo CITA como contexto (T-403).
 *
 * El guard trataba las dos cosas igual, y las fichas de este repo se cruzan sin parar
 * (`Relacionadas: [T-xxx]`). Resultado: cuanto mejor escrito el commit, más probable que lo
 * parase. Pasó dos veces el 31/07 —`feat(T-400)` citando T-361/T-385, y `fix(T-408, T-410)`
 * citando T-321— y las tres salidas eran malas: reclamar una tarea que no vas a trabajar (le
 * robas el reparto a quien sí), `BACKLOG_GUARD_SKIP=1` (apaga el guard ENTERO para todo el
 * push) o quitar el id del mensaje (el commit explica menos, que es lo contrario de lo que
 * quiere el repo).
 *
 * Regla, y por qué es ESTA y no la que decía la ficha:
 *
 *   · Un commit cuyo asunto YA declara un id → los ids que solo salen en su cuerpo son CITAS.
 *   · Un commit cuyo asunto NO declara ningún id → **todos** sus ids siguen exigiendo claim,
 *     también los del cuerpo. Ahí el commit no declara tarea ninguna, así que el id del cuerpo
 *     bien puede ser el trabajo.
 *   · Los ids del nombre de la RAMA declaran trabajo (`feat/T-042-…`).
 *   · Basta que UN commit del push lo declare para que el id sea trabajo en todo el push.
 *
 * MEDIDO sobre los 6.070 commits del repo (1.111 mencionan algún `T-NNN`), contando como
 * evidencia de trabajo real que el commit toque un fichero DISTINTIVO de esa tarea —de los que
 * declaran ≤2 tareas distintas; sin ese filtro `scripts/backlog.cjs` o `alert-rules.ts` hacen
 * culpable a cualquiera—:
 *
 *   · asunto CON id + ids extra en el cuerpo: 217 commits, 323 citas → **9 (2,8 %)** con
 *     fichero distintivo, y las 6 revisadas a mano eran contexto o tarea vecina que comparte
 *     fichero. Esta es la banda que se relaja.
 *   · asunto SIN ningún id: 205 commits, 349 menciones → **60 (17,2 %)** con fichero
 *     distintivo, 22 de ellas de una sola tarea (T-089, cuyos commits se titulan
 *     `docs(koigrid): …` y dejan el id en el cuerpo). Esa es trabajo declarado solo en el
 *     cuerpo, y por eso la banda NO se relaja: la regla literal de la ficha —«el cuerpo nunca
 *     bloquea»— habría abierto ese 17 %.
 *
 * @param commits [{ subject, body }] de los commits que se empujan.
 * @param branch  nombre de la rama (sus ids declaran trabajo).
 * @returns { referencedIds, mencionSolo } — `referencedIds` sigue siendo TODO lo mencionado
 *          (quien decide necesita verlos para poder avisar); `mencionSolo` son los que no
 *          bloquean.
 */
function clasificarMenciones({ commits = [], branch = '' } = {}) {
  const declarados = new Set(extractTaskIds(branch))
  const citados = new Set()

  for (const c of commits || []) {
    const enAsunto = extractTaskIds(c && c.subject)
    const enCuerpo = extractTaskIds(c && c.body)
    if (enAsunto.length === 0) {
      // El commit no declara tarea: no se puede afirmar que el id del cuerpo sea una cita.
      for (const id of enCuerpo) declarados.add(id)
      continue
    }
    for (const id of enAsunto) declarados.add(id)
    for (const id of enCuerpo) if (!enAsunto.includes(id)) citados.add(id)
  }

  const mencionSolo = [...citados].filter((id) => !declarados.has(id))
  return { referencedIds: [...new Set([...declarados, ...mencionSolo])], mencionSolo }
}

/**
 * ¿El push toca ÚNICAMENTE el markdown de fichas?
 *
 * Documentar una ficha no es trabajarla, y hasta el 31/07 el guard no distinguía las dos cosas:
 * al abrir [T-377] para dejar constancia de 22 suites rojas que NO se iban a atacar, mencionarla
 * en el mensaje del commit bastó para exigir un claim. Reclamar una tarea que no vas a trabajar
 * es PEOR que no reclamar — se la quitas a quien sí iba a hacerla.
 *
 * El corte es deliberadamente estrecho: SOLO este fichero. Escribir un runbook en `docs/` sí es
 * trabajo y sigue pidiendo claim. Y las ediciones concurrentes de este markdown ya las caza git
 * con un conflicto de fusión — no es este guard quien lo protege.
 */
function esSoloFichas(changedFiles) {
  const f = (changedFiles || []).filter(Boolean)
  return f.length > 0 && f.every((p) => String(p).trim() === MD_BACKLOG)
}

/**
 * ¿Se permite el push? Lógica pura: decide con los ids referenciados + el estado de esas
 * tareas + la sesión actual. La BD y git los inyecta el bridge (scripts/backlog-push-guard.cjs).
 *
 * @param referencedIds  ids `T-NNN` que aparecen en los commits/rama que se empujan.
 * @param tasksById      Map|objeto id → { status, claimed_by, lease_until, snoozed_by,
 *                       snooze_until, wake_on_deploy_sha, review_requested_at, reviewed_at,
 *                       review_verdict } (solo los que existan).
 * @param sid            session-id de esta sesión.
 * @param changedFiles   ficheros que toca el push (para el caso «solo documento la ficha»).
 * @param mencionSolo    ids que el push CITA sin declararlos como trabajo (`clasificarMenciones`).
 * @returns { allowed, violations: [{ id, reason }], notices: [{ id, reason }] }
 *
 * Regla de bloqueo (una tarea es violación SI y SOLO SI):
 *   · existe en el registro (una mención suelta a un id inexistente NO bloquea), Y
 *   · está VIVA (open/in_progress/blocked — una cerrada done/dropped no pide lease), Y
 *   · NO la tienes tú (`claimed_by !== sid`), Y
 *   · el push la DECLARA como trabajo, no solo la cita (ver «cita ≠ trabajo»), Y
 *   · NO la pausaste tú (ver «pausa propia»), Y
 *   · su lease sigue VIVO (ver «lease muerto»).
 *
 * Si la fila es tuya (`claimed_by === sid`) se permite aunque el lease esté caducado: la fila
 * SIGUE siendo tuya (el lease caducado solo importa para que OTRA sesión pueda robarla; si nadie
 * la robó, tu push es legítimo). En cuanto otra sesión la coge, `claimed_by` deja de ser tuyo y
 * vuelve a bloquear.
 *
 * ── LEASE MUERTO (arreglado 31/07) ──────────────────────────────────────────────────────────
 * `claim` entrega una tarea cuyo `lease_until` ya pasó (`claimed_by IS NULL OR claimed_by = sid
 * OR lease_until < now()`): el arriendo es renovable, y una sesión que muere libera su tarea
 * sola. Este guard lo ignoraba y seguía diciendo «la tiene la sesión X — coordina o espera a que
 * libere» de una sesión muerta hace días, que no va a liberar nada nunca. Medido el 31/07:
 * T-214, T-221 y T-238 llevaban 72-79 h así, y bloqueaban a cualquiera que las mencionase.
 * La única salida era `BACKLOG_GUARD_SKIP=1`, que apaga el guard ENTERO — o sea, el bloqueo
 * imposible de satisfacer enseñaba a saltarse la protección para todo lo demás.
 *
 * No abre el hueco que el guard existe para cazar (el OLVIDO de reclamar): si no reclamaste, la
 * fila está sin dueño y sigue bloqueando («sin reclamar»). Esto solo deja de esperar a los
 * muertos, exactamente igual que hace `claim`. Dos puertas al mismo recurso con criterios
 * distintos no protegen: se contradicen.
 *
 * ── PAUSA PROPIA (T-375) ────────────────────────────────────────────────────────────────────
 * `pause` suelta el claim a propósito (nada de leases agonizando) y `claim` no entrega una tarea
 * en espera, también a propósito (T-221). Juntos cerraban la salida: pausas → pusheas → el guard
 * te manda a reclamar → `claim` se niega. El orden natural al terminar es cerrar la tarea y luego
 * pushear, así que el atasco lo pisaba cualquiera. Una tarea que TÚ acabas de pausar no es ajena:
 * `snoozed_by === sid` con una espera activa basta para saber que el trabajo es tuyo.
 *
 * ── CITA ≠ TRABAJO (T-403) ──────────────────────────────────────────────────────────────────
 * Ver `clasificarMenciones` para la regla y la medida. Aquí solo se aplica: un id que el push
 * CITA sin declararlo no bloquea, **ni siquiera si otra sesión lo tiene con el lease vivo** —y
 * esa es la diferencia con la exención de «solo documento la ficha», que sí cede. Escribir la
 * ficha de otro toca su producto de trabajo; nombrarlo en un párrafo no toca nada suyo. Si
 * cediera, no arreglaría ninguno de los dos casos del 31/07, que es justo cuando pasó.
 *
 * ── REVISADA Y SOLO FALTA MERGEAR (T-665) ───────────────────────────────────────────────────
 * Reproducido el 07/08 mergeando T-161 y T-163: `revisado` suelta el claim al escribir el
 * veredicto (igual que `pause`), así que la tarea queda «sin reclamar» — y este guard, que hasta
 * hoy solo conocía `esPausaPropia`/`leaseMuerto`, exigía reclamarla. Pero `claimGate` (T-539)
 * se NIEGA a entregar el claim de una revisada-sin-problemas a propósito: no hay más trabajo que
 * hacer, solo falta que una persona la mergee. Las dos puertas leían el mismo hecho con criterios
 * opuestos y la única salida era `claim --force`, que es forzar un guardarraíl para conseguir
 * justo lo que el sistema quiere que pase — el mismo molde que ya cerró T-375 tres veces.
 *
 * El criterio es el MISMO que usa `claimGate` (`REV.esperaDecision(t) && !REV.devueltaConProblemas(t)`),
 * importado de `revision.cjs` en vez de reimplementado: si algún día cambia qué cuenta como
 * «esperando decisión», las dos puertas cambian a la vez o ninguna. Una `problemas` NO se exime
 * aquí tampoco —sigue siendo trabajo pendiente de verdad, y el push que la retoma sí debe reclamarla—,
 * que es justo lo que la comprobación de `devueltaConProblemas` ya excluye.
 *
 * Y NO se exime si otra sesión la tiene con el LEASE VIVO ahora mismo (p.ej. un `claim --force`
 * para reabrirla): ahí `claimGate` responde «leased», no «awaiting_decision» (la lease-viva-ajena
 * se comprueba ANTES en su cascada), y este guard respeta el mismo orden de prioridad.
 */
function evaluatePush({ referencedIds, tasksById, sid, changedFiles = null, mencionSolo = null, now = new Date() }) {
  const get = (id) => (tasksById && typeof tasksById.get === 'function' ? tasksById.get(id) : tasksById && tasksById[id])
  const violations = []
  const notices = []

  const soloFichas = changedFiles !== null && esSoloFichas(changedFiles)
  const citados = new Set(mencionSolo || [])

  for (const id of referencedIds || []) {
    const t = get(id)
    if (!t) continue                                   // no está en el registro → mención suelta/histórica
    if (!OPEN_STATUSES.includes(t.status)) continue    // cerrada → no requiere lease
    if (t.claimed_by === sid) continue                 // la fila es tuya ahora mismo → OK

    if (citados.has(id)) {
      notices.push({ id, reason: 'citada como contexto (no aparece en el asunto de ningún commit) — no exige claim' })
      continue
    }

    // Revisada sin problemas y sin dueño vivo: `claim` se niega a entregarla a propósito (T-539),
    // así que exigirle un claim aquí es la puerta imposible de T-665. Mismo criterio que esa,
    // no una copia — ver la nota de arriba.
    if (REV.esperaDecision(t) && !REV.devueltaConProblemas(t) && !(t.claimed_by && !leaseMuerto(t, now))) {
      notices.push({ id, reason: 'ya revisada y sin problemas: falta que una persona la mergee, no reclamarla (`claim` se niega a entregarla) — no exige claim' })
      continue
    }

    if (esPausaPropia(t, sid, now)) {
      notices.push({ id, reason: 'la pausaste tú y espera deploy/reloj — no hace falta reclamarla para pushear' })
      continue
    }
    // «Solo documento la ficha» NO se aplica si otra sesión la tiene con el lease VIVO: ahí sí
    // hay alguien trabajándola ahora mismo y su ficha es parte de su trabajo. La exención está
    // pensada para la tarea que nadie ha cogido (el caso T-377), no para pisar a quien la lleva.
    if (soloFichas && !(t.claimed_by && !leaseMuerto(t, now))) {
      notices.push({ id, reason: `el push solo toca ${MD_BACKLOG}: documentar una ficha no es trabajarla` })
      continue
    }
    if (t.claimed_by && leaseMuerto(t, now)) {
      notices.push({
        id,
        reason: `la reclamó ${sidCorto(t.claimed_by)} pero su lease caducó — libre (igual que para \`claim\`)`,
      })
      continue
    }

    const reason = t.claimed_by
      ? `la tiene la sesión ${sidCorto(t.claimed_by)} — coordina o espera a que libere`
      : `sin reclamar — hazlo antes de pushear:  node scripts/backlog.cjs claim ${id}`
    violations.push({ id, reason })
  }
  return { allowed: violations.length === 0, violations, notices }
}

/** El lease existe y ya venció → para `claim` la fila está libre, así que aquí tampoco espera. */
function leaseMuerto(t, now = new Date()) {
  if (!t || !t.lease_until) return false
  return new Date(t.lease_until).getTime() < new Date(now).getTime()
}

/** La pausaste TÚ y sigue esperando (a un deploy o a un reloj): el trabajo es tuyo. */
function esPausaPropia(t, sid, now = new Date()) {
  if (!t || !sid || t.snoozed_by !== sid) return false
  if (t.wake_on_deploy_sha) return true                // espera deploy: no tiene fecha, la despierta el sha
  if (!t.snooze_until) return false
  return new Date(t.snooze_until).getTime() > new Date(now).getTime()
}

module.exports = {
  extractTaskIds, parseGitLog, clasificarMenciones, evaluatePush,
  esSoloFichas, leaseMuerto, esPausaPropia,
  OPEN_STATUSES, MD_BACKLOG, GIT_LOG_FORMAT,
}
