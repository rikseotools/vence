// lib/auth/rebotePersistente.cjs
//
// «Cree que está dentro, y no lo está» — separar al usuario ROTO del que solo caducó. [T-434]
//
// ## El problema que resuelve
//
// Un cliente que ha perdido la sesión rebota: `/api/auth/token` le contesta 401 y con él
// rebota todo lo que va detrás (`/api/profile`, las estadísticas, el checkout). Ese 401 está
// silenciado A PROPÓSITO en `withErrorLogging` (`expectedStatuses: [401]`), y con razón: un
// navegador deslogueado hace polling y generaría ~340.000 eventos al día de puro ruido.
//
// Pero ese silencio mete en el mismo saco dos cosas que no se parecen en nada:
//
//   1. **Caducó la sesión.** Le pasa a todo el mundo. El cliente lo detecta, le manda a
//      entrar otra vez, y se acabó. Es ruido y debe seguir callado.
//   2. **El cliente CREE que sigue dentro.** Manda identidad, navega, responde preguntas —
//      y no se le guarda nada, ni puede pagar. Medido el 01/08/2026: personas así **desde el
//      19 de julio**, con todos sus eventos en 401 desde el primero. Hoy son invisibles.
//
// ## Por qué la señal es la PERSISTENCIA y no el volumen
//
// La tentación es contar rebotes. No sirve: al medirlo (01/08) los que rebotaban en un solo
// día acumulaban 1-4 peticiones, exactamente igual que una caducidad normal. Lo que separa
// los dos grupos no es cuánto rebotan sino **cuántos días distintos siguen rebotando**: quien
// caducó deja de aparecer en cuanto vuelve a entrar; el roto sigue ahí mañana, y pasado.
//
// ## El corte, calibrado sobre datos reales (01/08/2026, ventana de 14 días)
//
//   483 usuarios rebotaron con identidad. De ellos:
//     · 391 (81%) en UN SOLO día  → caducidad normal. Se descartan.
//     ·  46        en dos días    → zona gris, no se reporta como roto.
//     ·  46        en 3+ días     → ROTOS. El peor lleva 315 h (13 días) rebotando.
//
// Se cuentan **usuarios**, no eventos, por el mismo motivo que el resto de este canario: uno
// solo navegando mucho taparía si el grupo crece o se vacía.

/** Días distintos con rebote a partir de los cuales se considera roto, no caducado. */
const MIN_DIAS_PERSISTENTE = 3

/**
 * Reparte los rebotes entre los que son un usuario ROTO y los que son una caducidad normal.
 *
 * @param {Array<{userId:string, dias:number, eventos:number, primero?:*, ultimo?:*}>} filas
 * @param {{minDias?:number}} [opts]
 */
function clasificarRebotes(filas, opts = {}) {
  const minDias = Number.isFinite(opts.minDias) ? opts.minDias : MIN_DIAS_PERSISTENTE
  const limpias = (Array.isArray(filas) ? filas : []).filter(
    (f) => f && typeof f.userId === 'string' && f.userId,
  )

  const dias = (f) => (Number.isFinite(Number(f.dias)) ? Number(f.dias) : 0)

  const persistentes = limpias
    .filter((f) => dias(f) >= minDias)
    // Primero el que lleva más días roto: es el que más tiempo lleva sin que se le guarde nada.
    .sort((a, b) => dias(b) - dias(a) || Number(b.eventos || 0) - Number(a.eventos || 0))
  const transitorios = limpias.filter((f) => dias(f) < minDias)

  return {
    persistentes,
    transitorios,
    resumen: {
      rotos: persistentes.length,
      caducados: transitorios.length,
      total: limpias.length,
      minDias,
    },
  }
}

/**
 * La banda del canario para esta medida.
 *
 * `error` en cuanto hay UNO: no es una métrica de higiene que se tolere en cierto número. Cada
 * unidad es una persona usando la aplicación a la que no se le está guardando nada, y llevan
 * días así. No hay un número «aceptable» de eso.
 */
function bandaRebotes(resumen) {
  const rotos = Number(resumen?.rotos || 0)
  if (rotos === 0) return { banda: 'ok', codigo: 0 }
  return { banda: 'error', codigo: 1 }
}

module.exports = { clasificarRebotes, bandaRebotes, MIN_DIAS_PERSISTENTE }
