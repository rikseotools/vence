require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const EMMA = 'emmavallejoteijeira@gmail.com';
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows: u } = await c.query(`SELECT id FROM user_profiles WHERE email=$1`, [EMMA]);
  const uid = u[0].id;

  console.log('=== qué dice el error del cliente (ExamLayout) ===');
  const e = await c.query(`SELECT ts, left(error_message, 220) msg, metadata FROM observable_events
    WHERE user_id=$1 AND event_type='client_error' AND ts > now() - interval '6 hours' ORDER BY ts LIMIT 4`, [uid]);
  e.rows.forEach(x => console.log(`  ${x.ts.toISOString().slice(11,19)} ${x.msg}\n     ${JSON.stringify(x.metadata).slice(0,240)}`));

  console.log('\n=== sus console_error ===');
  const ce = await c.query(`SELECT ts, left(error_message,200) msg FROM observable_events
    WHERE user_id=$1 AND event_type='console_error' AND ts > now() - interval '6 hours' ORDER BY ts LIMIT 4`, [uid]);
  ce.rows.forEach(x => console.log(`  ${x.ts.toISOString().slice(11,19)} ${x.msg}`));

  console.log('\n=== ¿le pasa a más gente? 401 en /api/exam/pending (24h) ===');
  const m = await c.query(`SELECT count(*)::int eventos, count(DISTINCT user_id)::int usuarios
    FROM observable_events WHERE endpoint='/api/exam/pending' AND ts > now() - interval '24 hours'
      AND (metadata->>'http_status')::int = 401`);
  console.log('  ' + JSON.stringify(m.rows[0]));

  const m2 = await c.query(`SELECT count(*)::int eventos, count(DISTINCT user_id)::int usuarios
    FROM observable_events WHERE event_type='client_error' AND ts > now() - interval '24 hours'
      AND (error_message ILIKE '%ExamLayout%' OR metadata::text ILIKE '%ExamLayout%')`);
  console.log('  client_error de ExamLayout 24h: ' + JSON.stringify(m2.rows[0]));

  console.log('\n=== ¿su examen se llegó a corregir? ===');
  const t = await c.query(`SELECT id, test_type, is_completed, total_questions, score, created_at, completed_at
    FROM tests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5`, [uid]);
  t.rows.forEach(x => console.log(`  ${x.created_at.toISOString().slice(5,16)} ${x.test_type} completado=${x.is_completed} ${x.total_questions}preg score=${x.score}`));
  await c.end();
})();
