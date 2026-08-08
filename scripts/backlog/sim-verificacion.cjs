#!/usr/bin/env node
/**
 * sim-verificacion.cjs — calibración del escalón medible del `done` (Fase 1 de T-392).
 *
 *   npm run sim:verificacion            mide sobre las tareas cerradas recientemente
 *   npm run sim:verificacion -- --dias 14 --listar
 *
 * La ficha lo pedía con todas las letras: *«hay que probarla contra los commits reales de esta
 * semana antes de encenderla»*, porque el riesgo real no es que el gate falle, es que **sea
 * ruido**. Si exige esperar un deploy a las tareas de documentación y de tooling —que son la
 * mitad del backlog— se aprende a esquivarlo, y un guardarraíl esquivado protege menos que uno
 * que no existe (T-375, T-403).
 *
 * Dos partes:
 *
 *  1. **CASOS CON VERDAD CONOCIDA** — gate de regresión. [T-363] es el fallo que motivó la ficha
 *     (código de COBROS cerrado sin desplegar): tiene que bloquear. [T-403] y [T-431] son tooling
 *     local puro: no pueden bloquear. Si alguno se invierte, la calibración se ha roto.
 *  2. **BARRIDA** sobre las tareas cerradas de verdad, para ver la proporción. No hay respuesta
 *     «correcta» aquí: es el dato que un humano mira antes de encender.
 */
const path = require('path')
const fs = require('fs')
const { analizar, shaVivo, HEALTH } = require('./verificacion.cjs')

const REPO = path.resolve(__dirname, '../..')
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1] }
const DIAS = Number(arg('--dias', 7))
const LISTAR = process.argv.includes('--listar')

/**
 * El commit RAÍZ del repo: el estado sintético «no hay NADA desplegado».
 *
 * ── POR QUÉ NO SE USA EL SHA VIVO AQUÍ (T-459, 04/08) ──────────────────────────────────────
 * Los casos de verdad conocida se medían contra producción, y eso los hizo **caducar**: [T-363]
 * se declaró «tiene que BLOQUEAR» cuando su código de cobros aún no estaba desplegado; en cuanto
 * se desplegó, el gate empezó a decir con toda la razón «se puede cerrar» y la simulación llevaba
 * días en 🔴 acusando a la calibración de rota. Un fixture cuya verdad depende del día es un
 * fixture que miente: o grita en falso (y se ignora) o hay que reescribirlo cada semana.
 *
 * Contra la raíz, la pregunta que se hace es la que no envejece: *«si esto NO estuviera
 * desplegado, ¿bloquearía?»*. Eso es una propiedad de la tarea, no del calendario.
 */
function commitRaiz() {
  const salida = require('child_process')
    .execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], { cwd: REPO, encoding: 'utf8' })
    .trim().split('\n')
  return salida[salida.length - 1]
}

/**
 * Verdad conocida. `shas` fija el estado desplegado SINTÉTICO de cada caso; si no se pone, es
 * «nada desplegado» (la raíz).
 */
function casosConocidos(raiz) {
  const nada = { frontend: raiz, backend: raiz }
  return [
    { id: 'T-363', esperado: true, shas: nada, que: 'código de cobros servido y sin desplegar — el fallo que motivó la puerta' },
    { id: 'T-403', esperado: false, shas: nada, que: 'guard de push: tooling local, no viaja a nadie' },
    { id: 'T-431', esperado: false, shas: nada, que: 'barrido de worktrees: tooling local' },
    // El caso de [T-459]: el commit SERVIDO está vivo y el que falta no toca nada servido (un
    // spec y un módulo que solo importan las pruebas). Antes bloqueaba —y había que rodearlo con
    // `--igualmente`— porque preguntaba por TODOS los commits. Con `shas.frontend` fijado al
    // commit servido, este caso reproduce esa situación exacta y no depende de qué se despliegue
    // mañana.
    {
      id: 'T-504',
      esperado: false,
      shas: { frontend: '29a3dc2f4', backend: raiz },
      que: 'lo servido YA está vivo; lo que falta es un spec + un módulo de solo pruebas (T-459)',
    },
  ]
}

