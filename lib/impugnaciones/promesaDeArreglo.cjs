// Núcleo PURO de la puerta «no digas que está arreglado si no está VIVO» (T-678).
//
// POR QUÉ EXISTE (07/08/2026, caso Esther, feedback `e523eabc`): se le envió *«Las dos venían del
// mismo fallo y ya está corregido. Actualiza la página y vuelve a probar, que no debería volver a
// pasarte»* con el arreglo en `main` y **NO desplegado** — `/api/health` servía `76404f1d` y el
// commit del arreglo no era ancestro suyo. Si entraba, le seguía fallando, y con un correo nuestro
// diciendo lo contrario. Manuel: *«no vuelvas a decir que está arreglado sin estar en producción y
// probado y simulado»*.
//
// LA REGLA YA EXISTÍA A MEDIAS, Y ESE ES EL PUNTO: [T-392] impide **cerrar una tarea** cuyos
// commits tocan superficie servida y no están vivos, usando `lib/deploy/shaVivo.cjs`. Lo que no
// tenía puerta era el sitio por donde sale un **mensaje a una persona** (`cerrar.ts`,
// `cerrar-feedback.ts`). Esto no inventa un criterio nuevo: lleva el mismo criterio al punto de
// escritura que le faltaba — que es donde hace falta, porque el correo no se puede deshacer.
//
// PURO a propósito: ni red ni git. Quien llama trae el sha vivo y la lista de commits pendientes;
// aquí solo se decide. Así se puede calibrar contra los mensajes REALES ya enviados sin tocar nada.

/**
 * Frases que PROMETEN al usuario que el problema ya no existe, en presente.
 *
 * Deliberadamente **cortas y en presente**: lo que hace daño es afirmar que YA está, no describir
 * lo que se hará. «Lo estamos corrigiendo» o «estará disponible en las próximas horas» son honestas
 * aunque no esté desplegado, y no se marcan.
 */
const PROMESAS = [
  /ya (?:está|esta) (?:corregid|arreglad|resuelt|solucionad|disponible)/i,
  /ya (?:funciona|deberías? poder|puedes)/i,
  /(?:hemos|ya hemos) (?:corregido|arreglado|resuelto|solucionado)/i,
  /(?:queda|ha quedado) (?:corregid|arreglad|resuelt|solucionad)/i,
  /no debería volver a (?:pasarte|salirte|ocurrirte)/i,
  /(?:está|esta) (?:ya )?(?:corregida|arreglada|resuelta|solucionada)\b/i,
]

/**
 * ¿El texto AFIRMA que el problema ya no existe?
 * @returns {{afirma: boolean, frase: string|null}}
 */
function afirmaArreglo(texto) {
  const t = String(texto || '')
  for (const re of PROMESAS) {
    const m = t.match(re)
    if (m) return { afirma: true, frase: m[0] }
  }
  return { afirma: false, frase: null }
}

/**
 * El veredicto.
 *
 * @param {object} p
 * @param {string} p.texto              el mensaje que se va a enviar
 * @param {string|null} p.shaVivo       sha corto desplegado, o `null` si no se pudo saber
 * @param {string[]} p.commitsPendientes commits en `main` que tocan superficie servida y NO están vivos
 * @returns {{bloquea: boolean, motivo: string|null, frase: string|null}}
 */
function puedeAfirmarse({ texto, shaVivo, commitsPendientes }) {
  const { afirma, frase } = afirmaArreglo(texto)
  if (!afirma) return { bloquea: false, motivo: null, frase: null }

  // FAIL-OPEN cuando no se sabe qué hay vivo. Es una persona esperando respuesta: una red caída no
  // puede impedir contestarle, y «no lo sé» no es «no está desplegado» (mismo criterio que
  // `shaVivo`, que devuelve null a propósito). Se avisa, no se bloquea.
  if (!shaVivo) {
    return { bloquea: false, motivo: 'no se pudo leer el sha vivo: se avisa pero no se bloquea', frase }
  }

  const pendientes = (commitsPendientes || []).filter(Boolean)
  if (!pendientes.length) return { bloquea: false, motivo: null, frase }

  return {
    bloquea: true,
    frase,
    motivo:
      `el mensaje afirma «${frase}» pero hay ${pendientes.length} commit(s) de superficie servida ` +
      `SIN desplegar (vivo: ${shaVivo}). Mergeado a main no es arreglado: si la persona entra, le ` +
      `sigue fallando y encima con un correo nuestro diciendo que ya no.`,
  }
}

module.exports = { afirmaArreglo, puedeAfirmarse, PROMESAS }
