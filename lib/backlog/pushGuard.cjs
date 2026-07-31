// lib/backlog/pushGuard.cjs — lógica PURA del guardrail de push del backlog (sin BD, sin git).
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
 *                       snooze_until, wake_on_deploy_sha } (solo los que existan).
 * @param sid            session-id de esta sesión.
 * @param changedFiles   ficheros que toca el push (para el caso «solo documento la ficha»).
 * @returns { allowed, violations: [{ id, reason }], notices: [{ id, reason }] }
 *
 * Regla de bloqueo (una tarea es violación SI y SOLO SI):
 *   · existe en el registro (una mención suelta a un id inexistente NO bloquea), Y
 *   · está VIVA (open/in_progress/blocked — una cerrada done/dropped no pide lease), Y
 *   · NO la tienes tú (`claimed_by !== sid`), Y
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
 */
function evaluatePush({ referencedIds, tasksById, sid, changedFiles = null, now = new Date() }) {
  const get = (id) => (tasksById && typeof tasksById.get === 'function' ? tasksById.get(id) : tasksById && tasksById[id])
  const violations = []
  const notices = []

  const soloFichas = changedFiles !== null && esSoloFichas(changedFiles)

  for (const id of referencedIds || []) {
    const t = get(id)
    if (!t) continue                                   // no está en el registro → mención suelta/histórica
    if (!OPEN_STATUSES.includes(t.status)) continue    // cerrada → no requiere lease
    if (t.claimed_by === sid) continue                 // la fila es tuya ahora mismo → OK

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
        reason: `la reclamó ${String(t.claimed_by).slice(0, 12)} pero su lease caducó — libre (igual que para \`claim\`)`,
      })
      continue
    }

    const reason = t.claimed_by
      ? `la tiene la sesión ${String(t.claimed_by).slice(0, 12)} — coordina o espera a que libere`
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

module.exports = { extractTaskIds, evaluatePush, esSoloFichas, leaseMuerto, esPausaPropia, OPEN_STATUSES, MD_BACKLOG }
