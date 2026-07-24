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
const { classifyTitleBoundary } = require('../../lib/laws/scopeTitleBoundary')
type Seccion = { num: string; from: number; to: number }

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

async function main() {
  const [pt, topicArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const forced = (process.argv.find((a) => a.startsWith('--scope=')) || '').replace('--scope=', '')
  if (!pt) { console.error('uso: sim-title-boundary.ts <position_type> [topic_number] [--scope=1,2,6]'); process.exit(2) }

  const temas = await sql`
    SELECT id, topic_number, bloque_number, title, epigrafe FROM topics
    WHERE position_type = ${pt} AND is_active = true ${topicArg ? sql`AND topic_number = ${Number(topicArg)}` : sql``}
    ORDER BY topic_number`
  let flagged = 0
  for (const t of temas) {
    const scopes = await sql`
      SELECT l.short_name, l.boe_url, ts.article_numbers FROM topic_scope ts
      JOIN laws l ON l.id = ts.law_id WHERE ts.topic_id = ${t.id}`
    for (const s of scopes) {
      const bid = boeId(s.boe_url)
      if (!bid) continue
      const arts: string[] = forced && topicArg ? forced.split(',') : (s.article_numbers || [])
      if (!arts.length) continue
      let secs: Seccion[]
      try { secs = await estructuraBoe(bid) } catch { continue }
      const r = classifyTitleBoundary(t.epigrafe, secs, arts)
      if (r.applicable && r.overflow.length) {
        flagged++
        console.log(`🔴 T${t.topic_number} (${t.title}) · ${s.short_name}`)
        console.log(`   epígrafe títulos permitidos: ${r.allowedTitles.join(', ')}`)
        for (const o of r.overflow) console.log(`   art.${o.article} → Título ${o.titulo} (NO en el epígrafe)`)
      }
    }
  }
  console.log(flagged ? `\n${flagged} overflow(s) detectado(s).` : '\n✅ Sin overflow de frontera de título.')
  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
