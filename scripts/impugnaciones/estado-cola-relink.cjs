#!/usr/bin/env node
// READ-ONLY: dimensiona las 2 colas de la tarea 3 del backlog (relink needs_human + explicaciones flojas).
const fs = require('fs'); const path = require('path');
const pg = (() => { try { return require('postgres'); } catch { return require(path.join(__dirname,'..','..','backend','node_modules','postgres')); } })();
const url = process.env.DATABASE_URL || fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql = pg(url, { ssl: { rejectUnauthorized: false }, max: 2 });
(async () => {
  console.log('=== A) needs_human por proveedor de AVR ===');
  console.table(await sql`
    SELECT r.ai_provider, count(DISTINCT q.id)::int AS preguntas,
           count(DISTINCT q.id) FILTER (WHERE r.correct_article_suggestion IS NOT NULL)::int AS con_sugerencia
    FROM questions q JOIN ai_verification_results r ON r.question_id = q.id
    WHERE q.lifecycle_state = 'needs_human'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 25`);

  console.log('\n=== A2) TOTAL needs_human en el banco ===');
  console.table(await sql`SELECT count(*)::int AS total_needs_human FROM questions WHERE lifecycle_state='needs_human'`);

  console.log('\n=== B) explicaciones flojas (explanation_ok=false, resto no-falso) ===');
  console.table(await sql`
    SELECT count(DISTINCT r.question_id)::int AS total,
           count(DISTINCT r.question_id) FILTER (WHERE q.is_active)::int AS visibles_al_usuario
    FROM ai_verification_results r JOIN questions q ON q.id = r.question_id
    WHERE r.explanation_ok = false AND r.article_ok IS DISTINCT FROM false AND r.answer_ok IS DISTINCT FROM false`);

  console.log('\n=== B2) explicaciones flojas por proveedor ===');
  console.table(await sql`
    SELECT r.ai_provider, count(DISTINCT r.question_id)::int AS n
    FROM ai_verification_results r JOIN questions q ON q.id = r.question_id
    WHERE r.explanation_ok = false AND r.article_ok IS DISTINCT FROM false AND r.answer_ok IS DISTINCT FROM false
      AND q.is_active GROUP BY 1 ORDER BY 2 DESC LIMIT 15`);
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
