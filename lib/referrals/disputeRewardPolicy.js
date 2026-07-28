// lib/referrals/disputeRewardPolicy.js
//
// QUÉ MOTIVOS DE IMPUGNACIÓN DAN DERECHO AL EURO. Núcleo PURO (sin BD, sin imports) para que lo
// consuman por igual el runtime TypeScript (`lib/referrals/logic.ts`) y las herramientas CLI en
// CommonJS (`scripts/impugnaciones/revisar-impugnacion.cjs`). Una sola lista: la que se paga es
// exactamente la que el dossier me enseña al decidir y la que la página de recompensas promete.
//
// LA REGLA: objetividad, no esfuerzo. Se paga cuando aceptar la impugnación significa que teníamos
// un error DEMOSTRABLE contra la fuente (la ley, el artículo, el temario). No se paga cuando
// aceptarla significa que hemos MEJORADO algo a partir de una opinión: entonces la recompensa no
// premia detectar un fallo, premia opinar — y opinar es gratis, ilimitado y no se puede arbitrar.
//
// POR QUÉ SE INTRODUJO (28/07/2026, decisión Manuel). La recompensa nació pagando por cualquier
// impugnación `resolved` de un premium. Medido sobre 90 días: 322 aceptadas, de las cuales **195
// (61 %) eran de motivo subjetivo** — `otro` 113, `explicacion_confusa` 47, `explicacion_mejorable`
// 35 — y una sola usuaria concentraba 70. Con el agravante de que nuestro propio manual (§7.3)
// manda mejorar toda explicación mejorable: eso convertía `explicacion_confusa` en un camino casi
// garantizado a `resolved`, o sea 10 €/mes por persona (el tope) sin error nuestro alguno.
//
// LO SUBJETIVO NO QUEDA SIN PREMIO: se concede A MANO, igual que `bug` y `ugc`, cuando el caso lo
// merece. Lo que se retira es el automatismo, no el reconocimiento.
//
// Al añadir un tipo de impugnación nuevo hay que clasificarlo aquí. No es opcional: `logic.ts` lo
// asigna a un `Record<DisputeType, boolean>`, así que **si falta una clave el typecheck falla**, y
// `__tests__/referrals/recompensaPorTipoDeImpugnacion.test.ts` lo comprueba también en ejecución.

// Motivo de impugnación → ¿paga 1 € automático al aceptarla?
// SIN anotación `@type {Record<string, boolean>}` A PROPÓSITO: con ella TypeScript vería un índice
// genérico de string y daría por buena cualquier clave, matando justo la comprobación que queremos.
// Sin anotar, TS infiere las claves REALES de este literal y `logic.ts` (que lo asigna a un
// `Record<DisputeType, boolean>`) falla el typecheck si falta alguna.
const DISPUTE_REWARD_BY_TYPE = {
  // ── Verificables contra la fuente: aceptarlas = teníamos un error → pagan ──
  no_literal: true, // el texto no se ajusta al artículo: se compara y se ve
  respuesta_incorrecta: true, // la clave estaba mal
  desacuerdo_correcta: true, // idem, por la vía del desacuerdo razonado
  error_pregunta_respuesta: true, // psicotécnicas: error en el enunciado o en el resultado
  mal_formulada: true, // enunciado ambiguo o roto, comprobable leyéndolo
  pregunta_repetida: true, // duplicado, comprobable en el banco
  tema_incorrecto: true, // el artículo no pertenece al epígrafe de ese tema

  // ── Juicio subjetivo: aceptarlas = hemos mejorado algo → NO pagan solas ──
  explicacion_confusa: false, // "no lo entiendo" no es verificable ni acotable
  explicacion_mejorable: false, // toda explicación es mejorable: pagarlo es pagar por pedir
  otro: false, // cajón de sastre: sin motivo tipificado no hay criterio que aplicar
}

/**
 * ¿Este motivo da derecho al euro automático?
 * Desconocido o vacío → NO. El dinero falla CERRADO: ante un valor fuera del dominio, la duda no
 * se resuelve pagando (y el valor raro se emite como evento para que se vea).
 * @param {string|null|undefined} disputeType
 * @returns {boolean}
 */
function disputeTypeIsRewardable(disputeType) {
  if (!disputeType) return false
  return DISPUTE_REWARD_BY_TYPE[disputeType] === true
}

module.exports = { DISPUTE_REWARD_BY_TYPE, disputeTypeIsRewardable }
