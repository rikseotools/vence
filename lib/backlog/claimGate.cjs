'use strict'
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
      reason: `la tiene ${String(task.claimed_by).slice(0, 12)} (lease vivo, ${mins} min)`,
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

module.exports = { claimGate, isChronicSnooze, deployWakeReady }
