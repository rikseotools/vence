#!/usr/bin/env node
// scripts/laws/registrar-fuente-editorial.cjs
//
// Registra la fuente oficial de contenedores EDITORIALES del temario (ODM, Agenda 2030,
// planes de Gobierno Abierto, Protocolos UE…), para que el Paso 1 del manual deje de estar
// bloqueado por "no hay fuente registrada". [T-144]. Simula por defecto.
//
//   node scripts/laws/registrar-fuente-editorial.cjs <plan.json>              # simula
//   node scripts/laws/registrar-fuente-editorial.cjs <plan.json> --aplicar    # escribe
//
// El plan es un array de EntradaFuenteEditorial (ver lib/laws/fuenteEditorial.js). Escribe
// `laws.boe_url` (repurposed como "URL de fuente oficial", mismo uso que ya tienen otras
// filas no-BOE) y `laws.last_verification_summary` con el shape ya establecido por
// `exempt-editorial-laws.cjs`. NUNCA toca `is_virtual` — eso es una exención distinta
// (contenedorInstitucional.js) para normas SIN fuente citable en absoluto.
//
// Requiere DATABASE_URL con escritura sobre `laws` (BD de negocio) — un rol de lectura no
// puede aplicar esto, solo simularlo.

require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const { Client } = require('pg')
const { validarPlanFuenteEditorial, resumenFuenteEditorial } = require('../../lib/laws/fuenteEditorial')

const APLICAR = process.argv.includes('--aplicar')
const planPath = process.argv[2]

async function main() {
  if (!planPath || planPath.startsWith('--')) {
    console.error('Uso: node scripts/laws/registrar-fuente-editorial.cjs <plan.json> [--aplicar]')
    process.exit(2)
  }
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
  const v = validarPlanFuenteEditorial(plan)
  if (!v.ok) {
    console.error('❌ Plan inválido:')
    v.problemas.forEach((p) => console.error('   · ' + p))
    process.exit(1)
  }

  const c = new Client({
    connectionString: (process.env.DATABASE_URL || '').split('?')[0],
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  console.log(`\n═══ FUENTE EDITORIAL — ${plan.length} ley(es) ═══`)
  const nowIso = new Date().toISOString()
  let ok = 0
  for (const e of plan) {
    const summary = resumenFuenteEditorial(e, nowIso)
    console.log(`\n · ${e.nombre}`)
    console.log(`   boe_url  → ${e.fuenteUrl}`)
    console.log(`   estado   → ${summary.is_ok ? 'is_ok:true (Paso 1 completo)' : 'is_ok:false (fuente registrada, Paso 1 PENDIENTE)'}`)
    console.log(`   mensaje  → ${e.mensaje}`)
    if (APLICAR) {
      try {
        await c.query('update laws set boe_url = $1, last_verification_summary = $2::jsonb, updated_at = now() where id = $3',
          [e.fuenteUrl, JSON.stringify(summary), e.lawId])
        await c.query(
          `insert into observable_events (source, severity, event_type, endpoint, error_message, metadata)
           values ('script', 'info', 'law_fuente_editorial_registrada', 'registrar-fuente-editorial', null, $1::jsonb)`,
          [JSON.stringify({ law_id: e.lawId, nombre: e.nombre, fuente: e.fuenteUrl, paso1_completo: e.paso1Completo, tarea: 'T-144' })],
        ).catch(() => {})
        ok++
      } catch (err) {
        console.error(`   ❌ ${err.message}`)
      }
    } else {
      ok++
    }
  }
  console.log(APLICAR ? `\n✅ aplicadas: ${ok}/${plan.length}\n` : `\n  (simulación — ${ok}/${plan.length} entradas válidas; añade --aplicar para escribir)\n`)
  await c.end()
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
