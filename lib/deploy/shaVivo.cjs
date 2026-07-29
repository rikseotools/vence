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

module.exports = { ENDPOINTS, shaVivo, shasVivos }
