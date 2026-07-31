#!/usr/bin/env node
// scripts/laws/vigilar-fuentes-legales.cjs
//
// Vigila por HASH las fuentes legales que el cron del BOE no cubre. [T-026]
//
//   node scripts/laws/vigilar-fuentes-legales.cjs                 # simula (no escribe)
//   node scripts/laws/vigilar-fuentes-legales.cjs --aplicar
//   node scripts/laws/vigilar-fuentes-legales.cjs --ley <uuid> --aplicar
//   node scripts/laws/vigilar-fuentes-legales.cjs --limite 20 --aplicar
//
// ## Qué vigila, y por qué estas y no otras
//
// `check-boe-changes` (Fargate, diario) cubre 696 leyes, pero deja fuera tres grupos por
// decisión suya: sin `boe_url`, URL `doc.php` (documento puntual sin texto consolidado, donde
// su extractor de «última actualización» siempre falla) y `scope='eu'`. Resultado medido el
// 31/07: **160 leyes reales sirviendo 4.893 preguntas sin ningún vigilante** — el TUE entre
// ellas, con 807 preguntas en 39 oposiciones, recién verificado y sin nadie mirándolo.
//
// Este comando trabaja sobre las que YA tienen fuente registrada en `law_source_verification`
// (`source_url` + `verified_source_hash`), que es la línea base creada al verificarlas. No
// inventa fuentes: si una ley no tiene URL, no es asunto suyo — eso es research por-ley, que es
// el verdadero cuello de botella y es manual.
//
// ## Qué hace con lo que encuentra
//
//   · `linea_base`  → guarda el primer hash. Callado: no es un hallazgo.
//   · `sin_cambio`  → actualiza la fecha de comprobación. Callado.
//   · `cambiada`    → **escribe un hallazgo** (`content_health_findings`, kind
//                     `law_source_changed`) + evento. Sale en `/admin/contenido` y se revisa
//                     con la frase «revisa los cambios de fuentes legales».
//   · `inaccesible` → evento `warn`, SIN hallazgo. Una descarga fallida NO es un cambio, y
//                     tratarla como tal quemaría la señal en dos semanas.
//
// El juicio sobre QUÉ cambió y si afecta a alguna pregunta lo pone una sesión de Claude cuando
// Manuel lo pide — aquí no hay ningún modelo, a propósito (ver `lib/laws/sourceWatch.cjs`).

require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { fetchSourceText } = require('../../lib/laws/fetchSourceText.cjs')
const { clasificarVigilancia } = require('../../lib/laws/sourceWatch.cjs')

