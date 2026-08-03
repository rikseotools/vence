// lib/backlog/orden.cjs — qué tarea toca ahora. PURO. (T-498, 03/08/2026)
//
// ── POR QUÉ ESTÁ AQUÍ Y NO EN EL CLI ─────────────────────────────────────────────────────────
// Este criterio lo usan ahora DOS sitios: `next` (cuando alguien pregunta qué hacer) y la
// sugerencia que imprime `done` al cerrar (cuando el contexto está más cargado y a punto de
// tirarse). Escribirlo dos veces es exactamente cómo nacieron los cinco escritores de
// `seguimiento_url` de [T-130]: dos copias del mismo juicio que empiezan iguales y acaban
// contestando cosas distintas a la misma pregunta.
//
// ── EL ORDEN, Y POR QUÉ ES ESE ──────────────────────────────────────────────────────────────
//   1. **prioridad** — lo que hace daño en vivo primero;
//   2. a igualdad, **lo más CORTO** ([T-414]), porque cierra fichas y libera el reparto;
//   3. y lo **no declarado va al final** de su prioridad, nunca al principio: no se puede afirmar
//      que algo sea rápido si nadie lo ha mirado.
//
// Lo que NO entra, y cada exclusión viene de un fallo pagado:
//   · lo **aparcado** (`prioridad ninguna`): no está en el reparto, se coge a propósito;
//   · lo que **espera** (reloj, deploy, decisión): hoy no hay nada que hacer con ello ([T-221]);
//   · lo **bloqueado** por otra tarea nuestra que sigue abierta;
//   · lo que tiene **dueño vivo**: el lease de otra sesión no se pisa.

const RANGO = { critica: 0, alta: 1, media: 2, baja: 3, ninguna: 9 }

/**
 * Las tareas que se pueden coger AHORA, ya ordenadas.
 *
 * @param rows        filas de `backlog_tasks` abiertas/en curso/bloqueadas
 * @param sid         mi sesión (mi propia tarea sí se puede sugerir: la tengo yo)
 * @param enEspera    predicado inyectado: ¿está esperando a un reloj/deploy? Se INYECTA porque ese
 *                    criterio ya vive en `claimGate.cjs` y no puede tener aquí una segunda versión.
 * @param pesoEsfuerzo predicado inyectado por el mismo motivo (vive en `esfuerzo.cjs`).
 * @param excluir     ids que no se sugieren (p. ej. la que se acaba de cerrar).
 */
function candidatas(rows, { sid = null, enEspera = () => false, pesoEsfuerzo = () => 0, excluir = [], ahora = new Date() } = {}) {
  const abiertas = new Set((rows || []).map((r) => r && r.id))
  const fuera = new Set(excluir)
  return (rows || [])
    .filter((r) => r && r.id && !fuera.has(r.id))
    .filter((r) => !r.claimed_by || r.claimed_by === sid || (r.lease_until && new Date(r.lease_until) < new Date(ahora)))
    .filter((r) => r.priority !== 'ninguna')
    .filter((r) => !enEspera(r))
    .filter((r) => !(r.blocked_by || []).some((d) => abiertas.has(d)))
    .sort((a, b) =>
      (RANGO[a.priority] ?? 9) - (RANGO[b.priority] ?? 9) ||
      pesoEsfuerzo(a.effort) - pesoEsfuerzo(b.effort) ||
      String(a.id).localeCompare(String(b.id)))
}

module.exports = { candidatas, RANGO }
