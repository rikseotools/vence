require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
// qué materia vive en cada apartado del art. 6 Ley 50/1997
const AP = { '1':'creación, modificación y supresión', '2':'real decreto de creación deberá especificar', '3':'podrán ser convocados', '4':'corresponde a las comisiones delegadas', '5':'deliberaciones' };
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT q.id, q.explanation, (SELECT count(*)::int FROM test_questions t WHERE t.question_id=q.id) servida
    FROM questions q WHERE q.is_active AND q.explanation IS NOT NULL
      AND q.primary_article_id=(SELECT primary_article_id FROM questions WHERE id=(SELECT question_id FROM question_disputes WHERE id='c7ade8a3-1c85-4e84-a870-f9b6d0e78e88'))`);
  console.log('hermanas con explicación: ' + rows.length);
  for (const r of rows) {
    const txt = r.explanation.replace(/\s+/g,' ');
    const re = /art(?:ículo)?\.?\s*6\.(\d)/gi; let m;
    const vistos = new Set();
    while ((m = re.exec(txt)) !== null) vistos.add(m[1]);
    for (const ap of vistos) {
      const materia = AP[ap];
      const ok = materia && txt.toLowerCase().includes(materia.slice(0, 18));
      if (!ok) console.log(`  ⚠️ ${r.id.slice(0,8)} | ${r.servida}x | cita 6.${ap} (que trata de «${materia||'?'}») y su texto no habla de eso`);
    }
  }
  // ¿alguien más dice "secretas" citando un apartado que no es el 5?
  const { rows: sec } = await c.query(`SELECT q.id, substring(regexp_replace(q.explanation,'\\s+',' ','g') from '.{0,80}secretas.{0,60}') frag,
     (SELECT count(*)::int FROM test_questions t WHERE t.question_id=q.id) servida
    FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
    WHERE q.is_active AND l.short_name='Ley 50/1997' AND q.explanation ~* 'secretas' AND q.explanation ~* '6\\.[1-4]'`);
  console.log('\nOtras de la Ley 50/1997 que hablan de deliberaciones secretas citando 6.1-6.4: ' + sec.length);
  for (const s of sec) console.log('   ' + s.id.slice(0,8) + ' | ' + s.servida + 'x | …' + (s.frag||'').trim() + '…');
  await c.end();
})();
