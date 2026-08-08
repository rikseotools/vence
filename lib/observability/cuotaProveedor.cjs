// lib/observability/cuotaProveedor.cjs — cuánta cuota queda, según el PROVEEDOR.
//
// ## Por qué existe ([T-709], 08/08/2026) — y por qué corrige a su propio autor
//
// La primera versión de este trabajo dio por hecho que «no hay API de cuota: el proveedor no
// dice cuánta queda, solo corta», y montó una estimación empírica (comparar con lo gastado la
// última vez que se topó). **Era falso.** Cada respuesta de la API trae cabeceras
// `anthropic-ratelimit-unified-*` con el dato exacto, y encima el mismo con el que el proveedor
// decide cortarte.
//
// Se descubrió buscando otra cosa: había que distinguir dos tokens sin gastar cuota, y las
// cabeceras eran la única vía — con el dato dado por inexistente dentro. La lección, que vale
// más que el módulo: **antes de construir una estimación, comprobar si el dato real ya viene
// dado**. Una estimación que nadie puede desmentir no se corrige sola; ésta habría envejecido
// mintiendo, y encima con tests en verde.
//
// ## Qué cuesta preguntarlo
//
// Una petición de 1 token al modelo más barato. No se pregunta «cuánta cuota queda» (no existe
// ese endpoint): se hace la petición más pequeña posible y se leen SUS cabeceras. Por eso el
// sondeo no es gratis del todo y no se hace en bucle — se hace cuando alguien pregunta.

const UMBRAL_PROVEEDOR = 0.75  // el que el propio proveedor marca como `allowed_warning`

/**
 * Lee las cabeceras de cuota de una respuesta. PURO: recibe un mapa de cabeceras.
 *
 * @returns `{ utilizacion5h, utilizacion7d, umbral, estado, reset7d, reset5h }` o `null` si la
 *   respuesta no traía ninguna (proveedor cambiado, error de red, token de otro tipo).
 */
function leerCuota(cabeceras = {}) {
  const g = (k) => {
    const v = cabeceras[k] ?? cabeceras[k.toLowerCase()]
    return v === undefined || v === null || v === '' ? null : v
  }
  const num = (k) => {
    const v = g(k)
    if (v === null) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const u7 = num('anthropic-ratelimit-unified-7d-utilization')
  const u5 = num('anthropic-ratelimit-unified-5h-utilization')
  if (u7 === null && u5 === null) return null
  return {
    utilizacion5h: u5,
    utilizacion7d: u7,
    // El umbral lo dice el proveedor; si no viene, el suyo conocido. NO se inventa uno propio:
    // el día que lo cambien, queremos seguir a su criterio y no al nuestro de hace meses.
    umbral: num('anthropic-ratelimit-unified-7d-surpassed-threshold') ?? UMBRAL_PROVEEDOR,
    estado: g('anthropic-ratelimit-unified-status'),
    reset7d: num('anthropic-ratelimit-unified-7d-reset'),
    reset5h: num('anthropic-ratelimit-unified-5h-reset'),
  }
}

/**
 * La utilización que MANDA para decidir si hay que rotar: la peor de las dos ventanas.
 *
 * La semanal es la que corta de verdad (cuatro días sin poder trabajar), pero agotar la de 5 h
 * también te deja parado un rato — y quien está a media tarea no distingue una cosa de la otra.
 */
function utilizacionQueManda(c) {
  if (!c) return null
  const vals = [c.utilizacion5h, c.utilizacion7d].filter((v) => typeof v === 'number')
  return vals.length ? Math.max(...vals) : null
}

module.exports = { leerCuota, utilizacionQueManda, UMBRAL_PROVEEDOR }
