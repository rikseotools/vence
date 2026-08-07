// lib/security/challengePolicy/levantarMarcaCore.cjs
//
// Criterio PURO de «levantar la marca de reto forzado»: qué sujetos toca y si la petición vale.
// En `.cjs` a propósito: lo consumen el endpoint admin (TS, dentro de la VPC, que es el único
// que alcanza Redis) y el CLI de operación (node pelado). Un solo criterio para los dos; si
// cada uno validara por su cuenta, el día que se endurezca uno el otro seguiría dejando pasar.
//
// ⚠️ Este núcleo NO conoce el formato de la clave de Redis, y es deliberado: `captcha:force:*`
// se construye en UN solo sitio (`forceChallenge.ts`, con su guardarraíl
// `retoForzadoPuertaUnica.guardrail.test.ts`). Aquí se devuelven SUJETOS y quien tiene la llave
// los traduce. Así esta pieza no puede convertirse en la segunda puerta.
//
// El porqué de la herramienta entera, con el incidente del 07/08 dentro: `levantarMarca.ts`.

/** Motivo mínimo: «ok» o «ya» no explican nada dentro de tres semanas. */
const MOTIVO_MINIMO = 15;

/**
 * @param {{userId?: string|null, deviceId?: string|null, motivo?: string|null}} args
 * @returns {{valido:true, sujetos:string[]}|{valido:false, error:string}}
 */
function planearLevantado(args) {
  const motivo = String(args?.motivo ?? '').trim();
  if (motivo.length < MOTIVO_MINIMO) {
    return {
      valido: false,
      error: `El motivo es obligatorio y debe explicar el caso (mínimo ${MOTIVO_MINIMO} caracteres)`,
    };
  }

  const sujetos = [];
  const userId = String(args?.userId ?? '').trim();
  const deviceId = String(args?.deviceId ?? '').trim();
  // Los dos a la vez cuando los hay: la marca se pone sobre usuario Y dispositivo en el mismo
  // gesto (`/api/fraud/report`), así que levantar solo uno deja al otro retando y parece que la
  // herramienta no ha funcionado.
  if (userId) sujetos.push(userId);
  if (deviceId) sujetos.push(`device:${deviceId}`);

  if (!sujetos.length) {
    return { valido: false, error: 'Hace falta al menos un sujeto: userId, deviceId o ambos' };
  }
  return { valido: true, sujetos };
}

module.exports = { planearLevantado, MOTIVO_MINIMO };
