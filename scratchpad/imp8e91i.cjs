require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1 });
(async () => {
  const d = await sql`
    SELECT id, question_id, dispute_type, status, created_at, left(description,150) AS txt
    FROM question_disputes WHERE user_id='75e32f96-358b-4623-91ea-246a3a890d91'
    ORDER BY created_at DESC LIMIT 15`;
  console.log('SUS IMPUGNACIONES:'); d.forEach(x=>console.log(' ', x.created_at.toISOString().slice(0,16), x.status, x.dispute_type, '|', x.txt));
  // ¿otras impugnaciones recientes de usuarios de Valencia sobre "respuesta incorrecta"? posible mismo síntoma
  const otras = await sql`
    SELECT qd.id, qd.created_at, qd.status, qd.dispute_type, up.full_name, up.target_oposicion, left(qd.description,120) AS txt
    FROM question_disputes qd JOIN user_profiles up ON up.id=qd.user_id
    WHERE qd.created_at > '2026-07-29' AND up.target_oposicion='auxiliar_administrativo_valencia'
    ORDER BY qd.created_at DESC`;
  console.log('\nIMPUGNACIONES DE VALENCIA DESDE 29/07:', otras.length);
  otras.forEach(x=>console.log(' ', x.created_at.toISOString().slice(0,16), x.status, x.dispute_type, x.full_name, '|', x.txt));
  await sql.end();
})();
