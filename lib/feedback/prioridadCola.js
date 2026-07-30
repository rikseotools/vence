/**
 * lib/feedback/prioridadCola.js — NÚCLEO PURO: en qué orden se atiende la cola de feedback.
 *
 * ## El orden, y por qué (fijado por Manuel el 30/07/2026)
 *
 *  1. **BUG** — algo no funciona. Cada minuto es alguien intentándolo otra vez y fallando.
 *  2. **PREVENTA** — una persona FREE preguntando antes de comprar. Va por delante del
 *     resto de premium a propósito: **todavía no se fía, y está midiendo a la vez si el
 *     producto es serio y cuánto tardamos en contestar.** La respuesta ES la prueba. Quien
 *     ya paga tiene margen para esperar unas horas; quien está decidiendo, no: se va a otro
 *     sitio y no vuelve.
 *  3. **PREMIUM** — el resto de quien ya paga: dudas, contenido, sugerencias. Dentro del
 *     grupo, primero lo que huele a dinero (cobro no reconocido, renovación, reembolso).
 *  4. **BAJA** — eliminación de cuenta. Ya decidió irse, no hay retención que salvar y la
 *     eliminación tiene ventana RGPD.
 *
 * Vive aquí y no en el manual porque un orden que solo está escrito en prosa se aplica «casi
 * siempre». `scripts/vigia.cjs` enseña la cola ya ordenada con estas etiquetas.
 */

/** Peso de cada grupo: menor = se atiende antes. */
const PESO = { bug: 1, preventa: 2, premium: 3, baja: 4 }

/**
 * Señales de que alguien está DECIDIENDO si comprar. Deliberadamente sobre el texto y no
 * sobre el `type`: la pre-venta llega casi siempre como `suggestion` u `other`, y quien
 * pregunta «¿tenéis mi oposición?» no marca ninguna casilla que la distinga.
 */
const SENALES_PREVENTA = [
  // «¿tenéis…?» / «¿tienes…?» / «¿hay…?» seguido de lo que vende el producto. Escrito con
  // las formas reales: la primera versión ponía `tengo?[ií]s`, que no casa con «tenéis» —
  // lo cazó el test antes de que el orden de la cola dependiera de ello.
  /\b(ten[ée]is|teneis|tienes|hay|dispon[ée]is)\b.*\b(oposici[óo]n|temario|tests?|preguntas)\b/i,
  /\b(vais a|pens[áa]is|ten[ée]is previsto)\b.*\b(a[ñn]adir|sacar|subir|preparar)\b/i,
  /\btemario\b.*\b(completo|actualizado|entero|al d[íi]a)\b/i,
  /\b(cu[áa]nto (cuesta|vale)|precio|suscripci[óo]n|planes?)\b/i,
  /\b(supuestos?|casos? pr[áa]cticos?)\b/i,
  /\bmerece la pena\b|\bme sirve\b|\bantes de (pagar|suscribirme|comprar)\b/i,
  /\bprueba gratis\b|\bversi[óo]n gratuita\b/i,
]

/**
 * @param {{type?:string, plan?:string, message?:string}} f
 * @returns {'bug'|'preventa'|'premium'|'baja'}
 *
 * Un free que no reporta un fallo ni se da de baja **siempre** es pre-venta, dispare o no
 * una señal explícita: si no paga y está escribiendo, está decidiendo. Las señales no
 * deciden el grupo, solo el orden DENTRO de él (`prioridad`).
 */
function clasificar(f) {
  const type = String(f && f.type || '').toLowerCase()
  const plan = String(f && f.plan || '').toLowerCase()

  if (type === 'account_deletion') return 'baja'
  if (type === 'bug') return 'bug'
  return plan === 'premium' ? 'premium' : 'preventa'
}

/** ¿El texto dice explícitamente que está sopesando comprar? */
function tieneSenalDeCompra(mensaje) {
  return SENALES_PREVENTA.some((re) => re.test(String(mensaje || '')))
}

/**
 * Ordena la cola. Dentro del mismo grupo manda la antigüedad: quien lleva más tiempo
 * esperando, antes.
 *
 * @param {{type?:string, plan?:string, message?:string, created_at?:string|Date}[]} feedbacks
 * @returns {(object & {grupo:string, prioridad:number})[]}
 */
function ordenarCola(feedbacks) {
  return (feedbacks || [])
    .map((f) => {
      const grupo = clasificar(f)
      // Dentro de pre-venta, quien dice abiertamente que está sopesando comprar («¿tenéis
      // mi oposición?», «¿cuánto cuesta?») va antes que una duda suelta. Medio punto, para
      // no alterar el orden entre grupos.
      const matiz = grupo === 'preventa' && !tieneSenalDeCompra(f && f.message) ? 0.5 : 0
      return { ...f, grupo, prioridad: PESO[grupo] + matiz }
    })
    .sort((a, b) => {
      if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad
      return new Date(a.created_at || 0) - new Date(b.created_at || 0)
    })
}

/** Etiqueta corta para pintar en la cola. */
const ETIQUETA = { bug: '🐞 BUG', preventa: '💰 PREVENTA', premium: '⭐ PREMIUM', baja: '👋 BAJA' }

module.exports = { clasificar, ordenarCola, tieneSenalDeCompra, ETIQUETA, PESO, SENALES_PREVENTA }
