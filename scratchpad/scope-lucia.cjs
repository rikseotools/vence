require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const PT='auxiliar_administrativo_universidad_carlos_iii';
  const r = await c.query(`SELECT ts.topic_id, t.topic_number, t.title, t.epigrafe, l.short_name, ts.article_numbers
    FROM topic_scope ts JOIN topics t ON t.id=ts.topic_id JOIN laws l ON l.id=ts.law_id
    WHERE t.position_type=$1 AND l.short_name ILIKE '%3/2018%'`, [PT]);
  for (const x of r.rows) {
    console.log('Tema', x.topic_number, '|', x.title);
    console.log('  EPÍGRAFE:', (x.epigrafe||'(vacío)').replace(/\s+/g,' '));
    console.log('  LEY:', x.short_name);
    console.log('  ARTÍCULOS EN SCOPE:', JSON.stringify(x.article_numbers));
    console.log('  ¿incluye el 17?', (x.article_numbers||[]).includes('17') ? 'SÍ' : 'NO');
  }
  await c.end();
})();
