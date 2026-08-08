require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1 });
const L = ['A','B','C','D','E'];
(async () => {
  const rows = await sql`
    SELECT id, user_id, test_id, created_at, user_answer, correct_answer, option_order
    FROM test_questions
    WHERE option_order IS NOT NULL AND option_order <> ARRAY[0,1,2,3]`;
  let malClave = 0, malRespuesta = 0;
  const usersMal = new Set(), testsMal = new Set();
  for (const r of rows) {
    const o = r.option_order;
    const c = L.indexOf((r.correct_answer||'').toUpperCase());
    const u = L.indexOf((r.user_answer||'').toUpperCase());
    if (c >= 0 && o.indexOf(c) !== c) { malClave++; usersMal.add(r.user_id); testsMal.add(r.test_id); }
    if (u >= 0 && o.indexOf(u) !== u) malRespuesta++;
  }
  console.log('filas barajadas:', rows.length);
  console.log('clave se pinta en la opción EQUIVOCADA al repasar:', malClave, `(${Math.round(100*malClave/rows.length)}%)`);
  console.log('la respuesta del usuario se pinta en otra opción:', malRespuesta);
  console.log('usuarios afectados:', usersMal.size, '| tests afectados:', testsMal.size);
  // vistas de repaso
  const vistas = await sql`
    SELECT count(*)::int AS n, count(DISTINCT user_id)::int AS users
    FROM page_views
    WHERE page_url LIKE '/revisar/%' AND created_at > '2026-07-29'`;
  console.log('page_views /revisar desde 29/07:', vistas);
  await sql.end();
})();
