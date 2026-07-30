'use strict'
/**
 * plazo.cjs — NÚCLEO PURO: la FECHA LÍMITE de una tarea del backlog.
 *
 * ── QUÉ ES, Y QUÉ NO ────────────────────────────────────────────────────────
 * El backlog ya sabía modelar cuatro esperas (persona, otra tarea, reloj, despliegue) y las
 * cuatro significan lo mismo: **«no la cojas todavía»**. Ninguna decía **«tiene que estar
 * ANTES de»**. Son opuestas, y confundirlas es fácil: el 30/07/2026, buscando dónde anotar un
 * plazo prometido a una usuaria, lo primero que se miró fue `snooze_until`… que la habría
 * BLOQUEADO justo hasta el día en que vencía.
 *
 * Sin sitio donde ponerlo, el plazo acabó en prosa dentro de la ficha. Y una condición escrita
 * en prosa no es una condición: es la misma lección que ya ganó `snooze_until` cuando T-221
 * llevaba «⛔ NO COGER HASTA EL 29/07» en el título.
 *
 * ── EL CASO QUE LO MOTIVA ───────────────────────────────────────────────────
 * T-330: «Newsletter del último día de plazo de Conserjería de la UJA». El plazo cerraba el
 * 31/07 a las 23:59 y la tarea despertaba esa misma mañana: **doce horas de vida**. Pasada esa
 * hora el trabajo no se retrasa, se vuelve DAÑINO (el correo anunciaría un plazo cerrado). Lo
 * único que lo decía era la palabra «hoy» en un título escrito el día anterior — una palabra
 * relativa en un título envejece sola y acaba mintiendo.
 *
 * ── LA REGLA QUE SOSTIENE EL CAMPO ──────────────────────────────────────────
 * **Un plazo exige un motivo EXTERNO**: una persona a la que se lo dijimos, o una fecha que
 * fija un tercero (un boletín, un plazo administrativo, un examen). NUNCA «me gustaría tenerlo
 * el viernes». Con 127 tareas abiertas y tres o cuatro plazos de verdad, permitir inventarlos
 * convierte el campo en ruido: en un mes todo es urgente y nada lo es. Por eso `due_reason` es
 * obligatorio y por eso esto NO toca `priority`: urgencia e importancia son cosas distintas y
 * mezclarlas es como estos sistemas acaban con todo en rojo.
 */

/** Bandas de cercanía. El orden es el de urgencia: menor `peso` = antes en la lista. */
const BANDAS = {
  vencida: { peso: 0, icono: '🔥', etiqueta: 'VENCIDA' },
  hoy: { peso: 1, icono: '⏳', etiqueta: 'VENCE HOY' },
  manana: { peso: 2, icono: '⏳', etiqueta: 'vence mañana' },
  semana: { peso: 3, icono: '📅', etiqueta: 'esta semana' },
  lejos: { peso: 4, icono: '📅', etiqueta: 'más adelante' },
}

const DIA_MS = 24 * 60 * 60 * 1000

/** Medianoche local del día de `d`, para comparar por DÍAS y no por horas. */
function diaDe(d) {
  const x = new Date(d)
  return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
}

/**
 * Clasifica un plazo respecto a un instante dado.
 *
 * Compara por DÍAS naturales a propósito: «vence hoy» tiene que seguir diciendo «vence hoy» a
 * las 9:00 y a las 22:00. Si se comparasen horas, una tarea que vence hoy a las 23:59 saldría
 * como «faltan 14 horas» a media mañana y como «vencida» un minuto después, sin banda propia.
 *
 * @param {string|Date|null} dueAt  fecha límite (null = la tarea no tiene plazo)
 * @param {string|Date} ahora       instante de referencia (se INYECTA: sin relojes ocultos)
 * @returns {{banda:string, peso:number, icono:string, etiqueta:string, dias:number}|null}
 *          `null` si no hay plazo. `dias` es la diferencia en días naturales (negativo = pasado).
 */
