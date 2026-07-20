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

/** Extrae los ids `T-NNN` únicos de un texto (mensajes de commit + nombre de rama). */
function extractTaskIds(text) {
  const ids = new Set()
  for (const m of String(text || '').matchAll(/\bT-\d{3}\b/g)) ids.add(m[0])
  return [...ids]
}

/**
 * ¿Se permite el push? Lógica pura: decide con los ids referenciados + el estado de esas
 * tareas + la sesión actual. La BD y git los inyecta el bridge (scripts/backlog-push-guard.cjs).
 *
 * @param referencedIds  ids `T-NNN` que aparecen en los commits/rama que se empujan.
 * @param tasksById      Map|objeto id → { status, claimed_by, lease_until } (solo los que existan).
 * @param sid            session-id de esta sesión.
 * @returns { allowed, violations: [{ id, reason }] }
 *
 * Regla de bloqueo (una tarea es violación SI y SOLO SI):
 *   · existe en el registro (una mención suelta a un id inexistente NO bloquea), Y
 *   · está VIVA (open/in_progress/blocked — una cerrada done/dropped no pide lease), Y
 *   · NO la tienes tú (`claimed_by !== sid`).
 * Si la fila es tuya (`claimed_by === sid`) se permite aunque el lease esté caducado: la fila
 * SIGUE siendo tuya (el lease caducado solo importa para que OTRA sesión pueda robarla; si nadie
 * la robó, tu push es legítimo). En cuanto otra sesión la coge, `claimed_by` deja de ser tuyo y
 * vuelve a bloquear.
 */
function evaluatePush({ referencedIds, tasksById, sid, now = new Date() }) {
  const get = (id) => (tasksById && typeof tasksById.get === 'function' ? tasksById.get(id) : tasksById && tasksById[id])
  const violations = []
  for (const id of referencedIds || []) {
    const t = get(id)
    if (!t) continue                                   // no está en el registro → mención suelta/histórica
    if (!OPEN_STATUSES.includes(t.status)) continue    // cerrada → no requiere lease
    if (t.claimed_by === sid) continue                 // la fila es tuya ahora mismo → OK
    const reason = t.claimed_by
      ? `la tiene la sesión ${String(t.claimed_by).slice(0, 12)} — coordina o espera a que libere`
      : `sin reclamar — hazlo antes de pushear:  node scripts/backlog.cjs claim ${id}`
    violations.push({ id, reason })
  }
  return { allowed: violations.length === 0, violations }
}

module.exports = { extractTaskIds, evaluatePush, OPEN_STATUSES }
