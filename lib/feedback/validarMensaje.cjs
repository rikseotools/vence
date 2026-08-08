// lib/feedback/validarMensaje.cjs
//
// Lo que NO se le dice a un usuario. Fuente única, hecha cumplir en el punto de escritura.
//
// ── POR QUÉ ES CÓDIGO Y NO UNA LÍNEA EN UN MANUAL ───────────────────────────────────────────
// Estas reglas estaban escritas y aun así se incumplen: el 07/08/2026, en un mismo borrador, se
// coló la mención al apartado de recompensas (prohibida desde el 24/07) y un «tienes razón» que
// Manuel acababa de retirar. Un manual de 2.000 líneas no se relee entero antes de cada mensaje;
// una comprobación sí corre siempre.
//
// El criterio vive AQUÍ y lo consumen los que envían. Añadir una regla nueva = una entrada.

/**
 * Cada regla dice QUÉ no se puede escribir y POR QUÉ, con la alternativa.
 * `patron` casa sobre el texto en minúsculas y sin tildes (se normaliza antes).
 */
const PROHIBIDO = [
  {
    id: 'recompensa_mencionada',
    patron: /\b(recompensa|recompensas|vale regalo|tarjeta regalo|gift ?card|saldo acumulado|apartado de recompensas|programa de recompensas)\b/,
    porque: 'La recompensa NUNCA se menciona en el mensaje (Manuel, 24/07/2026): queda cutre y el badge 🎁 parpadeante ya se la comunica. Se crea en silencio y el texto va solo del asunto.',
    enVezDe: 'No escribas nada de la recompensa. Si procede, créala y el usuario la verá.',
  },
  {
    id: 'tienes_razon',
    patron: /\b(tienes|teneis|tenias|llevas) razon\b/,
    porque: 'No se le concede la razón (Manuel, 07/08/2026). Es un escalón más que no proclamar la culpa: se cuenta QUÉ le pasaba a ELLA y qué cambia, sin veredicto sobre quién acertaba.',
    enVezDe: 'Describe el hecho: «las estadísticas no te aparecían, y ya debería estar resuelto».',
  },
  {
    id: 'culpa_proclamada',
    patron: /\b(el fallo (era|fue) nuestro|es culpa nuestra|ha sido culpa nuestra|error nuestro|fallo nuestro|no (era|fue) cosa tuya|no (es|era) culpa tuya)\b/,
    porque: 'No se proclama la culpa (Manuel, 07/08/2026): no aporta nada a quien escribe y solo nos pinta de incompetentes.',
    enVezDe: 'Cuenta qué le pasaba y qué cambia para ella, sin adjudicar responsabilidad.',
  },
  {
    id: 'disculpa_por_la_espera',
    patron: /\b(gracias por (tu |la )?paciencia|sentimos (el|las) (ir y venir|molestias)|perdona (la|las) (espera|molestias)|disculpa (la|las) (espera|molestias))\b/,
    porque: 'Prohibido desde el 30/07/2026: disculparse delante de quien decide si pagarnos nos hace parecer débiles y subraya lo que salió mal.',
    enVezDe: '«Muchas gracias.» y punto.',
  },
  {
    id: 'afirmar_el_arreglo',
    patron: /\b(ya (esta|queda) (arreglado|solucionado|corregido|resuelto)|lo hemos arreglado ya)\b/,
    porque: 'No se afirma el arreglo con rotundidad (30/07/2026): puede tener la página cacheada u otro dispositivo, y que le vuelva a fallar cuesta más que el condicional.',
    enVezDe: '«ya debería estar resuelto» + «si puedes, prueba ahora».',
  },
  {
    id: 'dice_que_es_ia',
    patron: /\b(inteligencia artificial|generad[oa] por ia|lo hace una ia|automaticamente por ia)\b/,
    porque: 'Nunca se dice que el contenido lo hace una IA: los usuarios necesitan saber que hay personas detrás.',
    enVezDe: 'Omítelo.',
  },
]

/** Quita tildes y baja a minúsculas, para que «razón» y «razon» casen igual. */
function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * @returns {{ok:boolean, incumple:Array<{id,porque,enVezDe,fragmento}>}}
 */
function validarMensajeAUsuario(texto) {
  const t = normalizar(texto)
  const incumple = []
  for (const regla of PROHIBIDO) {
    const m = regla.patron.exec(t)
    if (m) incumple.push({ id: regla.id, porque: regla.porque, enVezDe: regla.enVezDe, fragmento: m[0] })
  }
  return { ok: incumple.length === 0, incumple }
}

/** Texto listo para imprimir en un CLI que va a enviar. */
function explicar(incumple) {
  return incumple
    .map((i) => `  ❌ «${i.fragmento}» → ${i.porque}\n     En vez de eso: ${i.enVezDe}`)
    .join('\n')
}

module.exports = { validarMensajeAUsuario, explicar, PROHIBIDO }
