// Medición final con el núcleo YA cambiado: cómo queda el reparto de bandas en vivo.
import { Client } from 'pg'
import { classifyScope } from '../../lib/laws/scopeOverInclusion'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL!)); await c.connect()
  const { rows } = await c.query(`
    SELECT t.position_type pt, t.topic_number tn, l.short_name ley, t.epigrafe, ts.article_numbers,
           (SELECT count(*) FROM articles a WHERE a.law_id = ts.law_id AND a.article_number ~ '^[0-9]+$') law_total,
           EXISTS (SELECT 1 FROM scope_over_inclusion_adjudications adj
                    WHERE adj.topic_id=ts.topic_id AND adj.law_id=ts.law_id AND adj.verdict='ok') ya_ok
      FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id JOIN laws l ON l.id=ts.law_id
     WHERE t.is_active = true`)
  await c.end()
  const b: Record<string, number> = {}
  let casoFicha = ''
  for (const r of rows as any[]) {
    const scoped = r.article_numbers === null ? Number(r.law_total)
      : r.article_numbers.filter((x: string) => /^[0-9]+$/.test(x)).length
    const v = classifyScope({ lawTotal: Number(r.law_total), scopedCount: scoped, epigrafe: r.epigrafe })
    b[v.band] = (b[v.band] || 0) + 1
    if (r.pt === 'oficial_de_gestion_parlamento_de_andalucia' && Number(r.tn) === 12 && r.ley === 'Ley 22/2009') casoFicha = `${v.band} — ${v.reasons.join(' · ')}`
  }
  console.log('bandas con el núcleo NUEVO:', b)
  console.log('(antes: HIGH 4 · MEDIUM 257 · CLEARED 315 · NONE 5388)')
  console.log('\ncaso de la ficha, Parlamento de Andalucía T12 · Ley 22/2009:', casoFicha || 'sin cambio')
})().catch(e => { console.error('ERROR', e.message); process.exit(1) })
