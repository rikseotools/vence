/**
 * sim-title-boundary.ts — SIMULACIÓN end-to-end del detector de off-by-one de
 * frontera de título (fix 24/07/2026, caso Mario/LOSU).
 *
 * Pipeline REAL: DB (epígrafe + topic_scope) → estructura título→rango de la ley
 * (índice del BOE + parseBoeSections) → classifyTitleBoundary → overflow.
 *
 * Uso: npx tsx scripts/scope/sim-title-boundary.ts <position_type> [topic_number]
 *      (--scope 1,2,6 fuerza un scope concreto, para reproducir el caso pre-fix)
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import postgres from 'postgres'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseBoeSections } = require('../../lib/laws/parseBoeSections')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { classifyTitleBoundary, resumenBarrida } = require('../../lib/laws/scopeTitleBoundary')
type Seccion = { num: string; from: number; to: number; blockId?: string; rubrica?: string }

const sql = postgres(process.env.DATABASE_URL as string, { ssl: { rejectUnauthorized: false }, max: 1 })
const clean = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
const boeId = (u: string) => (String(u || '').match(/BOE-A-\d{4}-\d+/) || [])[0]

const structCache = new Map<string, Seccion[]>()
async function estructuraBoe(bid: string): Promise<Seccion[]> {
  if (structCache.has(bid)) return structCache.get(bid)!
  const idx = await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/indice`, { headers: { Accept: 'application/xml' } })).text()
  const bl = [...idx.matchAll(/<bloque>\s*<id>([^<]*)<\/id>\s*<titulo>([\s\S]*?)<\/titulo>/g)].map((m) => ({ id: m[1].trim(), label: clean(m[2]) }))
  const secs: Seccion[] = parseBoeSections(bl).secciones
  structCache.set(bid, secs)
  return secs
}

// Rúbrica (materia) de un título: viene DENTRO del bloque, tras "TÍTULO X.". Fetch
// extra por bloque → solo para los títulos CANDIDATOS a overflow (bounded).
const rubricaCache = new Map<string, string>()
async function rubricaBoe(bid: string, blockId: string): Promise<string> {
  const key = `${bid}#${blockId}`
  if (rubricaCache.has(key)) return rubricaCache.get(key)!
  let r = ''
  try {
    const body = clean(await (await fetch(`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${bid}/texto/bloque/${blockId}`, { headers: { Accept: 'application/xml' } })).text())
    const m = body.match(/(?:CAP[IÍ]TULO|T[IÍ]TULO|LIBRO|PARTE)\s+[IVXLCDM]+\.?\s+([^.]{3,140})/i)
    r = m ? m[1].trim().replace(/\s+/g, ' ') : ''
  } catch { r = '' }
  rubricaCache.set(key, r)
  return r
}

/** classify con SEGUNDA pasada: enriquece con rúbrica los títulos candidatos y re-clasifica. */
async function classifyConRubrica(bid: string, epigrafe: string, secs: Seccion[], arts: string[], law?: { shortName?: string; name?: string }) {
  const first = classifyTitleBoundary(epigrafe, secs, arts, law)
  if (!first.applicable || !first.overflow.length) return first
  // fetch rúbrica solo de los títulos señalados
  const candNums = new Set(first.overflow.map((o: { titulo: string }) => o.titulo))
  const enriched = secs.map((s) => ({ ...s }))
  for (const s of enriched) {
    if (candNums.has(s.num) && s.blockId && s.rubrica == null) s.rubrica = await rubricaBoe(bid, s.blockId)
  }
  return classifyTitleBoundary(epigrafe, enriched, arts, law)
}