async function tareasCerradas() {
  try {
    const url = process.env.DATABASE_URL ||
      fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
    const s = require('postgres')(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })
    try {
      return await s`
        SELECT id, title FROM public.backlog_tasks
         WHERE closed_at IS NOT NULL AND closed_at > now() - (${String(DIAS)} || ' days')::interval
         ORDER BY closed_at DESC`
    } finally { try { await s.end({ timeout: 3 }) } catch {} }
  } catch { return null }
}

/** Gemela de `tareasCerradas`, mismo patrón de conexión y mismo fail-open. [T-735] */
async function tareasVivasConPendiente() {
  try {
    const url = process.env.DATABASE_URL ||
      fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
    const s = require('postgres')(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 10 })
    try {
      return await s`
        SELECT id, title FROM public.backlog_tasks
         WHERE status <> 'done' AND resume_check IS NOT NULL
         ORDER BY id`
    } finally { try { await s.end({ timeout: 3 }) } catch {} }
  } catch { return null }
}

/**
 * [T-735] Barrida real: ¿alguna tarea viva se anuncia como «lista para verificar» con su código
 * fuera de `origin/main`?
 *
 * Dos partes, como la sección de arriba, y la segunda existe porque la primera puede dar VERDE
 * por la razón equivocada: el 08/08 se fusionaron las 7 que había, así que hoy la barrida sale a
 * cero. Un cero solo demuestra algo si además se demuestra que el detector SÍ dispara — y eso se
 * comprueba contra git de verdad (un commit que existe únicamente en una rama remota), no con
 * una fila inventada a mano, que es como se pasa una simulación por la razón equivocada.
 */
async function simTrabajoEnMain() {
  const { trabajoEnMain } = require('./verificacion.cjs')
  const { clasificarTrabajoEnMain } = require('../../lib/backlog/esperaDeploy.cjs')
  const { execFileSync } = require('child_process')
  const gitOut = (args) => {
    try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 }).trim() }
    catch { return '' }
  }
  let fallos = 0
  console.log('\n═══ [T-735] ¿el trabajo de la tarea llegó a main? ═══')

  // (a) EL DETECTOR DISPARA — contra un commit real que solo vive en una rama remota.
  const soloEnRama = gitOut(['log', '--format=%H', '-1', '--branches=flota/*', '--not', 'origin/main'])
  if (!soloEnRama) {
    console.log('  ⚠️  no hay ningún commit de rama fuera de main ahora mismo: no se puede')
    console.log('      demostrar que el detector dispara. El cero de abajo NO es concluyente.')
  } else {
    const v = clasificarTrabajoEnMain({ gitDisponible: true, declarantes: 1, enMain: 0, enHead: 0 })
    const ok = v.estado === 'sin_fusionar' && v.bloquea === true
    console.log(`  ${ok ? '✅' : '🔴'} dispara con un commit real de rama (${soloEnRama.slice(0, 9)}) → ${v.estado}`)
    if (!ok) fallos++
  }

  // (b) BARRIDA sobre las tareas vivas que esperan deploy o verificación.
  const filas = await tareasVivasConPendiente()
  if (!filas) {
    console.log('\n  ⚠️  sin BD: no se puede barrer el backlog vivo (solo el caso de arriba).')
    return fallos
  }
  const malas = []
  for (const f of filas) {
    const v = clasificarTrabajoEnMain(trabajoEnMain(f.id))
    if (v.estado === 'sin_fusionar') malas.push(f)
  }
  console.log(`\n  ${filas.length} tarea(s) viva(s) con pendiente escrito · ${malas.length} con su código FUERA de main`)
  for (const m of malas.slice(0, 20)) console.log(`   · ${m.id}  ${String(m.title).slice(0, 62)}`)
  if (malas.length) console.log('   (fusiona su rama: `git branch -r --list "*<id>*"`)')
  return fallos
}

