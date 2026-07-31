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

// Verdad conocida: por qué cada uno es lo que es está en la cabecera.
const CONOCIDOS = [
  { id: 'T-363', esperado: true, que: 'código de cobros servido — el fallo que motivó la ficha' },
  { id: 'T-403', esperado: false, que: 'guard de push: tooling local, no viaja a nadie' },
  { id: 'T-431', esperado: false, que: 'barrido de worktrees: tooling local' },
]

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

async function main() {
  const shas = { frontend: await shaVivo(HEALTH.frontend), backend: await shaVivo(HEALTH.backend) }
  console.log(`\n═══ SIM — el escalón medible del \`done\` (T-392 F1) ═══`)
  console.log(`sha vivo: frontend ${String(shas.frontend).slice(0, 9)} · backend ${String(shas.backend).slice(0, 9)}\n`)

  let fallos = 0
  console.log('CASOS CON VERDAD CONOCIDA (gate de regresión):')
  for (const c of CONOCIDOS) {
    const r = await analizar(c.id, { shas })
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

  if (fallos) console.error(`\n🔴 ${fallos} caso(s) con verdad conocida mal clasificado(s): la calibración se ha roto.`)
  else console.log('\n🟢 los casos con verdad conocida siguen bien clasificados.')
  return fallos ? 1 : 0
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error('❌ la simulación no pudo correr:', String(e.message || e).slice(0, 160))
  process.exit(1)
})
