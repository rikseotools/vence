#!/usr/bin/env node
/**
 * Prioriza la campaña `article_no_coverage` del badge de `/admin/contenido` (T-112).
 *
 * QUÉ CONTESTA: "de los ~3.000 artículos del temario sin una sola pregunta,
 * ¿cuáles escribo PRIMERO?". La respuesta no es obvia porque una pregunta cuelga
 * del ARTÍCULO y el artículo lo comparten muchas oposiciones: hay leyes que
 * cierran 3 temas por artículo escrito y otras 0,2. Sin medirlo se elige por
 * corazonada y cuesta un orden de magnitud más.
 *
 * La decisión la toma el núcleo puro `lib/salud/coberturaHuerfanos.js` (testeado,
 * con guardarraíl de umbrales contra el detector real). Este runner solo aporta
 * los datos y los imprime.
 *
 * Uso:
 *   node scripts/cobertura-huerfanos.cjs                  ranking de leyes
 *   node scripts/cobertura-huerfanos.cjs --ley "LPRL"     artículos de esa ley
 *   node scripts/cobertura-huerfanos.cjs --simular "LPRL" qué pasaría al cubrirla
 *   node scripts/cobertura-huerfanos.cjs --top 30         cuántas filas imprimir
 *
 * OJO — este script LEE, no escribe: no toca BD ni caches. Lo que decide dónde
 * trabajar no debe poder romper nada.
 */
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))
const { UMBRALES, simularCobertura, rankearLeyes, rankearArticulos } = require(
  path.join(__dirname, '..', 'lib', 'salud', 'coberturaHuerfanos'),
)

const args = process.argv.slice(2)
const opt = (n) => {
  const i = args.indexOf(n)
  return i >= 0 ? args[i + 1] : null
}
const LEY = opt('--ley')
const SIMULAR = opt('--simular')
const TOP = Number(opt('--top') || 20)

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url.replace(/sslmode=[^&]*/, 'sslmode=no-verify'), {
  ssl: { rejectUnauthorized: false },
  max: 1,
  connect_timeout: 60,
  idle_timeout: 180,
})

// Universo = pares (artículo huérfano, tema) de los temas que HOY disparan el
// detector. Los umbrales del HAVING son los de `UMBRALES`, interpolados desde el
// núcleo para que no puedan divergir del módulo que luego decide con ellos.
const PARES = () => s`
  WITH temas_que_disparan AS (
    SELECT tp.position_type, tp.id AS topic_id, tp.topic_number
    FROM topic_scope ts
    JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active
    JOIN LATERAL unnest(ts.article_numbers) AS an(num) ON true
    JOIN articles a ON a.law_id = ts.law_id AND a.article_number = an.num AND a.is_active
    WHERE length(coalesce(a.content, '')) > 40
      AND a.content NOT ILIKE '%derogado%'
      AND a.article_number ~ '^[0-9]+$'
    GROUP BY 1, 2, 3
    HAVING count(*) >= ${UMBRALES.MIN_ARTS_TEMA}
       AND count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) < count(*)
       AND count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::float
           / count(*) >= ${UMBRALES.COBERTURA_MIN}
       AND count(*) - count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))
           >= ${UMBRALES.HUECOS_MIN}
  )
  SELECT DISTINCT t.position_type, t.topic_id, t.topic_number,
         a.id AS article_id, l.short_name AS law_key,
         l.short_name || ' ' || a.article_number AS label,
         length(a.content) AS chars
  FROM temas_que_disparan t
  JOIN topic_scope ts ON ts.topic_id = t.topic_id
  JOIN laws l ON l.id = ts.law_id
  JOIN LATERAL unnest(ts.article_numbers) AS an(num) ON true
  JOIN articles a ON a.law_id = ts.law_id AND a.article_number = an.num AND a.is_active
  WHERE length(coalesce(a.content, '')) > 40
    AND a.content NOT ILIKE '%derogado%'
    AND a.article_number ~ '^[0-9]+$'
    AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)`

