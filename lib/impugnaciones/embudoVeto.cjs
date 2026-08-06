// lib/impugnaciones/embudoVeto.cjs — «Manuel ya dijo que NO, y el cierre no lo mira». (T-609)
//
// ── EL HUECO QUE CIERRA ──────────────────────────────────────────────────────────────────────
// 06/08/2026: un trabajador dejó cuatro preguntas en el embudo con el borrador de rechazo para
// las cuatro impugnaciones de Manolo (arts. 108/110/112/114 CE). A las 06:16 Manuel respondió
// «NO ENVIAR TAL CUAL» a las cuatro — el texto se quedó en `session_questions.answer`. A las
// 06:24-06:26, OTRA sesión cerró tres de ellas con `--igualmente` y mandó el texto vetado.
// El veredicto llevaba 8 minutos en la BD; nadie lo miró.
//
// La ficha original imaginaba el hueco como «faltan `kind='borrador'` con `draft_target` sin
// mirar». MEDIDO contra la fila real (06/08, `session_questions` id 34-37): eran `kind='pregunta'`,
// con `draft_target IS NULL` — el id de la impugnación vivía dentro de la PROSA de `question`
// («Borrador RECHAZO para 066a3d65 (Manolo, Dip. Córdoba, art.108 CE) — ¿lo apruebo…?»). Un
// detector que solo mirara `kind='borrador'` + `draft_target` no habría visto NADA de este
// incidente. Por eso este módulo busca en `question` + `context` + `draft_target` de CUALQUIER
// fila, no solo las de `kind='borrador'`.
//
// ── POR QUÉ NO SE INTENTA RECONOCER LA APROBACIÓN, SOLO EL VETO ──────────────────────────────
// Clasificar «¿esto es un SÍ?» es frágil en las dos direcciones, y aquí las dos direcciones NO
// pesan igual: un falso "SÍ" deja salir un correo vetado (el daño real, irreversible); un falso
// "NO" solo obliga a un `--igualmente` de más (molesto, pero se resuelve leyendo). Por eso la
// regla es asimétrica a propósito: se busca un marcador EXPLÍCITO de veto («no enviar…», «no se
// manda…», «vetado»), calcado del texto real de Manuel. Si NO aparece ninguno, se deja pasar —
// intentar además reconocer un «sí» habría bloqueado sistemáticamente notas de cierre normales
// como «Resuelta y enviada. Verificado contra fuente oficial.», que son la mayoría de las
// respuestas `answered` de este embudo y no tienen nada que ver con un veto.

/** Escapa lo que vaya a ir dentro de una expresión regular. */
function escapar(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * ¿Esta respuesta es un veto explícito al envío? Calcado del texto real que causó el incidente
 * («NO ENVIAR TAL CUAL. Causa raiz encontrada…») y ampliado a las formas equivalentes más
 * directas. Deliberadamente ESTRECHO (ver cabecera): más vale un veto real sin reconocer —
 * `SOSPECHO` que estas formas no cubren todo, ver el `falta` de la ficha — que un clasificador
 * de "aprobación" que se equivoque al alza.
 */
const PATRONES_VETO = [
  /\bno\s+enviar(?:lo|la|los|las)?\b/i, // «no enviar», «no enviarlo», «no enviar tal cual»
  /\bno\s+mandar(?:lo|la|los|las)?\b/i,
  /\bno\s+se\s+(env[ií]a|manda|env[ií]e|mande)\b/i, // «no se envía», «no se manda»
  /\b(vetad[oa]|veto)\b/i,
  /\b(parar|detener|frenar)\s+(el\s+)?env[ií]o\b/i,
]

function esVeto(texto) {
  const t = String(texto || '')
  if (!t.trim()) return false
  return PATRONES_VETO.some((re) => re.test(t))
}

/**
 * ¿El texto de esta fila (question + context + draft_target) menciona este dispute id? Mismo
 * criterio de frontera que `borradorAbierto.cjs` (uuid entero o prefijo de 8, sin casar dentro de
 * otro hash) — a propósito el MISMO, para no divergir en qué cuenta como «mencionar un id».
 */
function mencionaDispute(fila, disputeId) {
  const idCorto = String(disputeId || '').slice(0, 8)
  const buscables = [...new Set([disputeId, idCorto].filter((x) => x && String(x).length >= 8))]
  if (!buscables.length) return false
  const re = new RegExp(`(?<![0-9a-zA-Z-])(${buscables.map(escapar).join('|')})(?![0-9a-zA-Z-])`, 'i')
  const texto = [fila.question, fila.context, fila.draft_target].filter(Boolean).join('\n')
  return re.test(texto)
}

/**
 * De una lista de filas de `session_questions` (cualquier `kind`, ya con `answered_at`
 * poblado), las que mencionan este dispute id Y cuya respuesta es un VETO explícito.
 *
 * @param {Array<{id, kind, sid, question, context, draft_target, answer, answered_at}>} filas
 * @param {string} disputeId  uuid completo de la impugnación
 * @returns {Array} las filas vetadas, más recientes primero
 */
function respuestasQueVetan(filas, disputeId) {
  return (filas || [])
    .filter((f) => f && f.answered_at && mencionaDispute(f, disputeId) && esVeto(f.answer))
    .sort((a, b) => new Date(b.answered_at).getTime() - new Date(a.answered_at).getTime())
}

module.exports = { esVeto, mencionaDispute, respuestasQueVetan, PATRONES_VETO }
