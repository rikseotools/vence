const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => { const c=new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const { rows } = await c.query(`
    SELECT t.position_type pt, t.topic_number tn, l.short_name ley,
           coalesce(array_length(ts.article_numbers,1), -1) AS arts_escopados,
           (SELECT count(*) FROM articles a WHERE a.law_id=ts.law_id AND a.article_number ~ '^[0-9]+$') AS arts_ley
      FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id JOIN laws l ON l.id=ts.law_id
     WHERE t.position_type='guardia_civil' AND t.topic_number=9 AND l.short_name='LECrim'`)
  console.table(rows)
  console.log('(-1 = article_numbers NULL, o sea LEY ENTERA)')
  await c.end() })().catch(e=>{console.error(e.message);process.exit(1)})
