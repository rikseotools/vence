// lib/sessions/reservaPerdida.cjs — enterarse de que te han quitado lo que tenías. PURO. (T-516)
//
// ── EL PROBLEMA, EN PALABRAS DE MANUEL (04/08/2026) ──────────────────────────────────────────
// *«Cuando me voy por la noche a dormir, dos sesiones por la mañana me hablan de lo mismo. Puede
// que una sesión lo tuviera, le caduca, y otra lo coge porque estaba libre; pero la primera no
// sabe que le caducó y sigue hablando de algo que ahora tiene otra.»*
//
// El reparto entre sesiones ya está resuelto: `lib/impugnaciones/reserva.cjs` decide cuándo una
// reserva vuelve al pool (señal de vida, con suelo de 2 h) y lo hace bien. Lo que NO existía es
// el camino de vuelta: **al que pierde la reserva nadie se lo dice**. Sigue con todo el contexto
// en la cabeza, redacta, propone, y a Manuel le llegan dos sesiones contándole el mismo caso.
//
// Y la pérdida no siempre es legítima. Caso real que lo estrena, medido el 04/08: una sesión
// reclamó el feedback `8b788ee0` con la identidad de su worktree (ejecutaba los comandos ahí)
// mientras su latido se registraba desde el checkout principal, con OTRO id. Para el sistema esa
// dueña llevaba diez horas muerta, así que soltó la reserva — y otra sesión la cogió a los pocos
// minutos. La sesión estaba viva y trabajando. Es el mismo fallo que [T-407] cerró por un lado
// (que todos LEAN el id igual) y que seguía abierto por el otro: **nadie comprueba que lates con
// el mismo id con el que reclamas**.
//
// ── POR QUÉ ESTO NO ES UN LOCK MÁS LARGO ────────────────────────────────────────────────────
// Alargar el lease empeora justo el escenario nocturno: te vas a dormir y por la mañana la cola
// está congelada por sesiones que ya no existen. El lease está bien; lo que falta es el AVISO.
// Principio 5 del sistema de sesiones: avisar ≠ bloquear.
//
// Este módulo no habla con la BD ni con el reloj del sistema: recibe la foto anterior y la actual
// y dice qué cambió. Quien consulta es `scripts/sessions/reserva-perdida.cjs`.

/** Cuánto silencio hace falta para dar por muerto un latido. Igual que en reserva.cjs. */
const LATIDO_VIVO_MIN = 30

/**
 * ¿Qué se me ha ido de las manos desde la última vez?
 *
 * @param {string[]} antes   ids que esta sesión tenía reservados en la comprobación anterior
 * @param {Array<{id:string, cola:string, claimedBy:string|null, titulo?:string}>} ahora
 *        estado ACTUAL de esos mismos ids (y de los que tenga ahora), tal cual está en la BD
 * @param {string} sid       quién pregunta
 * @returns {{perdidas: Array<{id,cola,titulo,ahoraDe:string|null}>, mias: string[]}}
 *          `perdidas` en el orden de `antes` (estable, para que el aviso no baile);
 *          `mias` es la foto nueva que hay que guardar.
 */
function diffReservas({ antes = [], ahora = [], sid } = {}) {
  const porId = new Map((ahora || []).filter(Boolean).map((r) => [r.id, r]))
  const mias = (ahora || []).filter((r) => r && r.claimedBy && r.claimedBy === sid).map((r) => r.id)

  const perdidas = []
  for (const id of antes) {
    const fila = porId.get(id)
    // Si el id ya no aparece en la consulta, el caso se CERRÓ (salió de la cola de abiertos).
    // Eso no es perder nada: es que el trabajo terminó. No se avisa.
    if (!fila) continue
    if (fila.claimedBy === sid) continue
    // Solo se avisa cuando lo tiene OTRA sesión. Que la reserva esté LIBRE no distingue entre
    // «me lo quitaron» y «lo solté yo» (`done`, `pause`, `release` liberan el claim a propósito),
    // y avisar de los tres convierte el aviso en ruido: la primera vez que se estrenó, lo primero
    // que dijo fue que había «perdido» la tarea que su propia sesión acababa de cerrar.
    // Además, el daño que persigue esta ficha necesita una SEGUNDA sesión hablando del mismo caso
    // — sin dueño nuevo no hay dos sesiones contándole a Manuel lo mismo.
    if (!fila.claimedBy) continue
    perdidas.push({
      id,
      cola: fila.cola,
      titulo: fila.titulo || null,
      ahoraDe: fila.claimedBy,
    })
  }
  return { perdidas, mias }
}

