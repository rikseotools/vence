const { Client } = require('pg')
const { pgConfig } = require('/home/manuel/vence-sessions/movil3/lib/db/pgSsl.cjs')
const fs = require('fs')

const plan = JSON.parse(fs.readFileSync('/home/manuel/vence-sessions/movil3/scratchpad/t683/plan-rd806-2014.json', 'utf8'))
const ids = plan.movimientos.flatMap(m => m.preguntas)

;(async () => {
  const c = new Client(pgConfig()); await c.connect()
  const q = await c.query(`
    select left(q.id::text,8) pregunta, q.is_active, l.short_name ley, a.article_number art,
           (select count(*) from topic_scope ts
              where ts.law_id = a.law_id
                and (ts.article_numbers is null or a.article_number = any(ts.article_numbers))) temas
    from questions q
    join articles a on a.id = q.primary_article_id
    join laws l on l.id = a.law_id
    where q.id = any($1::uuid[])
    order by a.article_number`, [ids])
  console.log('RE-ANCLADAS (' + ids.length + '):')
  console.table(q.rows)
  const huerf = q.rows.filter(r => Number(r.temas) === 0).length
  console.log(huerf === 0 ? '✅ ninguna sigue huérfana' : `❌ ${huerf} siguen sin tema`)

  const jub = await c.query(`
    select left(id::text,8) id, is_active, lifecycle_state
    from questions where id = any($1::uuid[])`, [plan.jubilar ? plan.jubilar.flatMap(j => j.preguntas || [j]) : []])
  if (jub.rows.length) { console.log('JUBILADAS:'); console.table(jub.rows) }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
