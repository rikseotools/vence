// lib/sessions/latidoFallo.cjs — núcleo PURO: qué hacer cuando el latido falla en silencio. (T-687)
//
// ── EL PROBLEMA ──────────────────────────────────────────────────────────────────────────────
// `scripts/sessions/latir.cjs` es el ÚNICO escritor de `worktree_sessions.last_signal_at`, y por
// diseño (regla 1 de su cabecera) NUNCA falla hacia fuera: si algo revienta dentro de su `main()`
// (la BD no contesta, `resolverSid()` tropieza, una consulta falla…), el `.catch()` de más afuera
// se lo traga entero y sale con 0 — y como se invoca SIN `--verbose` y con `stdio: 'ignore'`, ni
// siquiera queda un rastro en un log. Una sesión puede correr `heartbeat` explícito, ver
// «✅ lease renovado» y seguir sin saber que su latido de PRESENCIA (otra tabla, otro escritor)
// lleva minutos sin escribir nada — que es justo el caso real que abrió esta ficha (07/08).
//
// La cura NO es quitar el fail-open (rule 1 es correcta: la telemetría no puede bloquear un
// push). Es dejar una MARCA LOCAL, síncrona, que no depende de la BD que acaba de fallar — y
// que el siguiente latido que SÍ tenga éxito pueda leer, borrar y convertir en una señal con
// número (cuántos intentos, cuántos minutos), en vez de dejarlo sin rastro para siempre.
//
// Este módulo es el núcleo PURO (sin fs, sin red): decide qué escribir en la marca y qué decir.
// La E/S (leer/escribir el fichero, spawnear `friccion-emitir.cjs`) vive en `latir.cjs` y en el
// comando `heartbeat` de `backlog.cjs`.

/**
 * Actualiza (o crea) la marca de fallo tras un intento fallido de latir.
 *
 * @param {{desde:string, intentos:number}|null} previa  la marca anterior, o null si es el primer fallo
 * @param {string} mensaje    el error del intento actual (se trunca: esto viaja a un fichero y a un evento)
 * @param {string} ahoraISO   `new Date().toISOString()` del intento actual
 * @returns {{desde:string, intentos:number, ultimoError:string, ultimoIntento:string}}
 */
function registrarIntento(previa, mensaje, ahoraISO) {
  const desde = (previa && previa.desde) || ahoraISO
  const intentos = ((previa && previa.intentos) || 0) + 1
  return {
    desde,
    intentos,
    ultimoError: String(mensaje == null ? '' : mensaje).slice(0, 200),
    ultimoIntento: ahoraISO,
  }
}

/**
 * Cuántos minutos estuvo el latido callado, a partir de la marca que se va a borrar porque el
 * intento actual SÍ tuvo éxito.
 *
 * @param {{desde:string, intentos:number, ultimoError:string}} marca
 * @param {string} ahoraISO
 * @returns {{minutos:number, intentos:number, detalle:string}}
 */
function resumenRecuperacion(marca, ahoraISO) {
  const minutos = Math.max(0, Math.round((new Date(ahoraISO).getTime() - new Date(marca.desde).getTime()) / 60000))
  return {
    minutos,
    intentos: marca.intentos,
    detalle: `${marca.intentos} intento(s) fallido(s), ${minutos} min sin latir hasta recuperarse (último error: ${marca.ultimoError || '(sin mensaje)'})`,
  }
}

/**
 * El aviso que ve una sesión al correr `heartbeat` mientras el latido de presencia sigue roto
 * AHORA MISMO (la marca no se ha podido borrar todavía porque no ha habido ningún intento con
 * éxito). Es la respuesta directa a «que al menos el comando lo diga».
 *
 * @param {{desde:string, intentos:number, ultimoError:string}} marca
 * @param {string} ahoraISO
 * @returns {string[]} líneas del aviso, o [] si no hay nada que decir (se filtra fuera)
 */
function lineasAvisoActivo(marca, ahoraISO) {
  if (!marca) return []
  const minutos = Math.max(0, Math.round((new Date(ahoraISO).getTime() - new Date(marca.desde).getTime()) / 60000))
  return [
    `⚠️  TU LATIDO DE PRESENCIA LLEVA ${marca.intentos} INTENTO(S) FALLANDO, ${minutos} min sin escribir en worktree_sessions.`,
    `   Último error: ${marca.ultimoError || '(sin mensaje)'}`,
    '   El lease de tus tareas (esto) sigue renovándose bien — es la OTRA señal, la que mira el',
    '   reparto para decidir si estás viva. Con ella rota, otra sesión puede darte por muerta.',
  ]
}

module.exports = { registrarIntento, resumenRecuperacion, lineasAvisoActivo }
