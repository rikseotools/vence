// SIMULACIÓN T-088 (solo lectura): qué ven HOY los dos gemelos del detector de
// sobre-inclusión sobre los datos vivos, y cuál es la cola de recortes CONFIRMADOS
// que ningún badge publica.
import { Client } from 'pg'
import { classifyScope } from '../../lib/laws/scopeOverInclusion'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pgConfig } = require('../../lib/db/pgSsl.cjs')

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()

  const { rows } = await c.query(`
    SELECT t.position_type pt, t.topic_number tn, l.short_name ley, t.epigrafe,
           ts.article_numbers,
           (SELECT count(*) FROM articles a WHERE a.law_id = ts.law_id AND a.article_number ~ '^[0-9]+$') law_total,
           EXISTS (SELECT 1 FROM scope_over_inclusion_adjudications adj
                    WHERE adj.topic_id = ts.topic_id AND adj.law_id = ts.law_id AND adj.verdict = 'ok') AS ya_ok
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id JOIN laws l ON l.id = ts.law_id
     WHERE t.is_active = true`)

  const high = (r: any, tratarNullComoLeyEntera: boolean) => {
    const scoped = r.article_numbers === null
      ? (tratarNullComoLeyEntera ? Number(r.law_total) : 0)
      : r.article_numbers.filter((x: string) => /^[0-9]+$/.test(x)).length
    return classifyScope({ lawTotal: Number(r.law_total), scopedCount: scoped, epigrafe: r.epigrafe }).band === 'HIGH'
  }

  const cli = rows.filter(r => !r.ya_ok && high(r, true))
  const backend = rows.filter(r => high(r, false))          // sin exclusión y NULL→0
  const nulos = rows.filter(r => r.article_numbers === null).length

  console.log(`scopes de temas activos: ${rows.length} (con article_numbers NULL = ley entera: ${nulos})`)
  console.log(`\nHIGH que emitiría el CLI (scripts/health-sweep.cjs, criterio del 26/07): ${cli.length}`)
  console.log(`HIGH que emite el backend @Cron (writer REAL, criterio viejo):        ${backend.length}`)
  const soloCli = cli.filter(a => !backend.some(b => b.pt === a.pt && b.tn === a.tn && b.ley === a.ley))
  const soloBackend = backend.filter(a => !cli.some(b => b.pt === a.pt && b.tn === a.tn && b.ley === a.ley))
  console.log(`  · los ve el CLI y NO el @Cron (falsos negativos del writer real): ${soloCli.length}`)
  for (const r of soloCli.slice(0, 8)) console.log(`      - ${r.pt} T${r.tn} ${r.ley}`)
  console.log(`  · los cuenta el @Cron y el CLI ya no (ruido que el badge no puede bajar): ${soloBackend.length}`)
  for (const r of soloBackend.slice(0, 8)) console.log(`      - ${r.pt} T${r.tn} ${r.ley}`)

  const { rows: [conf] } = await c.query(
    `SELECT count(*)::int c, count(DISTINCT t.position_type)::int opos
       FROM scope_over_inclusion_adjudications a JOIN topics t ON t.id = a.topic_id
      WHERE a.verdict='over_inclusion' AND a.verificado`)
  console.log(`\nCola CONFIRMADA (verdict=over_inclusion AND verificado): ${conf.c} recortes en ${conf.opos} oposiciones`)
  console.log('   → hoy no la publica NINGÚN badge: es el cabo de T-088')
  await c.end()
})().catch(e => { console.error('ERROR', e.message); process.exit(1) })
