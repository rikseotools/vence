require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const RX = '(Servicio Aragonés de Salud|Servicio Andaluz de Salud|Servicio Murciano de Salud|Servicio Gallego de Salud|Osakidetza|Ibsalut|SESCAM|SACYL|SERMAS|Xunta de Galicia|Generalitat|Junta de Andalucía|Junta de Castilla|Gobierno de Aragón|Gobierno Vasco|Comunidad Foral de Navarra|Gerente del Sector|Consejera de Sanidad)';
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`
    SELECT q.id, l.short_name, q.is_official_exam, q.exam_source,
      (SELECT count(*)::int FROM test_questions tq WHERE tq.question_id=q.id) servida,
      left(regexp_replace(q.question_text,'\\s+',' ','g'),95) txt
    FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE q.is_active AND q.question_text ~* $1
      AND l.short_name ~ '^(Ley 39/2015|Ley 40/2015|RDL 5/2015|Constitución|CE|Ley 19/2013|Ley 9/2017|Ley 50/1997|LO )'
    ORDER BY servida DESC`, [RX]);
  console.log('Colgadas de ley NACIONAL de verdad y con órgano autonómico en el enunciado: ' + rows.length + '\n');
  for (const r of rows) console.log(`  ${r.id.slice(0,8)} | ${r.servida}x | ${r.short_name} | ofic=${r.is_official_exam} | ${r.txt}`);
  await c.end();
})();