async function main() {
  const shas = { frontend: await shaVivo('frontend'), backend: await shaVivo('backend') }
  const raiz = commitRaiz()
  console.log(`\n═══ SIM — el escalón medible del \`done\` (T-392 F1) ═══`)
  console.log(`sha vivo: frontend ${String(shas.frontend).slice(0, 9)} · backend ${String(shas.backend).slice(0, 9)}\n`)

  let fallos = 0
  console.log('CASOS CON VERDAD CONOCIDA (gate de regresión, contra estado desplegado SINTÉTICO):')
  for (const c of casosConocidos(raiz)) {
    const r = await analizar(c.id, { shas: c.shas })
    const ok = r.exige === c.esperado
    if (!ok) fallos++
    console.log(`  ${ok ? '✅' : '❌'} ${c.id} ${r.exige ? 'BLOQUEA' : 'deja cerrar'}${ok ? '' : ` (esperado ${c.esperado ? 'BLOQUEA' : 'deja cerrar'})`} — ${c.que}`)
    if (!ok) console.log(`       ${r.motivo}`)
  }

  const cerradas = await tareasCerradas()
  if (!cerradas) {
    console.log('\n⚠️  sin BD: no se puede medir el alcance sobre tareas reales (solo el gate de arriba).')
    return fallos ? 1 : 0
  }
  console.log(`\nALCANCE sobre ${cerradas.length} tarea(s) cerrada(s) en ${DIAS} día(s):`)
  console.log('  (⚠️  la pregunta «¿habría bloqueado AL CERRARSE?» NO se puede contestar: `deploy_runs`')
  console.log('   está VACÍA —ningún deploy ha pasado aún por el camino de [T-385]—, así que no existe')
  console.log('   el sha que estaba vivo aquel día. Lo que sí se mide es a CUÁNTAS tareas les habla el')
  console.log('   gate, que es lo que decide si molesta o no.)')
  const conServida = []
  let sinCommits = 0
  for (const t of cerradas) {
    const r = await analizar(t.id, { shas })
    if (!r.commits.length) { sinCommits++; continue }
    if (r.superficies.length) conServida.push({ ...t, ...r })
  }
  const conCommits = cerradas.length - sinCommits
  const pct = conCommits ? Math.round((conServida.length / conCommits) * 100) : 0
  console.log(`\n  ${conCommits} con commits propios · ${sinCommits} sin ninguno (fichas puras, el gate nunca las toca)`)
  console.log(`  tocan superficie SERVIDA: ${conServida.length} (${pct}%) ← a estas les hablaría el gate`)
  console.log(`  el otro ${100 - pct}% son documentación, tooling y datos: se cierran igual que hoy`)
  if (LISTAR) {
    for (const b of conServida.slice(0, 25)) {
      console.log(`\n   · ${b.id} — ${String(b.title).slice(0, 66)}`)
      for (const x of b.servidos.slice(0, 3)) console.log(`        [${x.superficie}] ${x.fichero}`)
    }
    if (conServida.length > 25) console.log(`\n   …y ${conServida.length - 25} más`)
  } else if (conServida.length) {
    console.log('  (--listar para revisarlas: si ahí aparece documentación o tooling, la calibración está mal)')
  }

  // ── [T-735] ¿el TRABAJO de la tarea llegó a main? ────────────────────────────────────────
  // Sección hermana, en el mismo sitio a propósito: es la misma familia de pregunta («¿este
  // estado dice la verdad?») y separarla en otro comando la volvería invisible, que es
  // exactamente el fallo que arregla.
  fallos += await simTrabajoEnMain()

  if (fallos) console.error(`\n🔴 ${fallos} caso(s) con verdad conocida mal clasificado(s): la calibración se ha roto.`)
  else console.log('\n🟢 los casos con verdad conocida siguen bien clasificados.')
  return fallos ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error('❌ la simulación no pudo correr:', String(e.message || e).slice(0, 160))
  process.exit(1)
})