const argv = process.argv.slice(2)
const APLICAR = argv.includes('--aplicar')
const valor = (f) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null }
const LEY = valor('--ley')
const LIMITE = parseInt(valor('--limite') || '0', 10)

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL.split('?')[0],
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // ⚠️ GOTCHA que costó un 8-de-8 en falso: `verified_source_hash` lo escribe
  // `verify-law-source.cjs` como `sha256(texto CRUDO).slice(0,32)`, mientras que la vigilancia
  // hashea el texto NORMALIZADO y completo. Son dos criterios distintos y compararlos da
  // «cambiada» siempre. Cada herramienta conserva el suyo: la línea base de la vigilancia sale
  // de SU propia serie en el historial (`verified_by='vigilancia-hash'`), y `verified_source_hash`
  // no se toca — es la evidencia de la verificación, no el reloj de la vigilancia.
  const { rows: leyes } = await c.query(
    `select v.law_id, l.short_name, v.source_url, v.verified_at,
            (select h.source_hash from law_source_verification_history h
              where h.law_id = v.law_id and h.verified_by = 'vigilancia-hash'
              order by h.created_at desc limit 1) verified_source_hash,
            (select count(*)::int from questions q
               join articles a on a.id = q.primary_article_id
              where a.law_id = l.id and q.is_active) preg
       from law_source_verification v
       join laws l on l.id = v.law_id
      where v.source_url is not null and v.source_url <> ''
        and l.is_active
        and ($1::uuid is null or v.law_id = $1::uuid)
      order by preg desc`,
    [LEY],
  )
  const lote = LIMITE ? leyes.slice(0, LIMITE) : leyes

  console.log(`\n═══ VIGILANCIA DE FUENTES LEGALES (hash) ═══`)
  console.log(`  con fuente registrada: ${leyes.length}${LIMITE ? ` · se revisan ${lote.length}` : ''}\n`)

  const res = { linea_base: 0, sin_cambio: 0, cambiada: 0, inaccesible: 0 }
  const cambios = []

  for (const ley of lote) {
    const texto = await fetchSourceText(ley.source_url)
    const v = clasificarVigilancia({ hashPrevio: ley.verified_source_hash, textoDescargado: texto })
    res[v.estado]++

    const etiqueta = { cambiada: '🔴 CAMBIADA', inaccesible: '⚠️  inaccesible', linea_base: '📌 línea base', sin_cambio: '✅ sin cambio' }[v.estado]
    console.log(`  ${etiqueta.padEnd(16)} ${String(ley.preg).padStart(4)}p  ${ley.short_name}`)
    if (v.estado === 'cambiada') cambios.push({ ...ley, hash: v.hash })

    if (!APLICAR) continue

    if (v.estado === 'cambiada' || v.estado === 'linea_base') {
      // El hash nuevo se guarda SIEMPRE en el historial (append-only), pero la línea base de
      // `law_source_verification` solo se pisa en la primera captura: si cambió, la referencia
      // buena sigue siendo la verificada hasta que alguien revise y re-verifique. Pisarla aquí
      // haría que el aviso se auto-silenciara al día siguiente.
      await c.query(
        `insert into law_source_verification_history (law_id, state, source_hash, verdict, verified_by, findings)
         values ($1, $2, $3, $4, 'vigilancia-hash', $5::jsonb)`,
        [ley.law_id, v.estado === 'cambiada' ? 'changed' : 'baseline', v.hash,
         v.estado === 'cambiada' ? 'source_changed' : 'baseline',
         JSON.stringify({ source_url: ley.source_url, motivo: v.motivo, preguntas: ley.preg })],
      ).catch((e) => console.log(`     (historial no escrito: ${e.message.slice(0, 60)})`))

      // La línea base de la vigilancia vive en el historial (se acaba de insertar arriba). NO se
      // escribe en `law_source_verification.verified_source_hash`: esa columna es la evidencia
      // de la verificación de completitud, con otro criterio de hash y otro dueño.
    }

    await c.query(
      `insert into observable_events (source, severity, event_type, endpoint, error_message, metadata)
       values ('script', $1, $2, 'vigilar-fuentes-legales', null, $3::jsonb)`,
      [v.estado === 'cambiada' ? 'error' : v.estado === 'inaccesible' ? 'warn' : 'info',
       v.estado === 'cambiada' ? 'law_source_changed' : v.estado === 'inaccesible' ? 'law_source_unreachable' : 'law_source_checked',
       JSON.stringify({ law_id: ley.law_id, short_name: ley.short_name, url: ley.source_url, preguntas: ley.preg, motivo: v.motivo })],
    ).catch(() => {})
  }

  console.log(`\n  línea base: ${res.linea_base} · sin cambio: ${res.sin_cambio} · CAMBIADAS: ${res.cambiada} · inaccesibles: ${res.inaccesible}`)
  if (cambios.length) {
    console.log(`\n  🔴 Revisar (dile a Claude: «revisa los cambios de fuentes legales»):`)
    cambios.forEach((x) => console.log(`     · ${x.short_name} (${x.preg} preguntas) → ${x.source_url}`))
  }
  if (!APLICAR) console.log('\n  (simulación — añade --aplicar para guardar hashes y emitir señales)\n')
  else console.log()

  await c.end()
  process.exitCode = cambios.length ? 1 : 0
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