function clasificarPlazo(dueAt, ahora) {
  if (!dueAt) return null
  const t = new Date(dueAt)
  if (Number.isNaN(t.getTime())) return null
  const dias = Math.round((diaDe(t) - diaDe(ahora)) / DIA_MS)
  let banda
  if (dias < 0) banda = 'vencida'
  else if (dias === 0) banda = 'hoy'
  else if (dias === 1) banda = 'manana'
  else if (dias <= 7) banda = 'semana'
  else banda = 'lejos'
  return { banda, dias, ...BANDAS[banda] }
}

/**
 * ¿Se puede escribir este plazo? Un plazo sin motivo externo es una preferencia disfrazada.
 *
 * @returns {{ok:true}|{ok:false, error:string}}
 */
function validarPlazo(dueAt, motivo) {
  if (!dueAt) return { ok: false, error: 'falta la fecha límite' }
  const t = new Date(dueAt)
  if (Number.isNaN(t.getTime())) return { ok: false, error: `fecha ilegible: "${dueAt}"` }
  const m = String(motivo || '').trim()
  if (!m) {
    return { ok: false, error: 'un plazo SIN MOTIVO es una preferencia, no una fecha límite. Di quién lo espera o qué fecha externa lo fija (--motivo)' }
  }
  if (m.length < 15) {
    return { ok: false, error: `el motivo "${m}" no dice quién lo espera ni qué lo fija; escríbelo entero` }
  }
  return { ok: true }
}

/**
 * Las tareas con plazo que hay que enseñar arriba, ordenadas por urgencia.
 * Solo VIVAS: una tarea cerrada con el plazo pasado no es un incendio, es historia.
 */
function tareasConPlazo(tareas, ahora) {
  return (tareas || [])
    .filter((t) => t && t.due_at && !['done', 'closed', 'rejected'].includes(String(t.status || '')))
    .map((t) => ({ ...t, plazo: clasificarPlazo(t.due_at, ahora) }))
    .filter((t) => t.plazo)
    .sort((a, b) => a.plazo.peso - b.plazo.peso || new Date(a.due_at) - new Date(b.due_at))
}

/**
 * ¿El TÍTULO se apoya en una fecha o en una palabra relativa que envejecerá sola?
 *
 * Complemento del guardarraíl que ya prohíbe candados de fecha en el título: aquel caza
 * «NO COGER HASTA EL 29/07», este caza «hoy es el último día», que es peor porque no parece
 * una fecha y sin embargo caduca en 24 horas. Si el título lo dice, el plazo va en `due_at`.
 */
/**
 * OJO con «hoy»: en castellano vale para dos cosas y solo una es un plazo.
 *   · plazo      → «HOY es el último día», «hay que mandarlo HOY»   → el título caduca
 *   · descriptivo → «(HOY sirven CERO)», «ni puede, HOY»            → significa «actualmente»
 * La primera versión de esto marcaba las dos y sacó dos falsos positivos reales (T-331 y
 * T-228). Por eso «hoy» a secas NO cuenta: tiene que ir pegado a una construcción de plazo.
 * Igual con «mañana», que además es un sustantivo («la mañana del 31»).
 */
const RELATIVAS = [
  /\bhoy (es|vence|acaba|termina|cierra|toca|mismo)\b/i,
  /\bpara hoy\b/i,
  /(?<!la |esta |una |de la |por la )\bma[ñn]ana\b(?! del?\b)/i,
  /\besta (semana|tarde|noche)\b/i,
  // «último día» solo cuando AFIRMA (encabeza el título), no cuando describe: «Newsletter DEL
  // último día de plazo» dice qué campaña es y no envejece; «Último día para enviarla» sí.
  /^[¡«"']?\s*[úu]ltimo d[íi]a\b/i,
  /\bqueda[nr]? \d+ d[íi]as?\b/i,
  /\bantes del? \d/i,
]

function tituloDependeDeFecha(titulo) {
  const t = String(titulo || '')
  return RELATIVAS.some((re) => re.test(t))
}

module.exports = { clasificarPlazo, validarPlazo, tareasConPlazo, tituloDependeDeFecha, BANDAS }
