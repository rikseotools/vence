// lib/sessions/embudoObsoleto.cjs — ¿esta entrada del embudo pregunta por algo YA DECIDIDO? (T-606)
//
// ── EL PROBLEMA ──────────────────────────────────────────────────────────────────────────────
// El embudo (`session_questions`) es lo único que una persona mira para saber qué decisiones se
// esperan de ella. Cuando una sesión escribe «¿apruebo este borrador?» y OTRA cierra el caso
// —que es el flujo normal y correcto: quien tiene la reserva es quien cierra— la pregunta se
// queda ahí para siempre. Y `retirar` lleva `AND sid = <la tuya>`, así que solo la puede quitar
// la sesión que la escribió… que es un turno de flota de ayer, muerto y sin volver.
//
// Medido el 06/08/2026: de 16 entradas abiertas, **8 preguntaban por impugnaciones ya cerradas y
// respondidas**, todas de 25-30 h. Entre ellas las cuatro del incidente de [T-609] — pedían
// permiso para mandar unos correos que ya se habían mandado. Un embudo con ruido se deja de
// leer, y entonces se pierde la pregunta que sí necesitaba a una persona.
//
// ── POR QUÉ NO BASTA CON `draft_target` ─────────────────────────────────────────────────────
// La ficha original imaginó el barrido sobre `draft_target`. Pero las 8 medidas son
// `kind='pregunta'` con `draft_target IS NULL`: **el id vive dentro de la PROSA** («Borrador
// RECHAZO para 066a3d65 (Manolo…)»). Es exactamente el mismo descubrimiento que obligó a
// `embudoVeto.cjs` a mirar `question`+`context`+`draft_target` de CUALQUIER fila, así que aquí
// se REUTILIZA su `mencionaDispute` en vez de escribir un tercer emparejador de ids — que es
// como nacieron los cinco escritores de `seguimiento_url` ([T-130]).
//
// ── QUÉ CUENTA COMO «YA DECIDIDO» ───────────────────────────────────────────────────────────
// Solo los estados TERMINALES de una impugnación. `pending` y `appealed` siguen vivos: una
// réplica es precisamente cuando más falta hace preguntar.
const { mencionaDispute } = require('../impugnaciones/embudoVeto.cjs')

/** Estados en los que ya no hay nada que aprobar: el caso está cerrado y contestado. */
const ESTADOS_CERRADOS = new Set(['resolved', 'rejected'])

// ── CITAR UN CASO NO ES PREGUNTAR POR ÉL, y es la mitad del criterio ────────────────────────
// La primera versión de esto marcaba «cualquier entrada que mencione un caso cerrado», y el
// dry-run contra el embudo real dio **12 de 16… con 5 falsos positivos**: `#38` («¿investigo la
// fuga de scope?»), `#45` (huecos de permisos), `#55` («¿documento position_type?»), `#73` (la
// medida del propio embudo) y `#74` (`cola.cjs` revienta con user_feedback) citaban una
// impugnación **como ejemplo o como contexto** y son preguntas VIVAS que esperan a una persona.
// Retirarlas habría sido perder exactamente lo que este canal existe para no perder.
//
// La asimetría manda: un falso retiro borra una decisión que alguien espera (irreversible en la
// práctica, porque nadie sabrá que faltaba); un falso mantenimiento solo deja ruido, que se
// barre a la siguiente. Así que se exige la SEGUNDA condición: que la entrada pida aprobar o
// enviar un borrador. Es el mismo aprendizaje que [T-403] («citar una tarea no es trabajarla»).
const PIDE_APROBACION = /\b(apruebo|apruebas|aprobarlo|aprobarla|aprobarlas|aprobación|lo\s+env[íi]o|se\s+env[íi]a|env[íi]o\s+tal\s+cual)\b/i

/**
 * ¿Esta entrada PIDE aprobar/enviar algo, en vez de solo mencionar un caso?
 * Los `kind='borrador'` lo son por construcción: existen para que alguien los apruebe.
 */
function pideAprobacion(fila) {
  if (!fila) return false
  if (fila.kind === 'borrador') return true
  return PIDE_APROBACION.test(String(fila.question || '')) || PIDE_APROBACION.test(String(fila.context || ''))
}

/**
 * ¿Qué caso CERRADO cita esta entrada del embudo? `null` si no cita ninguno (o el que cita
 * sigue vivo), que es el caso normal y el que NO hay que tocar.
 *
 * @param {{question?:string, context?:string, draft_target?:string}} fila
 * @param {Array<{id:string, status:string}>} disputes  impugnaciones a contrastar
 * @returns {{id:string, status:string}|null}
 */
function casoCerradoQueCita(fila, disputes) {
  if (!pideAprobacion(fila)) return null   // citar un caso no es preguntar por él
  for (const d of disputes || []) {
    if (!d || !ESTADOS_CERRADOS.has(d.status)) continue
    if (mencionaDispute(fila, d.id)) return { id: d.id, status: d.status }
  }
  return null
}

/**
 * ¿Se puede retirar esta entrada, aunque no sea mía?
 *
 * El `AND sid` de `retirar` protege de que una sesión borre el trabajo VIVO de otra, y eso está
 * bien. Pero sobre un caso ya cerrado no hay trabajo que proteger: la pregunta ya no puede
 * contestarse, sea de quien sea. Se levanta la condición **solo** en ese supuesto.
 *
 * @param {{esMia:boolean, caso:{id:string,status:string}|null}} ctx
 */
function puedeRetirar({ esMia, caso } = {}) {
  if (esMia) return { permitido: true, motivo: 'es tuya' }
  if (caso) {
    return {
      permitido: true,
      motivo: `el caso ${String(caso.id).slice(0, 8)} ya está ${caso.status}: no queda decisión que tomar`,
    }
  }
  return {
    permitido: false,
    motivo: 'no es tuya y su caso sigue abierto: sería borrar el trabajo vivo de otra sesión',
  }
}

module.exports = { casoCerradoQueCita, puedeRetirar, pideAprobacion, ESTADOS_CERRADOS }
