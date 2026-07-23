// Inserta un tema editorial generado: ley virtual + artículos + scope + preguntas DRAFT.
// Uso: node scripts/_cuidador_insert_tema.cjs <tema_number> <json_path> <batch_tag> <law_slug>
// El JSON: { law_name, articles:[{num,title,content}], questions:[{art,q,options[4],correct,explanation}] }
// NO aprueba (deja draft). La aprobación va tras la auditoría (script aparte).
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');
const L = ['A', 'B', 'C', 'D'];
const PT = 'cuidador_diputacion_cordoba';

const [temaN, jsonPath, TAG, SLUG] = process.argv.slice(2);
if (!temaN || !jsonPath || !TAG || !SLUG) { console.error('args: <tema> <json> <tag> <slug>'); process.exit(2); }
const D = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

function buildExplanation(qq) {
  const co = qq.correct;
  let e = `**Por qué ${L[co]} es correcta:** ${qq.explanation}`;
  return e;
}

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    // idempotencia: borrar preguntas draft previas de este batch
    await c.query("DELETE FROM questions WHERE tags @> ARRAY['ia_generada',$1]::text[] AND lifecycle_state='draft'".replace('$1', "'" + TAG + "'"));

    // ley virtual
    let lawId;
    const ex = await c.query('SELECT id FROM laws WHERE slug=$1', [SLUG]);
    if (ex.rowCount) lawId = ex.rows[0].id;
    else lawId = (await c.query(
      `INSERT INTO laws (name, short_name, type, slug, is_virtual, scope, is_active, verification_status, description)
       VALUES ($1,$2,'regulation',$3,true,'national',true,'no_monitoreable',$4) RETURNING id`,
      [D.law_name, D.law_name.slice(0, 60), SLUG, 'Contenido editorial verificado contra fuentes oficiales para el temario de Cuidador/a (Diputación de Córdoba). Batch ' + TAG + '.'])).rows[0].id;

    // artículos (upsert por num)
    const artId = {};
    for (const a of D.articles) {
      const has = await c.query('SELECT id FROM articles WHERE law_id=$1 AND article_number=$2', [lawId, String(a.num)]);
      artId[String(a.num)] = has.rowCount ? has.rows[0].id : (await c.query(
        'INSERT INTO articles (law_id, article_number, title, content, is_active) VALUES ($1,$2,$3,$4,true) RETURNING id',
        [lawId, String(a.num), a.title, a.content])).rows[0].id;
      // refrescar content si ya existía
      if (has.rowCount) await c.query('UPDATE articles SET title=$2, content=$3, is_active=true WHERE id=$1', [artId[String(a.num)], a.title, a.content]);
    }

    // preguntas draft
    const dist = [0, 0, 0, 0];
    let inserted = 0;
    for (const q of D.questions) {
      const aId = artId[String(q.art)];
      if (!aId) { console.error('  ⚠ pregunta sin artículo', q.art); continue; }
      if (!Array.isArray(q.options) || q.options.length !== 4) { console.error('  ⚠ opciones != 4'); continue; }
      const co = Number(q.correct);
      dist[co]++;
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, question_type, primary_article_id, tags, lifecycle_state, deactivation_reason, topic_review_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium','single',$8,$9,'draft','Pendiente de revisión post-generación IA','pending')`,
        [q.q, q.options[0], q.options[1], q.options[2], q.options[3], co, buildExplanation(q), aId, ['ia_generada', TAG]]);
      inserted++;
    }

    // scope del tema
    const tp = await c.query('SELECT id FROM topics WHERE position_type=$1 AND topic_number=$2', [PT, Number(temaN)]);
    const topicId = tp.rows[0].id;
    const inScope = await c.query('SELECT 1 FROM topic_scope WHERE topic_id=$1 AND law_id=$2', [topicId, lawId]);
    if (!inScope.rowCount) await c.query('INSERT INTO topic_scope (topic_id, law_id, article_numbers) VALUES ($1,$2,NULL)', [topicId, lawId]);

    await c.query('COMMIT');
    console.log('✅ T' + temaN + ' — ley virtual + ' + D.articles.length + ' arts + ' + inserted + ' preguntas DRAFT + escopada. Distribución:', dist.map((n, i) => L[i] + ':' + n).join(' '));
    console.log('   lawId=' + lawId);
  } catch (e) { await c.query('ROLLBACK'); console.error('❌', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
