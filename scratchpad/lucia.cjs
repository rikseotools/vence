require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const r = await c.query(`SELECT d.id, d.status, d.dispute_type, d.description, d.admin_response, d.resolved_at, d.question_id
    FROM question_disputes d WHERE d.user_id=(SELECT user_id FROM question_disputes WHERE id='e1b2b9e4-1367-4690-9da8-c8c6ee16e574')
    ORDER BY d.created_at`);
  for (const x of r.rows) {
    console.log('\n═══', x.id.slice(0,8), '|', x.status, '|', x.resolved_at ? new Date(x.resolved_at).toISOString() : '—');
    console.log('QUEJA:', (x.description||'').replace(/\s+/g,' ').slice(0,300));
    console.log('RESPUESTA:', (x.admin_response||'(sin responder)').replace(/\s+/g,' ').slice(0,900));
  }
  await c.end();
})();
