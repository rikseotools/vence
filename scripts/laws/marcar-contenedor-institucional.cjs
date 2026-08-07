#!/usr/bin/env node
// scripts/laws/marcar-contenedor-institucional.cjs
//
// Marca `is_virtual=true` las "leyes" que en realidad son fichas de organismos, para que dejen
// de contar como deuda de completitud. **Simula por defecto.** [T-026]
//
//   node scripts/laws/marcar-contenedor-institucional.cjs            # simula
//   node scripts/laws/marcar-contenedor-institucional.cjs --aplicar
//
// El criterio vive en `lib/laws/contenedorInstitucional.js` (puro y testeado) y exige las tres
// condiciones a la vez: un solo artículo, sin fuente registrada y **declarado** contenido
// institucional en su propio texto. Un Protocolo de la UE de un artículo NO cumple — y no debe,
// porque marcar `is_virtual` a una norma real la saca de la vigilancia para siempre y en
// silencio, que es peor que el problema que se está resolviendo.
//
// Deja traza en `observable_events` (`law_marcada_virtual`): un cambio que apaga un detector
// tiene que poder auditarse después.

require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { clasificarContenedorInstitucional } = require('../../lib/laws/contenedorInstitucional')

const APLICAR = process.argv.includes('--aplicar')

async function main() {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  const { rows } = await c.query(`
    select l.id, l.short_name, l.boe_url, l.verification_status,
           (select count(*)::int from articles a where a.law_id = l.id and a.is_active) arts,
           (select a.content from articles a where a.law_id = l.id and a.is_active limit 1) txt,
           (select count(*)::int from questions q
              join articles a on a.id = q.primary_article_id
             where a.law_id = l.id and q.is_active) preg
      from laws l
     where l.is_active and coalesce(l.is_virtual, false) = false`)

  const marcar = []
  for (const r of rows) {
    const v = clasificarContenedorInstitucional({
      articulosActivos: r.arts, boeUrl: r.boe_url, textoPrimerArticulo: r.txt,
    })
    if (v.esContenedor) marcar.push(r)
  }

  console.log(`\n═══ CONTENEDORES INSTITUCIONALES ═══`)
  console.log(`  leyes revisadas: ${rows.length} · a marcar: ${marcar.length}`)
  marcar.forEach((r) => console.log(`   · ${String(r.preg).padStart(4)}p  ${r.short_name}`))
  console.log(`  preguntas afectadas: ${marcar.reduce((s, r) => s + r.preg, 0)} (siguen sirviéndose: esto NO las toca)`)

  if (!APLICAR) {
    console.log('\n  (simulación — añade --aplicar para escribir)\n')
    await c.end()
    return
  }

  let ok = 0
  for (const r of marcar) {
    await c.query('update laws set is_virtual = true, updated_at = now() where id = $1', [r.id])
    await c.query(
      `insert into observable_events (source, severity, event_type, endpoint, error_message, metadata)
       values ('script', 'info', 'law_marcada_virtual', 'marcar-contenedor-institucional', null, $1::jsonb)`,
      [JSON.stringify({ law_id: r.id, short_name: r.short_name, preguntas: r.preg, tarea: 'T-026' })],
    ).catch(() => {})
    ok++
  }
  console.log(`\n✅ marcadas: ${ok}\n`)
  await c.end()
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
