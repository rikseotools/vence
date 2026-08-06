// lib/backlog/ramasDeTarea.cjs — ¿qué ramas de `origin` traen trabajo de ESTA tarea? (T-629)
//
// Es la mitad SUCIA de `claseDeEspera` (que es pura): aquí se le pregunta a git. Separado a
// propósito para que el criterio se pueda testear sin repositorio y esto se pueda medir contra el
// repo real sin arrastrar la decisión.
//
// ── POR EL COMMIT, NO POR EL NOMBRE DE LA RAMA ──────────────────────────────────────────────
// La primera versión buscaba ramas cuyo NOMBRE contuviera el id (`flota/T-543-…`). Medido contra
// las 27 reales dio **25 «solo cerrar»**, y era falso en la dirección peligrosa: T-543 y T-573
// decían *«CÓDIGO COMPLETO… NO SE HA PODIDO PUSHEAR»* y su trabajo está en las ramas que se
// rescataron del VPS esa misma noche — que se llaman `rescate/vps-sesion-w4-<sha>` y **no llevan
// el id de la tarea en ningún sitio del nombre**. Decir «solo falta cerrarla» de algo cuyo código
// no está en `main` es exactamente el error que no se puede cometer aquí.
//
// La convención que SÍ es fiable es la del propio repo: el asunto del commit declara la tarea
// (`fix(T-543): …`). Es la misma que usa el push-guard, así que no se estrena criterio nuevo.
//
// ── Y POR CONTENIDO, NUNCA POR SHA ──────────────────────────────────────────────────────────
// `git cherry` compara PARCHES: una rama cuyo contenido ya está en `main` —traído con cherry-pick,
// o reescrito al rebasar— sigue marcando sus commits como «únicos». Pasó tres veces el 06/08 con
// `flota/w3`. Por eso la pregunta es «¿difiere el ÁRBOL de esta rama de `main`?», no «¿cuántos
// commits tiene por delante?».
const { execFileSync } = require('child_process')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..')

function git(args, cwd = REPO) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }).trim()
  } catch { return '' }
}

/** Ids de tarea declarados en un texto de asuntos de commit. Misma forma que el resto del repo. */
function idsDeclarados(texto) {
  return new Set([...String(texto || '').matchAll(/\b(T-\d{1,4})\b/g)].map((m) => m[1]))
}

/**
 * Índice tarea → ramas de `origin` con contenido que `main` no tiene.
 *
 * Se construye UNA vez y se consulta N veces: preguntarle a git por cada tarea suelta hacía ~600
 * invocaciones para 27 tareas.
 *
 * @param {{excluirScratchpad?:boolean}} [opts]
 * @returns {{indice:Map<string,string[]>, ramasMiradas:number}|null}  `null` = no se pudo mirar
 */
function indiceDeRamas(opts = {}) {
  const todas = git(['branch', '-r', '--format=%(refname:short)'])
  if (!todas) return null                       // sin git no se afirma nada
  const ramas = todas.split('\n').map((s) => s.trim())
    .filter((r) => r && !/\/HEAD$/.test(r) && r !== 'origin/main')
  const indice = new Map()
  let miradas = 0
  for (const r of ramas) {
    // ¿Aporta CONTENIDO? (árbol, no commits). El scratchpad no cuenta: son ficheros de trabajo.
    const excl = opts.excluirScratchpad === false ? [] : [':(exclude)scratchpad']
    const diff = git(['diff', '--name-only', `origin/main...${r}`, '--', '.', ...excl])
    if (!diff) continue
    miradas++
    // Las tareas las declaran los ASUNTOS de sus commits no fusionados.
    const asuntos = git(['log', '--format=%s', `origin/main..${r}`])
    for (const id of idsDeclarados(asuntos)) {
      indice.set(id, [...(indice.get(id) || []), r])
    }
  }
  return { indice, ramasMiradas: miradas }
}

/**
 * Hechos para `claseDeEspera`. `{}` si no se pudo mirar — distinto de «no hay nada», que es la
 * confusión que [T-615] costó cara.
 *
 * @param {string} id
 * @param {{indice:Map<string,string[]>}|null} idx  el de `indiceDeRamas()`
 */
function hechosDeGit(id, idx) {
  if (!idx || !idx.indice) return {}
  const ramas = idx.indice.get(id) || []
  return { ramasSinFusionar: ramas.length, ramas }
}

module.exports = { indiceDeRamas, hechosDeGit, idsDeclarados }
