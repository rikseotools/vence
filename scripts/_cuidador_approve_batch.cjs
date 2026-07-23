// Aprueba (draft→approved) las preguntas de un batch tras auditoría.
// Uso: node scripts/_cuidador_approve_batch.cjs <tag> <tema_number> [exclude_texts_json]
// exclude_texts_json (opcional): ruta a JSON array de substrings de question_text a NO aprobar (dejar draft).
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');
const [TAG, temaN, excludePath] = process.argv.slice(2);
if (!TAG || !temaN) { console.error('args: <tag> <tema> [exclude.json]'); process.exit(2); }
const excludes = excludePath && fs.existsSync(excludePath) ? JSON.parse(fs.readFileSync(excludePath, 'utf8')) : [];
const PT = 'cuidador_diputacion_cordoba';

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const rows = (await c.query(
    "SELECT id, lifecycle_state, question_text FROM questions WHERE tags @> ARRAY['ia_generada',$1]::text[]".replace('$1', "'" + TAG + "'"))).rows;
  let approved = 0, skipped = 0, already = 0;
  for (const q of rows) {
    if (excludes.some(s => q.question_text.includes(s))) { skipped++; continue; }
    if (q.lifecycle_state === 'approved') { already++; continue; }
    if (q.lifecycle_state !== 'draft') { skipped++; continue; }
    await c.query('SELECT transition_question_state($1,$2,$3,$4,NULL,NULL,$5)',
      [q.id, 'draft', 'approved', 'ai_verified_perfect', 'Auditoría independiente ciega OK (build Cuidador Dip. Córdoba)']);
    approved++;
  }
  // activar tema + refrescar MV
  await c.query('UPDATE topics SET disponible=true WHERE position_type=$1 AND topic_number=$2', [PT, Number(temaN)]);
  await c.query('SELECT public.refresh_topic_question_summary()');
  const act = (await c.query(
    "SELECT count(*)::int n FROM questions WHERE tags @> ARRAY['ia_generada',$1]::text[] AND is_active".replace('$1', "'" + TAG + "'"))).rows[0].n;
  console.log('T' + temaN + ' →', 'approved:', approved, '| ya approved:', already, '| excluidas(draft):', skipped, '| activas ahora:', act);
  await c.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
