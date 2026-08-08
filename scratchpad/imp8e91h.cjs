require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1 });
const L = ['A','B','C','D','E'];
(async () => {
  const rows = await sql`
    SELECT id, user_id, test_id, user_answer, correct_answer, option_order
    FROM test_questions WHERE option_order IS NOT NULL AND option_order <> ARRAY[0,1,2,3]`;
  let malClave = 0, malResp = 0; const users = new Set(), tests = new Set();
  for (const r of rows) {
    const o = r.option_order;
    const c = L.indexOf((r.correct_answer||'').toUpperCase());
    const u = L.indexOf((r.user_answer||'').toUpperCase());
    if (c >= 0 && o.indexOf(c) !== c) { malClave++; users.add(r.user_id); tests.add(r.test_id); }
    if (u >= 0 && o.indexOf(u) !== u) malResp++;
  }
  console.log({ filas: rows.length, malClave, malResp, usuarios: users.size, tests: tests.size });
  const t = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%page%' OR table_name ILIKE '%view%')`;
  console.log('tablas candidatas:', t.map(x=>x.table_name));
  await sql.end();
})();
