// lib/deploy/shaVivo.cjs
//
// Qué commit está VIVO en producción, por superficie.
//
// Fuente única y AGNÓSTICA DE PROVEEDOR: el contrato observable `/health` (campo `deploy`), no las
// tripas de ECS/ECR. El día que el cómputo se mueva de AWS a koigrid esto sigue funcionando igual;
// una consulta a `describe-services` no. Lo dice el propio runbook de despliegue: las notas de
// memoria sobre "qué hay desplegado" envejecen, el `/health` no.
//
// Por qué es un módulo y no dos copias: lo necesitan `deploy-pendiente.cjs` (¿toca desplegar?) y
// `backlog.cjs` (reconciliar tareas que esperaban un deploy). Una regla escrita en dos sitios se
// separa al primer cambio, y aquí el modo de fallo sería silencioso: una diría "ya está vivo" y la
// otra "todavía no".

const ENDPOINTS = {
  frontend: 'https://www.vence.es/api/health',
  backend: 'https://api.vence.es/health',
}

/**
 * Sha corto vivo en una superficie, o `null` si no se puede saber.
 *
 * NUNCA lanza: quien lo llama está haciendo otra cosa (listar el backlog, decidir un deploy) y una
 * red caída no puede tumbar esa tarea. `null` significa "no lo sé", que se trata distinto de "no
 * está desplegado" — la diferencia importa: con "no lo sé" NO se despierta nada.
 */
async function shaVivo(superficie, { timeoutMs = 8000 } = {}) {
  const url = ENDPOINTS[superficie]
  if (!url) return null
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!r.ok) return null
    const j = await r.json()
    return typeof j?.deploy === 'string' && j.deploy ? j.deploy : null
  } catch {
    return null
  }
}

/** Las dos superficies a la vez. Devuelve `{frontend, backend}`, cada uno sha corto o null. */
async function shasVivos(opts) {
  const [frontend, backend] = await Promise.all([
    shaVivo('frontend', opts),
    shaVivo('backend', opts),
  ])
  return { frontend, backend }
}

/**
 * El sha vivo, pero sabiendo si se puede uno FIAR de él (T-459).
 *
 * ── EL FALLO QUE CIERRA ────────────────────────────────────────────────────────────────────
 * Mientras ECS sustituye tareas, el balanceador reparte entre la revisión vieja y la nueva, así
 * que `/health` **contesta un sha u otro según a cuál caiga**. Quien lo consulta para decidir si
 * algo está desplegado obtiene entonces un veredicto no determinista: verificado cerrando
 * [T-523], el primer intento dijo «no está vivo» con el rollout a medias y el segundo, ya
 * terminado, devolvió el sha nuevo. **La misma pregunta, en el mismo minuto, con respuestas
 * opuestas** — y eso es exactamente lo que enseña a no creerse una puerta.
 *
 * Aquí no se resuelve adivinando cuál de los dos shas es «el bueno»: se DETECTA el desacuerdo y
 * se dice. Un «está desplegándose ahora mismo» es una respuesta honesta; un sha elegido a suertes
 * no lo es.
 *
 * @returns { sha, estable, vistos } — `estable:false` = hay un rollout en curso (los intentos no
 *          coincidieron). `sha` es el último visto, y NO debe usarse para bloquear si no es
 *          estable. `vistos` son los shas distintos observados, para poder contarlo.
 */
async function shaVivoEstable(superficie, { intentos = 3, pausaMs = 400, ...opts } = {}) {
  const vistos = []
  for (let i = 0; i < Math.max(1, intentos); i++) {
    const s = await shaVivo(superficie, opts)
    if (s && !vistos.includes(s)) vistos.push(s)
    // Una lectura fallida (null) no prueba desacuerdo: se ignora y se reintenta.
    if (i + 1 < Math.max(1, intentos) && pausaMs > 0) await new Promise((r) => setTimeout(r, pausaMs))
  }
  return { sha: vistos.length ? vistos[vistos.length - 1] : null, estable: vistos.length <= 1, vistos }
}

module.exports = { ENDPOINTS, shaVivo, shasVivos, shaVivoEstable }
