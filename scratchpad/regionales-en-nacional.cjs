require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const RX = '(Servicio Aragonés de Salud|Servicio Andaluz de Salud|Servicio Murciano de Salud|Servicio Gallego de Salud|Osakidetza|Ibsalut|SESCAM|SACYL|SERMAS|Xunta de Galicia|Generalitat|Junta de Andalucía|Junta de Castilla|Gobierno de Aragón|Gobierno Vasco|Comunidad Foral de Navarra|Gerente del Sector)';
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const tot = await c.query(`SELECT count(*)::int n FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE q.is_active AND coalesce(l.scope,'national')='national' AND q.question_text ~* $1`, [RX]);
  console.log('Activas colgadas de ley NACIONAL que nombran un órgano autonómico concreto: ' + tot.rows[0].n);
  const { rows } = await c.query(`SELECT q.id, l.short_name, q.exam_source, q.is_official_exam,
      (SELECT count(*)::int FROM test_questions tq WHERE tq.question_id=q.id) servida,
      left(regexp_replace(q.question_text,'\\s+',' ','g'),100) txt
    FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE q.is_active AND coalesce(l.scope,'national')='national' AND q.question_text ~* $1
    ORDER BY servida DESC LIMIT 20`, [RX]);
  for (const r of rows) console.log(`  ${r.id.slice(0,8)} | servida ${r.servida}x | ${r.short_name} | ofic=${r.is_official_exam} | ${r.exam_source||'-'} | ${r.txt}`);
  await c.end();
})();