;(async () => {
  const pares = await PARES()
  const arts = new Set(pares.map((p) => p.article_id))
  const temas = new Set(pares.map((p) => p.topic_id))
  const opos = new Set(pares.map((p) => p.position_type))

  console.log('COBERTURA DE ARTÍCULOS HUÉRFANOS — universo actual')
  console.log('='.repeat(74))
  console.log(`pares (artículo, tema): ${pares.length}   ·   artículos únicos: ${arts.size}`)
  console.log(`temas que disparan: ${temas.size}   ·   oposiciones con hallazgo: ${opos.size}`)
  console.log(`factor de reuso: ${(pares.length / arts.size).toFixed(2)}× (cada artículo sirve a esos temas)\n`)

  if (SIMULAR) {
    const ids = pares.filter((p) => p.law_key === SIMULAR).map((p) => p.article_id)
    if (!ids.length) {
      console.error(`No hay artículos huérfanos de "${SIMULAR}". Usa el nombre exacto del ranking.`)
      process.exit(2)
    }
    const r = simularCobertura(pares, ids)
    console.log(`SIMULACIÓN — cubrir los ${r.articulos} artículos huérfanos de "${SIMULAR}":`)
    console.log(`  temas que quedarían a CERO huérfanos : ${r.temasACero}`)
    console.log(`  temas que dejarían de disparar       : ${r.temasBajoUmbral}`)
    console.log(`  hallazgos de oposición que se cierran: ${r.findingsCerrados}`)
    console.log('\n  (temasACero es el arreglo real; temasBajoUmbral incluye los que solo')
    console.log('   bajan del umbral. Optimizar por el segundo es maquillar el badge.)')
    await s.end()
    return
  }

  if (LEY) {
    const dePares = pares.filter((p) => p.law_key === LEY)
    if (!dePares.length) {
      console.error(`No hay artículos huérfanos de "${LEY}". Usa el nombre exacto del ranking.`)
      process.exit(2)
    }
    const chars = new Map(dePares.map((p) => [p.article_id, p.chars]))
    console.log(`ARTÍCULOS HUÉRFANOS DE "${LEY}" (orden de escritura sugerido)\n`)
    rankearArticulos(dePares)
      .slice(0, TOP)
      .forEach((a, i) => {
        console.log(
          `${String(i + 1).padStart(3)}. ${String(a.temas).padStart(3)} temas · ` +
            `${String(a.oposiciones).padStart(3)} oposiciones · ` +
            `${String(chars.get(a.articleId) || 0).padStart(5)} chars · ${a.etiqueta}`,
        )
      })
    await s.end()
    return
  }

  // Demanda real por oposición: sin esto el ranking manda a trabajar en huecos
  // que no ve nadie. Dos leyes pueden empatar a ratio y diferir 10x en alcance.
  const demRows = await s`
    SELECT target_oposicion AS pt, count(*)::int usuarios
    FROM user_profiles WHERE target_oposicion IS NOT NULL GROUP BY 1`
  const demanda = Object.fromEntries(demRows.map((d) => [d.pt, d.usuarios]))

  const ranking = rankearLeyes(pares, demanda)
  console.log('RANKING DE LEYES — por temas cerrados POR ARTÍCULO escrito\n')
  console.log('  ratio  arts  temas0  bajo↓  finds  usuarios  ley')
  ranking.slice(0, TOP).forEach((r) => {
    console.log(
      `  ${String(r.ratio).padStart(5)}  ${String(r.articulos).padStart(4)}  ` +
        `${String(r.temasACero).padStart(6)}  ${String(r.temasBajoUmbral).padStart(5)}  ` +
        `${String(r.findingsCerrados).padStart(5)}  ${String(r.usuarios).padStart(8)}  ${r.ley}`,
    )
  })
  console.log('\n  ratio    = temas que quedan a cero por cada artículo que hay que escribir')
  console.log('  temas0   = temas SIN ningún huérfano tras cubrir la ley entera (arreglo real)')
  console.log('  bajo↓    = temas que solo dejan de disparar el detector (efecto badge)')
  console.log('  finds    = hallazgos de oposición que desaparecerían del panel')
  console.log('  usuarios = opositores con esas oposiciones como objetivo (a cuánta gente llega)')
  console.log('\n  El orden es por RATIO (cuánto cunde el esfuerzo). "usuarios" es la segunda')
  console.log('  lente: dos leyes pueden empatar a ratio y diferir 10x en alcance real.')
  console.log(`\n  siguiente paso:  node scripts/cobertura-huerfanos.cjs --ley "${ranking[0]?.ley}"`)
  console.log('  luego, para generar:  docs/maintenance/generar-preguntas-con-ia.md')

  await s.end()
})().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
