#!/usr/bin/env node
// scripts/laws/auditar-derogadas.cjs — ¿servimos alguna ley que el BOE da por DEROGADA ENTERA?
//
// Origen ([T-655], 07/08/2026): lo cazó un usuario premium, no una alerta. El tema 7 de Auxiliar
// Administrativo de Canarias llevaba CINCO SEMANAS montado sobre la Ley 8/2015 de Cabildos
// Insulares, derogada con efectos del 30/06/2026 por la Ley 3/2026. Ninguna de las cuatro
// vigilancias de leyes miraba esto (ver la cabecera de `lib/laws/derogacion.ts`).
//
// ON-DEMAND a propósito, como `audit:epigrafe-fuente`: mide contra la API del BOE una vez por ley,
// y meterlo en el barrido nocturno serían ~738 llamadas cada noche para una señal que cambia dos
// o tres veces al año. Lo que sí hace es DEJAR RASTRO al correrlo (hallazgos + evento), para que
// el resultado no muera en la terminal de quien lo ejecutó — que es el modo de fallo que costó
// semanas con `landing_incompleta` y con el gate de `audit:oposicion`.
//
// Uso:
//   node scripts/laws/auditar-derogadas.cjs                 # solo las que sirven temas vivos
//   node scripts/laws/auditar-derogadas.cjs --todas         # también las que no escopa nadie
//   node scripts/laws/auditar-derogadas.cjs --escribe       # además publica los hallazgos
//   node scripts/laws/auditar-derogadas.cjs --ley "8/2015"  # una sola, para verificar a mano
require('dotenv').config({ path: '.env.local' })
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { Client } = require('pg')

// El núcleo es TS y este runner es CJS: se compila al vuelo con tsx cuando hace falta. Se importa
// el núcleo en vez de copiar la regla — dos criterios para «¿está derogada?» acabarían divergiendo.
require('tsx/cjs')
const { detectarDerogacionTotal, gravedadDerogada } = require('../../lib/laws/derogacion.ts')

const args = process.argv.slice(2)
const TODAS = args.includes('--todas')
const ESCRIBE = args.includes('--escribe')
const iLey = args.indexOf('--ley')
const FILTRO = iLey >= 0 ? args[iLey + 1] : null

/** Saca el BOE-ID de una URL del BOE (`…act.php?id=BOE-A-2015-4621`). */
function boeIdDeUrl(url) {
  const m = String(url || '').match(/\b(BOE-[A-Z]-\d{4}-\d+)\b/)
  return m ? m[1] : null
}

