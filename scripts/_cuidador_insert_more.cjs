// Round-2: inserta MÁS preguntas draft contra los artículos YA existentes de una ley virtual.
// Uso: node scripts/_cuidador_insert_more.cjs <slug> <tag> <json_questions_path>
// json: { questions:[{art,q,options[4],correct,explanation}] }  (art = article_number existente)
// NO crea ley/artículos/scope (ya existen). Dedup por question_text contra lo que haya.
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');
const L = ['A', 'B', 'C', 'D'];
const [SLUG, TAG, jsonPath] = process.argv.slice(2);
if (!SLUG || !TAG || !jsonPath) { console.error('args: <slug> <tag> <json>'); process.exit(2); }
const D = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

(async () => {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query("DELETE FROM questions WHERE tags @> ARRAY['ia_generada',$1]::text[] AND lifecycle_state='draft'".replace('$1', "'" + TAG + "'"));
    const law = (await c.query('SELECT id FROM laws WHERE slug=$1', [SLUG])).rows[0];
    if (!law) throw new Error('ley no existe: ' + SLUG);
    const arts = (await c.query('SELECT id, article_number FROM articles WHERE law_id=$1', [law.id])).rows;
    const artId = {}; arts.forEach(a => artId[String(a.article_number)] = a.id);
    // enunciados ya existentes (para dedup)
    const existing = new Set((await c.query('SELECT question_text FROM questions WHERE primary_article_id = ANY($1)', [arts.map(a => a.id)])).rows.map(r => r.question_text.trim()));
    // rebalanceo determinista: reparte la posición correcta en round-robin (anti "siempre la B"),
    // salvo que la explicación cite letras de opción (romperia la referencia) → se deja intacta.
    const refsLetter = (t) => /opci[oó]n\s+[ABCD]\b|\b[ABCD]\)/.test(t || '');
    let rr = 0;
    const rebalance = (q) => {
      if (refsLetter(q.explanation)) return q;
      const target = rr++ % 4;
      const co = Number(q.correct);
      if (co === target) return q;
      const opts = q.options.slice();
      [opts[co], opts[target]] = [opts[target], opts[co]];
      return { ...q, options: opts, correct: target };
    };
    const dist = [0, 0, 0, 0]; let ins = 0, dup = 0, bad = 0;
    for (let q of D.questions) {
      const aId = artId[String(q.art)];
      if (!aId) { bad++; continue; }
      if (!Array.isArray(q.options) || q.options.length !== 4) { bad++; continue; }
      if (existing.has(q.q.trim())) { dup++; continue; }
      q = rebalance(q);
      const co = Number(q.correct); dist[co]++;
      const expl = '**Por qué ' + L[co] + ' es correcta:** ' + q.explanation;
      await c.query(
        `INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, question_type, primary_article_id, tags, lifecycle_state, deactivation_reason, topic_review_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'medium','single',$8,$9,'draft','Pendiente de revisión post-generación IA','pending')`,
        [q.q, q.options[0], q.options[1], q.options[2], q.options[3], co, expl, aId, ['ia_generada', TAG]]);
      ins++;
    }
    await c.query('COMMIT');
    console.log(SLUG, '→ insertadas', ins, '| dup evitadas', dup, '| inválidas', bad, '| dist', dist.map((n, i) => L[i] + ':' + n).join(' '));
  } catch (e) { await c.query('ROLLBACK'); console.error('❌', e.message); process.exitCode = 1; }
  finally { await c.end(); }
})();
