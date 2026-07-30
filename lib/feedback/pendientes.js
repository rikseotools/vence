/**
 * lib/feedback/pendientes.js — NÚCLEO PURO: ¿este feedback sigue esperando respuesta?
 *
 * ## Por qué existe (30/07/2026)
 *
 * El vigía marcaba «te han contestado» comparando solo los mensajes: si el último era del
 * usuario y había alguno nuestro antes, era una réplica pendiente. Funciona… hasta que la
 * réplica se atiende **sin escribir**.
 *
 * Y eso pasa a diario: cuando alguien contesta «genial, muchas gracias» se cierra el hilo en
 * SILENCIO (sin mensaje, para no mandarle un aviso vacío). Como no se inserta nada nuestro,
 * la comparación de mensajes sigue diciendo «el último es del usuario» y el aviso reaparece
 * en cada pasada durante 24 horas. Tres agradecimientos ya cerrados seguían saliendo hoy.
 *
 * Un vigía que repite lo ya hecho se vuelve ruido, y un ruido con el que se convive acaba
 * tapando el aviso de verdad. Por eso ahora también cuenta `resolved_at`: **cerrar es
 * atender, aunque no se escriba**.
 */

/** Ventanas de la cola (ms). Un feedback más viejo deja de ser «novedad». */
const VENTANA_NUEVO_MS = 6 * 60 * 60 * 1000;
const VENTANA_REPLICA_MS = 24 * 60 * 60 * 1000;

const CERRADOS = new Set(['resolved', 'closed', 'dismissed']);
const ms = (t) => (t ? new Date(t).getTime() : null);

/**
 * @param {{status?:string, created_at?:any, ult_user?:any, ult_admin?:any, resolved_at?:any}} f
 * @param {number} [ahora]
 * @returns {{pendiente:boolean, clase:'NUEVO'|'REPLICA'|null, motivo:string}}
 */
function clasificarPendiente(f, ahora = Date.now()) {
  const status = String((f && f.status) || '').toLowerCase();
  const creado = ms(f && f.created_at);
  const ultUser = ms(f && f.ult_user);
  const ultAdmin = ms(f && f.ult_admin);
  const resuelto = ms(f && f.resolved_at);

  // NUEVO: nadie le ha contestado todavía y el hilo sigue abierto.
  if (ultAdmin === null) {
    if (CERRADOS.has(status)) return { pendiente: false, motivo: 'cerrado_sin_responder', clase: null };
    if (creado !== null && ahora - creado > VENTANA_NUEVO_MS) {
      return { pendiente: false, motivo: 'fuera_de_ventana', clase: null };
    }
    return { pendiente: true, clase: 'NUEVO', motivo: 'sin_responder' };
  }

  // RÉPLICA: nos ha vuelto a escribir después de nuestra última respuesta.
  if (ultUser === null || ultUser <= ultAdmin) {
    return { pendiente: false, motivo: 'sin_replica', clase: null };
  }
  if (ahora - ultUser > VENTANA_REPLICA_MS) {
    return { pendiente: false, motivo: 'replica_antigua', clase: null };
  }
  // ⚠️ La clave: cerrar TAMBIÉN es atender. Si el hilo se resolvió DESPUÉS de esa réplica
  // (típico: «genial, gracias» → cierre en silencio), ya está hecho y no debe reaparecer.
  // Sin esto, el aviso se repetía en cada pasada durante 24 h.
  if (resuelto !== null && resuelto >= ultUser) {
    return { pendiente: false, motivo: 'atendida_con_cierre_silencioso', clase: null };
  }
  return { pendiente: true, clase: 'REPLICA', motivo: 'replica_sin_atender' };
}

/** Deja solo lo que sigue esperando, con su clase ya puesta. */
function filtrarPendientes(filas, ahora = Date.now()) {
  return (filas || [])
    .map((f) => ({ f, d: clasificarPendiente(f, ahora) }))
    .filter(({ d }) => d.pendiente)
    .map(({ f, d }) => ({ ...f, clase: d.clase }));
}

module.exports = { clasificarPendiente, filtrarPendientes, VENTANA_NUEVO_MS, VENTANA_REPLICA_MS, CERRADOS };