async function analisisDe(boeId) {
  const url = `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/analisis`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) return { error: `HTTP ${r.status}` }
  try { return { json: await r.json() } } catch (e) { return { error: 'respuesta no es JSON' } }
}

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()

  // Solo leyes ACTIVAS con URL del BOE: sin ella no hay a qué preguntar. Se trae de una vez
  // cuántos temas la sirven y cuántas preguntas cuelgan, que es lo que gradúa la gravedad.
  const { rows: leyes } = await c.query(`
    SELECT l.id, l.short_name, l.boe_url,
           (SELECT count(DISTINCT ts.topic_id) FROM topic_scope ts WHERE ts.law_id = l.id)::int AS temas,
           (SELECT count(*) FROM questions q JOIN articles a ON a.id = q.primary_article_id
             WHERE a.law_id = l.id AND q.is_active)::int AS preguntas
      FROM laws l
     WHERE l.is_active AND coalesce(l.boe_url, '') <> ''
       AND ($1::text IS NULL OR l.short_name ILIKE '%' || $1 || '%')
     ORDER BY l.short_name`, [FILTRO])

  const candidatas = leyes.filter((l) => TODAS || FILTRO || l.temas > 0)
  console.log(`🔎 ${candidatas.length} ley(es) a comprobar contra el BOE` +
    (TODAS || FILTRO ? '' : ` (de ${leyes.length} activas con URL; el resto no las escopa ningún tema — usa --todas)`))

  const hallazgos = []
  let sinRespuesta = 0
  for (const [i, ley] of candidatas.entries()) {
    const boeId = boeIdDeUrl(ley.boe_url)
    if (!boeId) continue
    const { json, error } = await analisisDe(boeId)
    if (error) { sinRespuesta++; continue }
    const derogada = detectarDerogacionTotal(json)
    if (derogada) {
      const severidad = gravedadDerogada({ temasQueLaSirven: ley.temas, preguntasActivas: ley.preguntas })
      hallazgos.push({ ...ley, boeId, ...derogada, severidad })
      console.log(`   ${severidad === 'error' ? '🔴' : '🟡'} ${ley.short_name} — ${derogada.textoLiteral}` +
        `  [${ley.temas} tema(s), ${ley.preguntas} pregunta(s) activas]`)
    }
    if ((i + 1) % 50 === 0) console.log(`   … ${i + 1}/${candidatas.length}`)
  }

  console.log(`\n${hallazgos.length === 0 ? '✅' : '🔴'} ${hallazgos.length} ley(es) derogada(s) que seguimos sirviendo` +
    (sinRespuesta ? ` · ${sinRespuesta} sin respuesta del BOE (no se puede afirmar nada de ellas)` : ''))

  if (ESCRIBE) {
    // El hallazgo REEMPLAZA lo anterior de este kind: es una foto del estado actual, no un diario.
    await c.query(`DELETE FROM content_health_findings WHERE kind = 'ley_derogada_servida'`)
    for (const h of hallazgos) {
      await c.query(`
        INSERT INTO content_health_findings (category, kind, severity, message, detail, computed_at)
        VALUES ('content', 'ley_derogada_servida', $1, $2, $3::jsonb, now())`,
        [h.severidad,
         `${h.short_name}: derogada según el BOE`,
         // `detail` es jsonb: se guarda ESTRUCTURADO (no una frase), que es lo que permite
         // ordenar por impacto y enlazar la norma nueva desde el panel sin volver a parsear.
         JSON.stringify({
           ley: h.short_name,
           boeId: h.boeId,
           derogadaPor: h.porNormaId,
           textoBoe: h.textoLiteral,
           temas: h.temas,
           preguntasActivas: h.preguntas,
           queHacer: 'NO quitar la ley sin más: el programa oficial suele decir que las referencias se ' +
             'entienden hechas a la norma que la sustituye. Importar la nueva y re-anclar ' +
             '(docs/runbooks/leyes-anuales-caducadas.md).',
         })])
    }
    // Y MARCAR LA LEY, que es lo que el resto del sistema puede leer. La columna `is_derogated`
    // existía desde antes (26 leyes marcadas) y nadie la rellenaba: publicar solo un hallazgo
    // habría sido añadir una TERCERA señal al lado de dos que ya se ignoran (`change_status`
    // lleva 9 leyes en 'changed' sin triar, la más vieja desde el 26/07).
    for (const h of hallazgos) {
      await c.query('UPDATE laws SET is_derogated = true WHERE id = $1 AND is_derogated = false', [h.id])
    }
    const { rows: sinMarcar } = await c.query(
      'SELECT short_name FROM laws WHERE id = ANY($1::uuid[]) AND is_derogated = false',
      [hallazgos.map((h) => h.id)])
    if (sinMarcar.length) throw new Error('no se marcaron como derogadas: ' + sinMarcar.map((l) => l.short_name).join(', '))
    if (hallazgos.length) console.log(`   ▶ ${hallazgos.length} ley(es) marcada(s) is_derogated=true`)

    await c.query(`
      INSERT INTO observable_events (source, severity, event_type, endpoint, metadata)
      VALUES ('gha', $1, 'leyes_derogadas_auditadas', 'auditar-derogadas', $2::jsonb)`,
      [hallazgos.some((h) => h.severidad === 'error') ? 'error' : 'info',
       JSON.stringify({ comprobadas: candidatas.length, hallazgos: hallazgos.length, sinRespuesta })])
    console.log('   ▶ hallazgos publicados (badge de salud del contenido) y evento emitido')
  } else if (hallazgos.length) {
    console.log('   ▶ simulación: repite con --escribe para publicarlos en el panel de salud')
  }

  await c.end()
  process.exit(hallazgos.some((h) => h.severidad === 'error') ? 1 : 0)
})()
