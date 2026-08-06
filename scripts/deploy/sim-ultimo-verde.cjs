#!/usr/bin/env node
// scripts/deploy/sim-ultimo-verde.cjs — ¿qué desplegaría el lanzador AHORA MISMO? [T-619]
//
// Simula la decisión de `deploy-cuando-verde.sh` contra el CI REAL, sin desplegar ni escribir
// nada: recorre los últimos N commits de `origin/main`, pide sus check-runs a GitHub, y aplica el
// MISMO núcleo puro que usa el lanzador (`lib/deploy/ultimoVerde.js`). Sin esto, la única forma
// de saber si el criterio funciona era lanzar un deploy de verdad y esperar quince minutos.
//
// Sirve además para CALIBRAR la ventana: imprime a qué distancia de la punta está el último verde.
//
// Uso:  node scripts/deploy/sim-ultimo-verde.cjs [ventana]
require('dotenv').config({ path: '.env.local' })
const { execSync } = require('child_process')
const { clasificarCiCodigo } = require('../../lib/deploy/ciGate.js')
const { elegirCommitDesplegable } = require('../../lib/deploy/ultimoVerde.js')

const VENTANA = Number(process.argv[2] || 15)
const REPO = process.env.DEPLOY_REPO || 'rikseotools/vence'
const PAT = (process.env.GITHUB_PAT || '').replace(/["']/g, '')

;(async () => {
  if (!PAT) {
    console.error('sin GITHUB_PAT en .env.local — no puedo consultar el CI')
    process.exit(2)
  }
  execSync('git fetch origin -q', { stdio: 'ignore' })
  const shas = execSync(`git rev-list -n ${VENTANA} origin/main`, { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean)

  console.log(`Ventana: ${shas.length} commit(s) desde la punta de origin/main\n`)
  const candidatos = []
  for (const sha of shas) {
    const r = await fetch(
      `https://api.github.com/repos/${REPO}/commits/${sha}/check-runs?per_page=100`,
      { headers: { Authorization: `Bearer ${PAT}`, Accept: 'application/vnd.github+json' } },
    )
    const j = await r.json().catch(() => ({}))
    const { estado, motivo } = clasificarCiCodigo(j.check_runs || [])
    const asunto = execSync(`git log -1 --format=%s ${sha}`, { encoding: 'utf8' }).trim()
    const icono = { verde: '🟢', rojo: '🔴', cancelado: '⚪', curso: '🟡', faltan: '⚪' }[estado] || '❔'
    console.log(`  ${icono} ${sha.slice(0, 9)} ${String(estado).padEnd(10)} ${asunto.slice(0, 62)}`)
    if (estado !== 'verde') console.log(`               ↳ ${motivo}`)
    candidatos.push({ sha, estado })
    if (estado === 'verde') break // el lanzador tampoco mira más atrás
  }

  const d = elegirCommitDesplegable({ candidatos })
  console.log(`\n▶ DECISIÓN: ${d.accion.toUpperCase()} — ${d.motivo}`)
  if (d.sha) console.log(`   sha: ${d.sha.slice(0, 9)}  ·  a ${d.dejaFuera.length} commit(s) de la punta`)
  if (d.rotos.length) console.log(`   ⚠️  ${d.rotos.length} commit(s) con el CI en ROJO por delante`)
  if (d.accion === 'desplegar' && d.dejaFuera.length) {
    console.log('   se quedan para el siguiente deploy:')
    for (const s of d.dejaFuera) {
      console.log(`     · ${s.slice(0, 9)} ${execSync(`git log -1 --format=%s ${s}`, { encoding: 'utf8' }).trim().slice(0, 60)}`)
    }
  }
})()