async function main() {
  const [pt, topicArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const forced = (process.argv.find((a) => a.startsWith('--scope=')) || '').replace('--scope=', '')
  if (!pt) { console.error('uso: sim-title-boundary.ts <position_type> [topic_number] [--scope=1,2,6]'); process.exit(2) }

  const temas = await sql`
    SELECT id, topic_number, bloque_number, title, epigrafe FROM topics
    WHERE position_type = ${pt} AND is_active = true ${topicArg ? sql`AND topic_number = ${Number(topicArg)}` : sql``}
    ORDER BY topic_number`

  // Un "✅ sin overflow" solo significa algo si de verdad se evaluó ALGO. Sin estos
  // contadores el runner devuelve el mismo verde cuando (a) el position_type no
  // existe —un typo basta—, (b) la ley no tiene id del BOE, o (c) el índice del BOE
  // no se pudo descargar. El caso (c) es el peligroso en una barrida bank-wide: si
  // el BOE limita el ritmo a mitad, TODAS las oposiciones restantes saldrían
  // "limpias" y serían indistinguibles de un banco sano. (T-121, 26/07/2026)
  let flagged = 0, evaluados = 0, sinBoeId = 0, sinArts = 0, fetchFail = 0, noAplicable = 0
  for (const t of temas) {
    const scopes = await sql`
      SELECT l.short_name, l.name AS law_name, l.boe_url, ts.article_numbers FROM topic_scope ts
      JOIN laws l ON l.id = ts.law_id WHERE ts.topic_id = ${t.id}`
    for (const s of scopes) {
      const bid = boeId(s.boe_url)
      if (!bid) { sinBoeId++; continue }
      const arts: string[] = forced && topicArg ? forced.split(',') : (s.article_numbers || [])
      if (!arts.length) { sinArts++; continue }
      let secs: Seccion[]
      try { secs = await estructuraBoe(bid) } catch { fetchFail++; continue }
      // T-129: se pasa la LEY para atar los títulos del epígrafe a su norma y no aplicar
      // "(Constitución, Título VIII)" al Estatuto de Andalucía.
      const r = await classifyConRubrica(bid, t.epigrafe, secs, arts, { shortName: s.short_name, name: s.law_name })
      evaluados++
      if (!r.applicable) noAplicable++
      if (r.applicable && r.overflow.length) {
        flagged++
        console.log(`🔴 T${t.topic_number} (${t.title}) · ${s.short_name}`)
        console.log(`   epígrafe títulos permitidos: ${r.allowedTitles.join(', ')}`)
        for (const o of r.overflow) console.log(`   art.${o.article} → Título ${o.titulo} (NO en el epígrafe)`)
      }
    }
  }

  // El veredicto ("¿significa algo este resultado?") lo decide el NÚCLEO PURO
  // `resumenBarrida` en lib/laws/scopeTitleBoundary.js, testeado aparte — aquí solo
  // se imprime. Sin esto, un typo en el position_type o un BOE que no responde
  // producían el mismo "✅ Sin overflow" que un banco sano (T-121).
  console.log(
    `\n📊 ${temas.length} tema(s) · ${evaluados} scope(s) evaluado(s)` +
    ` · omitidos: ${sinBoeId} sin id BOE, ${sinArts} sin artículos, ${fetchFail} sin índice descargable` +
    ` · ${noAplicable} con epígrafe no mapeable a títulos`,
  )
  const veredicto = resumenBarrida({ temas: temas.length, evaluados, fetchFail, flagged })
  switch (veredicto.veredicto) {
    case 'sin_temas':
      console.log(`⚠️  0 temas activos para position_type='${pt}' — ¿typo? NO es un "sin overflow".`); break
    case 'nada_evaluado':
      console.log('⚠️  NADA evaluado — este resultado no dice nada sobre la salud del scope.'); break
    case 'incompleto':
      console.log(`⚠️  INCONCLUYENTE: ${fetchFail} scope(s) sin poder consultar el BOE. "Sin overflow" NO se puede afirmar.`); break
    case 'con_hallazgos':
      if (fetchFail) console.log(`⚠️  cobertura incompleta (${fetchFail} sin índice), pero los ${flagged} hallazgos SÍ son reales.`)
      console.log(`${flagged} overflow(s) detectado(s).`); break
    default:
      console.log('✅ Sin overflow de frontera de título.')
  }
  await sql.end()
  if (veredicto.exitCode) process.exit(veredicto.exitCode)
}
main().catch((e) => { console.error(e); process.exit(1) })
