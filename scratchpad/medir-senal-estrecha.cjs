// La señal ESTRECHA: ¿main tocó los ficheros de la rama DESPUÉS de que se emitiera su veredicto?
//
// «La rama no contiene main» dispara en el 99% (medido) — inservible. Pero mis cuatro incidentes
// tenían todos la misma forma: la rama se revisó, el veredicto pidió un arreglo, el arreglo se
// aplicó en main, y la rama se quedó con el texto viejo. Eso es acotable en el tiempo: solo
// importa lo que main cambió DESPUÉS del veredicto, y solo en los ficheros que la rama toca.
const { execFileSync } = require('child_process')
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')
const { indiceDeRamas } = require('../lib/backlog/ramasDeTarea.cjs')

const git = (args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }).trim()
  } catch { return '' }
}

;(async () => {
  const c = new Client(pgConfig()); await c.connect()
  const { rows } = await c.query(
    `SELECT id, reviewed_at, review_verdict FROM backlog_tasks
      WHERE reviewed_at IS NOT NULL AND closed_at IS NULL ORDER BY id`)
  await c.end()

  const idx = indiceDeRamas()
  if (!idx) { console.log('sin git'); return }

  let conRama = 0, sinRiesgo = 0, conRiesgo = 0
  const casos = []
  for (const t of rows) {
    const ramas = idx.indice.get(t.id) || []
    if (!ramas.length) continue
    conRama++
    const desde = new Date(t.reviewed_at).toISOString()
    let peor = null
    for (const r of ramas) {
      const suyos = git(['diff', '--name-only', `origin/main...${r}`, '--', '.', ':(exclude)scratchpad'])
        .split('\n').filter(Boolean)
      if (!suyos.length) continue
      // Lo que main cambió DESPUÉS del veredicto, restringido a los ficheros de la rama.
      const despues = git(['log', `--since=${desde}`, '--format=', '--name-only', 'origin/main', '--', ...suyos])
        .split('\n').map((s) => s.trim()).filter(Boolean)
      const tocados = [...new Set(despues)].filter((f) => suyos.includes(f))
      if (tocados.length && (!peor || tocados.length > peor.n)) peor = { rama: r, n: tocados.length, ej: tocados.slice(0, 3) }
    }
    if (peor) { conRiesgo++; casos.push({ id: t.id, v: t.review_verdict, ...peor }) }
    else sinRiesgo++
  }

  console.log(`revisadas con rama sin fusionar: ${conRama}`)
  console.log(`  · main NO tocó sus ficheros tras el veredicto: ${sinRiesgo}`)
  console.log(`  · main SÍ los tocó → el aviso saltaría aquí:   ${conRiesgo}`)
  console.log(`\n→ ${conRama ? Math.round((conRiesgo / conRama) * 100) : 0}% de las revisadas con rama`)
  for (const x of casos) console.log(`   ${x.id} [${x.v}] · ${x.n} fichero(s) · ${x.rama}\n        ${x.ej.join(', ')}`)
})().catch((e) => { console.error(e.message); process.exit(1) })
