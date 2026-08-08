// ¿Cuántas ramas vivas son ANTERIORES a [T-532] — es decir, editan el índice GENERADO
// (`docs/roadmap/tareas-pendientes.md`) en vez de su ficha (`docs/roadmap/tareas/T-nnn.md`)?
//
// Esta es la señal que sobrevivió a dos mediciones. «La rama no contiene main» saltaba en el 99%;
// «main tocó sus ficheros tras el veredicto» saltaba en el 86%… y los 6 casos eran EL MISMO
// FICHERO, el índice. O sea que el fenómeno no es genérico: es este, y tiene nombre.
//
// El runbook ya avisa de los dos casos, y el traicionero es el 2º: si git NO da conflicto y
// auto-fusiona, el texto entra en un fichero generado y la siguiente regeneración lo borra.
const { execFileSync } = require('child_process')

const git = (args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }).trim()
  } catch { return '' }
}

const INDICE = 'docs/roadmap/tareas-pendientes.md'
const DIR_FICHAS = 'docs/roadmap/tareas/'

const ramas = git(['branch', '-r', '--format=%(refname:short)']).split('\n')
  .map((s) => s.trim()).filter((r) => r && !/\/HEAD$/.test(r) && r !== 'origin/main')

let preT532 = 0, alDia = 0, noTocanBacklog = 0
const casos = []
for (const r of ramas) {
  const f = git(['diff', '--name-only', `origin/main...${r}`, '--', '.', ':(exclude)scratchpad'])
    .split('\n').filter(Boolean)
  if (!f.length) continue
  const tocaIndice = f.includes(INDICE)
  const tocaFicha = f.some((x) => x.startsWith(DIR_FICHAS))
  if (!tocaIndice && !tocaFicha) { noTocanBacklog++; continue }
  if (tocaIndice && !tocaFicha) { preT532++; casos.push(r) }
  else alDia++
}

console.log(`ramas con contenido propio: ${preT532 + alDia + noTocanBacklog}`)
console.log(`  · no tocan el backlog:                       ${noTocanBacklog}`)
console.log(`  · ya escriben en su FICHA (post-T-532):      ${alDia}`)
console.log(`  · ⚠️  editan el ÍNDICE GENERADO (pre-T-532): ${preT532}`)
const conBacklog = preT532 + alDia
console.log(`\n→ el aviso saltaría en ${preT532}/${conBacklog} de las que tocan el backlog = ${conBacklog ? Math.round((preT532 / conBacklog) * 100) : 0}%`)
console.log(`   y en ${preT532}/${preT532 + alDia + noTocanBacklog} del total = ${Math.round((preT532 / (preT532 + alDia + noTocanBacklog)) * 100)}%`)
console.log('\nlas que avisaría:')
for (const r of casos.slice(0, 15)) console.log('   ·', r)
if (casos.length > 15) console.log(`   … y ${casos.length - 15} más`)
