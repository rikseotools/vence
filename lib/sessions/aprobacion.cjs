// lib/sessions/aprobacion.cjs — lo que sale HACIA UNA PERSONA lo aprueba una persona. (T-486)
//
// ── LA REGLA, EN PALABRAS DE MANUEL ─────────────────────────────────────────────────────────
// «No puedo permitir que los trabajadores envíen correos sin mi supervisión. Siempre tengo que
// aprobar lo que se envía, porque ahí se detectan fallos y los usuarios necesitan que haya
// personas detrás, no la IA.»
//
// No es una preferencia de estilo: es la promesa que la plataforma le hace a quien escribe. Un
// opositor que impugna una pregunta está discutiendo con alguien, y la respuesta que recibe tiene
// que haber pasado por ese alguien.
//
// ── DÓNDE VIVE DE VERDAD LA CONTENCIÓN, Y POR QUÉ AUN ASÍ ESTO EXISTE ───────────────────────
// Lo que HOY impide que un trabajador mande un correo es que **no tiene con qué**: sin `.env.local`,
// sin credenciales de AWS (así que no puede sacar `AUTH_SECRET` de SSM), sin clave del proveedor de
// correo, y su rol de lectura ni siquiera puede ver la dirección de nadie. Medido el 05/08 en el
// VPS: cero variables sensibles en el entorno del trabajador.
//
// Eso es una propiedad del permiso, que es la buena. Pero es también **un accidente del
// aprovisionamiento**: el día que un trabajador necesite una credencial para otra cosa, la
// contención desaparece sin que nadie lo decida. Por eso la regla se DECLARA aquí y se hace
// cumplir en el punto de envío — que es donde se puede afirmar, no en el texto del encargo.
//
// Un guardarraíl de TEXTO no es un guardarraíl: el encargo ya dice «esto no es para ti» y un
// encargo se puede ignorar. Esto no.

/** Lo que nunca sale sin que una persona lo haya visto. Cada entrada dice QUÉ se envía y a QUIÉN. */
const ENVIOS_SUPERVISADOS = {
  impugnacion: 'la resolución de una impugnación (va por correo a quien la presentó)',
  feedback: 'la respuesta a un feedback (va por correo a quien lo escribió)',
  newsletter: 'una newsletter (va a la lista de inscritos)',
  aviso: 'un aviso a usuarios',
}

/**
 * ¿Puede este rol enviar esto por su cuenta?
 *
 * @param rol   'persona' | 'trabajador' (de `lib/sessions/sid.cjs`)
 * @param tipo  una clave de ENVIOS_SUPERVISADOS
 *
 * Solo una persona. **Y «no sé qué rol soy» cuenta como trabajador**: el rol lo declara quien
 * arranca la sesión, así que su ausencia en un contexto automatizado no es una persona delante —
 * es una sesión que nadie declaró. Fail-closed, como todo lo que decide un autónomo.
 */
function puedeEnviar(rol, tipo) {
  if (!ENVIOS_SUPERVISADOS[tipo]) {
    return { ok: false, motivo: `tipo de envío desconocido: "${tipo}" (añádelo a ENVIOS_SUPERVISADOS)` }
  }
  if (rol === 'persona') return { ok: true, motivo: null }
  return {
    ok: false,
    motivo: `${ENVIOS_SUPERVISADOS[tipo]} — esto lo aprueba y lo manda una persona, siempre`,
  }
}

/**
 * Lo que se le imprime a quien se ha parado. Dice por qué Y qué hacer en su lugar, porque un
 * bloqueo sin salida se rodea (la lección de [T-375]).
 */
function mensajeBloqueo(tipo, { comando = null } = {}) {
  return [
    '',
    '⛔ ESTO NO LO ENVÍA UN TRABAJADOR AUTÓNOMO.',
    '',
    `   Ibas a enviar: ${ENVIOS_SUPERVISADOS[tipo] || tipo}`,
    '',
    '   Lo que sale hacia una persona lo aprueba una persona: ahí es donde se detectan los',
    '   fallos, y quien escribe necesita que haya alguien detrás. No es negociable.',
    '',
    '   LO QUE SÍ TIENES QUE HACER — deja el borrador donde Manuel lo vea:',
    '     node scripts/backlog.cjs borrador --para "<a quién>" --texto <fichero.md> [--tarea T-nnn]',
    '',
    '   Sale en «npm run flota» y en «backlog.cjs list» hasta que él lo apruebe. Si se queda',
    '   en tu terminal, no lo lee nadie.',
    comando ? `\n   (si eres una persona y esto te ha parado: te falta VENCE_SESSION_ROLE=persona)` : '',
    '',
  ].filter((l) => l !== '').join('\n')
}

/**
 * La puerta, tal y como la llaman los scripts que envían. **Único sitio que hay que invocar.**
 *
 * Devuelve `true` si puede seguir; si no, imprime el porqué y la salida, y devuelve `false` (el
 * llamador decide el código de salida, para no reventarle el proceso a nadie desde una librería).
 *
 * Es lo único impuro del módulo: lee el rol de la sesión. El juicio vive arriba, en `puedeEnviar`,
 * que es puro y testeable.
 */
function exigirPersona(tipo, { log = console.error } = {}) {
  const { rol } = require('./sid.cjs')
  const v = puedeEnviar(rol(), tipo)
  if (v.ok) return true
  log(mensajeBloqueo(tipo, { comando: true }))
  return false
}

module.exports = { ENVIOS_SUPERVISADOS, puedeEnviar, mensajeBloqueo, exigirPersona }
