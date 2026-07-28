import { readFileSync, writeFileSync } from 'fs'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import path from 'path'
const { refDeclaradaDistinta, citaAusente } = require(path.join(process.cwd(), 'scripts/impugnaciones/barrido-citas.cjs'))
const HECHAS = ['102efb25', '91d4ce7a', '94f0d1fb', 'f529fc64', '32f8a676', '77001f7b', '1d68ed6e', 'fc7defa6']
const RE_ENTRE = /[«"“]([^»"”]{50,})[»"”]/
;(async () => {
  const db = getDb()
  const p = JSON.parse(readFileSync('scratchpad/pendientes26.json', 'utf8'))
    .filter((q: any) => !HECHAS.some((h) => q.id.startsWith(h)))
  const quedan: any[] = [], falsos: any[] = []
  for (const q of p) {
    const bq = String(q.ex).split('\n').filter((l: string) => l.trim().startsWith('>')).join(' ')
    const m = bq.match(RE_ENTRE)
    const ref = refDeclaradaDistinta(q.ex, q.an)
    if (ref && m) {
      const [otro]: any = await db.execute(sql`
        SELECT a.content FROM articles a
         WHERE a.law_id = (SELECT pa.law_id FROM questions qq JOIN articles pa ON pa.id=qq.primary_article_id WHERE qq.id=${q.id}::uuid)
           AND a.article_number=${ref} AND a.is_active LIMIT 1`)
      if (otro && !citaAusente(m[1], otro.content)) { falsos.push({ ...q, ref }); continue }
    }
    quedan.push(q)
  }
  writeFileSync('scratchpad/quedan.json', JSON.stringify(quedan, null, 1))
  console.log(`de 23: ${falsos.length} son citas de apoyo DECLARADAS y correctas (falsos positivos) · quedan ${quedan.length}`)
  for (const f of falsos) console.log(`   ✓ ${f.id.slice(0, 8)} · ${f.ley} art ${f.an} → cita el art ${f.ref}, y allí es literal`)
  process.exit(0)
})()
