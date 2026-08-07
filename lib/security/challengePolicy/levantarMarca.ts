// lib/security/challengePolicy/levantarMarca.ts
//
// Levantar una marca de "retar siempre" (`captcha:force:*`). El gesto INVERSO de
// `markForcedChallenge`, y hasta hoy no existía.
//
// ── POR QUÉ HACE FALTA (07/08/2026) ──────────────────────────────────────────────────────────
// La marca la pone `/api/fraud/report` con un TTL de 24 h y **no había forma de quitarla**. Se
// vio el día que el antifraude marcó a nuestro propio canario (T-651): el arreglo impide marcas
// NUEVAS, pero la ya puesta condenaba al canario a 21 horas más en rojo — y un canario clavado
// en rojo deja de ser una señal.
//
// Lo caro no es el canario, que es nuestro: ese mismo día seis usuarias PREMIUM recibieron el
// captcha. Si una está mal marcada, la única respuesta que teníamos era «espera 24 h»: un día
// entero sin poder cargar preguntas con normalidad para alguien que paga.
//
// ── DÓNDE SE EJECUTA, Y POR QUÉ NO ES UN SCRIPT SUELTO ───────────────────────────────────────
// La marca vive en Redis, y en producción eso es ElastiCache **dentro de la VPC**: un script en
// el portátil no la alcanza (mismo motivo por el que la caché se invalida por endpoint y no con
// un INCR local — ver `reference-invalidar-cache-prod-elasticache`). Núcleo aquí, endpoint admin
// que lo ejecuta desde dentro, CLI que solo llama.
//
// ── LO QUE NO HACE ───────────────────────────────────────────────────────────────────────────
// NO absuelve al usuario ni toca su expediente en `fraud_alerts`: retira el reto inmediato y ya.
// Si vuelve a detectarse automatización, se le marca otra vez — como debe ser.

import { invalidate } from '@/lib/cache/redis'
import { claveRetoForzado } from './forceChallenge'
// El criterio (motivo obligatorio, qué sujetos) vive en el núcleo `.cjs` que comparten este
// endpoint y el CLI de operación. Ver la cabecera de ese fichero.
import { planearLevantado, MOTIVO_MINIMO } from './levantarMarcaCore.cjs'

export { planearLevantado, MOTIVO_MINIMO }

/**
 * Retira las marcas de los sujetos dados. Best-effort por sujeto: si una falla, las demás se
 * intentan igual y se devuelve el detalle — quedarse a medias es el peor sitio, porque el
 * usuario sigue viendo captchas y quien ejecutó cree que ya está.
 *
 * La traducción sujeto → clave de Redis se hace AQUÍ, con `claveRetoForzado`, para que el
 * formato siga existiendo en un solo sitio.
 */
export async function levantarMarcas(
  sujetos: string[],
): Promise<{ levantados: string[]; fallidos: string[] }> {
  const levantados: string[] = []
  const fallidos: string[] = []
  for (const sujeto of sujetos) {
    try {
      await invalidate(claveRetoForzado(sujeto))
      levantados.push(sujeto)
    } catch {
      fallidos.push(sujeto)
    }
  }
  return { levantados, fallidos }
}