/**
 * ¿Estoy reclamando con una identidad que NO está dando señales de vida?
 *
 * Es la causa raíz del caso que estrena esta ficha: si el sid con el que reclamas no late, el
 * reparto te dará por muerta y soltará tus reservas aunque estés trabajando. Se detecta con lo
 * que ya hay (`worktree_sessions`), sin campo nuevo.
 *
 * @param {{sid:string, tengoReservas:boolean, ultimoLatido:Date|string|null, ahora?:Date}} p
 * @returns {{riesgo:boolean, motivo:string}}
 */
function identidadSinLatido({ sid, tengoReservas, ultimoLatido, ahora = new Date(),
                              latidoMin = LATIDO_VIVO_MIN } = {}) {
  if (!tengoReservas) return { riesgo: false, motivo: 'no tienes nada reservado' }
  if (!sid) return { riesgo: false, motivo: 'sin sid: no se puede afirmar nada' }
  // Sin fila de latido no se inventa un veredicto (mismo criterio que reserva.cjs): puede ser una
  // sesión legítima que aún no ha latido nunca.
  if (!ultimoLatido) return { riesgo: false, motivo: 'sin fila de latido: no se opina' }

  const mins = (new Date(ahora).getTime() - new Date(ultimoLatido).getTime()) / 60000
  if (mins <= latidoMin) return { riesgo: false, motivo: `late (hace ${Math.round(mins)} min)` }
  return {
    riesgo: true,
    motivo: `tu id \`${sid}\` no da señales desde hace ${Math.round(mins)} min`,
  }
}

/** Nombre legible de cada cola, para que el aviso diga dónde mirar. */
const COLAS = {
  backlog: 'tarea',
  feedback: 'feedback',
  legislative: 'impugnación',
  psychometric: 'impugnación psicotécnica',
}

/**
 * El texto que ve la sesión. Se queda CORTO a propósito: un aviso que ocupa media pantalla se
 * aprende a saltar, y entonces deja de avisar de nada (así murieron tres guardarraíles el 31/07).
 */
function lineasAviso({ perdidas = [], identidad = null } = {}) {
  const lineas = []
  if (perdidas.length) {
    lineas.push('⚠️  YA NO ES TUYO — no sigas trabajándolo ni escribas al usuario:')
    for (const p of perdidas) {
      const quien = p.ahoraDe ? `ahora la lleva ${p.ahoraDe}` : 'ha vuelto a la cola (libre)'
      const que = COLAS[p.cola] || p.cola
      lineas.push(`   · ${que} ${p.id}${p.titulo ? ` — ${p.titulo}` : ''}: ${quien}`)
    }
    lineas.push('   Si aún hay que hacerlo, cede el contexto en vez de rehacerlo (o vuelve a reclamarlo si está libre).')
  }
  if (identidad && identidad.riesgo) {
    lineas.push(`⚠️  RESERVAS EN RIESGO — ${identidad.motivo}.`)
    lineas.push('   Reclamas con un id que no late, así que el reparto te dará por muerta y las soltará.')
    lineas.push('   Suele ser trabajar desde el checkout principal con el .session-id de un worktree (o al revés).')
  }
  return lineas
}

module.exports = { diffReservas, identidadSinLatido, lineasAviso, LATIDO_VIVO_MIN, COLAS }
