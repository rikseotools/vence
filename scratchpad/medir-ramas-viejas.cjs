// ¿Cuántas ramas de la flota NO contienen `main`, y de esas cuántas pisarían de verdad algo?
//
// Antes de añadir un aviso hay que saber si saltaría en el 5% o en el 90%: un aviso que salta
// siempre no se lee (lección del gate de la cabecera de explicaciones, que fallaba en el 100% de
// los lotes buenos). Y «no contiene main» por sí solo no es el riesgo — el riesgo es que ADEMÁS
// `main` haya tocado alguno de los ficheros que la rama toca. Eso es lo que se cuenta aquí.
const { execFileSync } = require('child_process')

const git = (args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }).trim()
  } catch { return '' }
}

const ramas = git(['branch', '-r', '--format=%(refname:short)']).split('\n')
  .map((s) => s.trim())
  .filter((r) => r && !/\/HEAD$/.test(r) && r !== 'origin/main')

let alDia = 0, viejasSinRiesgo = 0, viejasConRiesgo = 0, sinContenido = 0
const riesgo = []

for (const r of ramas) {
  const suyos = git(['diff', '--name-only', `origin/main...${r}`, '--', '.', ':(exclude)scratchpad'])
  if (!suyos) { sinContenido++; continue }

  // ¿Contiene `main`? Si sí, no puede devolver nada: ya tiene todo lo de main.
  let contiene = false
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', 'origin/main', r],
      { stdio: 'ignore', timeout: 30000 })
    contiene = true
  } catch { contiene = false }
  if (contiene) { alDia++; continue }

  // Vieja. El riesgo REAL: ficheros que la rama toca y que `main` también cambió desde que
  // divergieron. Solo ahí puede el merge devolver una versión anterior.
  const base = git(['merge-base', 'origin/main', r])
  const tocaRama = new Set(suyos.split('\n').filter(Boolean))
  const tocaMain = new Set(git(['diff', '--name-only', `${base}..origin/main`, '--', '.', ':(exclude)scratchpad'])
    .split('\n').filter(Boolean))
  const comunes = [...tocaRama].filter((f) => tocaMain.has(f))

  if (comunes.length) { viejasConRiesgo++; riesgo.push({ rama: r, n: comunes.length, ej: comunes.slice(0, 3) }) }
  else viejasSinRiesgo++
}

console.log(`ramas con contenido propio: ${ramas.length - sinContenido} (de ${ramas.length})`)
console.log(`  · al día (contienen main), no pueden devolver nada: ${alDia}`)
console.log(`  · viejas SIN solape de ficheros con main:            ${viejasSinRiesgo}`)
console.log(`  · viejas CON solape → el aviso saltaría aquí:        ${viejasConRiesgo}`)
const total = alDia + viejasSinRiesgo + viejasConRiesgo
console.log(`\n→ el aviso saltaría en ${viejasConRiesgo}/${total} = ${total ? Math.round((viejasConRiesgo / total) * 100) : 0}%`)
riesgo.sort((a, b) => b.n - a.n)
console.log('\nlas 10 de más solape:')
for (const x of riesgo.slice(0, 10)) console.log(`   ${String(x.n).padStart(3)} ficheros · ${x.rama}\n        ${x.ej.join(', ')}`)
