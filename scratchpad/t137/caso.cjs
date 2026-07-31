const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => { const c=new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const { rows } = await c.query(`
    SELECT l.short_name, ts.article_numbers IS NULL AS ley_entera,
           (SELECT count(*) FROM articles a WHERE a.law_id=ts.law_id AND a.article_number ~ '^[0-9]+$') law_total_numericos,
           (SELECT count(*) FROM articles a WHERE a.law_id=ts.law_id) law_total_todos,
           t.epigrafe
      FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id JOIN laws l ON l.id=ts.law_id
     WHERE t.position_type='oficial_de_gestion_parlamento_de_andalucia' AND t.topic_number=12`)
  console.table(rows.map(r=>({ley:r.short_name,entera:r.ley_entera,num:r.law_total_numericos,todos:r.law_total_todos})))
  console.log('epígrafe:', rows[0] && rows[0].epigrafe)
  await c.end() })().catch(e=>{console.error(e.message);process.exit(1)})
