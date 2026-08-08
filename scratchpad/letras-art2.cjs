require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const LETRAS = {
  a:'Fortalecer las medidas de sensibilización', b:'Consagrar derechos de las mujeres', c:'Reforzar hasta la consecución',
  d:'Garantizar derechos en el ámbito laboral', e:'Garantizar derechos económicos', f:'Establecer un sistema integral de tutela',
  g:'Fortalecer el marco penal', h:'Coordinar los recursos e instrumentos', i:'Promover la colaboración y participación',
  j:'Fomentar la especialización', k:'Garantizar el principio de transversalidad' };
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`SELECT q.id, q.explanation, (SELECT count(*)::int FROM test_questions t WHERE t.question_id=q.id) servida
    FROM questions q WHERE q.is_active AND q.primary_article_id=(SELECT primary_article_id FROM questions WHERE id='fae0370f-1d0a-48f4-ba7f-06b6b05bb069')
      AND q.explanation IS NOT NULL`);
  console.log('hermanas con explicación: ' + rows.length + '\n');
  let malas = 0;
  for (const r of rows) {
    const txt = r.explanation.replace(/\s+/g,' ');
    const re = /(?:art(?:ículo)?\.?\s*2\.?|letra\s*)([a-k])\)/gi;
    let m; const citas = new Set();
    while ((m = re.exec(txt)) !== null) citas.add(m[1].toLowerCase());
    if (!citas.size) continue;
    for (const L of citas) {
      // ¿aparece cerca de esa cita el arranque real de esa letra?
      const ok = txt.toLowerCase().includes(LETRAS[L].toLowerCase().slice(0, 28));
      if (!ok) { malas++; console.log(`  ${r.id.slice(0,8)} | ${r.servida}x | cita la letra ${L}) y NO aparece su texto («${LETRAS[L].slice(0,40)}…»)`); }
    }
  }
  console.log('\nsospechosas: ' + malas);
  await c.end();
})();
