const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  for (const n of ['99','159']) {
    const r = await c.query(`SELECT a.article_number, a.title, a.content FROM articles a
      JOIN laws l ON l.id=a.law_id WHERE l.slug='ley-9-2017' AND a.article_number=$1 AND a.is_active`, [n]);
    if (!r.rows[0]) { console.log(`art ${n}: NO ESTÁ en BD`); continue; }
    console.log('='.repeat(90));
    console.log(`ART ${n} — ${r.rows[0].title}`);
    const t = r.rows[0].content;
    // solo los fragmentos relevantes para la remisión que hace la explicación
    const frag = n === '99'
      ? t.split('\n').filter(l => /fraccion/i.test(l)).join('\n')
      : t.split('\n').filter(l => /^4\.|declaración responsable|c\)/i.test(l)).slice(0, 12).join('\n');
    console.log(frag || '(sin coincidencias — vuelco 800 chars)\n' + t.slice(0, 800));
  }
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
