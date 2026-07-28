#!/usr/bin/env node
/**
 * registrar-verificacion.cjs — deja la traza de la campaña «explicaciones apelotonadas» en
 * `ai_verification_results`, con un `ai_provider` PROPIO (manual §5.1).
 *
 * Por qué un provider propio y no `claude_code`: la constraint única es (question_id,
 * ai_provider), así que reutilizar el de siempre no añade una fila — SOBRESCRIBE la anterior y
 * borra el historial de la pregunta. Cada campaña necesita el suyo para que se vea que la
 * pregunta pasó N controles, no solo el último.
 *
 * Entrada: un JSON `{ "<question_id>": { article_ok, answer_ok, options_ok, confidence, nota } }`.
 * `explanation_ok` se registra a true porque esta campaña REESCRIBE la explicación: la fila
 * describe el estado en que queda la pregunta, y el texto aplicado se guarda en `new_explanation`.
 *
 * Uso: node scripts/apelotonadas/registrar-verificacion.cjs <veredictos.json> [--apply]
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const PROVIDER = 'claude_code_apelotonadas_2026_07';
const MODELO = 'claude-opus-5';
const METODO = 'v2.1-apelotonadas';

const getUrl = () => process.env.DATABASE_URL
  || fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();

async function main() {
  const fichero = process.argv[2];
  const APPLY = process.argv.includes('--apply');
  if (!fichero) { console.error('Uso: registrar-verificacion.cjs <veredictos.json> [--apply]'); process.exit(2); }
  const veredictos = JSON.parse(fs.readFileSync(fichero, 'utf8'));
  const postgres = require(path.join(RAIZ, 'node_modules', 'postgres'));
  const sql = postgres(getUrl(), { ssl: { rejectUnauthorized: false }, max: 2 });

  let n = 0;
  for (const [qid, v] of Object.entries(veredictos)) {
    const [q] = await sql`
      SELECT q.id, q.primary_article_id, q.explanation, a.law_id
        FROM questions q LEFT JOIN articles a ON a.id = q.primary_article_id
       WHERE q.id = ${qid}::uuid`;
    if (!q) { console.error(`· ${qid}: no existe`); continue; }
    if (!APPLY) { console.log(`· ${qid} → ${v.confidence ?? 'alta'} · ${v.nota ?? ''}`); n++; continue; }
    await sql`
      INSERT INTO ai_verification_results
        (id, question_id, article_id, law_id, article_ok, answer_ok, explanation_ok, options_ok,
         confidence, explanation, new_explanation, fix_applied, fix_applied_at,
         ai_provider, ai_model, review_method_version, verified_at)
      VALUES
        (gen_random_uuid(), ${qid}::uuid, ${q.primary_article_id}, ${q.law_id},
         ${v.article_ok ?? true}, ${v.answer_ok ?? true}, true, ${v.options_ok ?? true},
         ${v.confidence ?? 'alta'}, ${v.nota ?? null}, ${q.explanation}, true, NOW(),
         ${PROVIDER}, ${MODELO}, ${METODO}, NOW())
      ON CONFLICT (question_id, ai_provider) DO UPDATE SET
         article_ok = EXCLUDED.article_ok, answer_ok = EXCLUDED.answer_ok,
         explanation_ok = EXCLUDED.explanation_ok, options_ok = EXCLUDED.options_ok,
         confidence = EXCLUDED.confidence, explanation = EXCLUDED.explanation,
         new_explanation = EXCLUDED.new_explanation, fix_applied = true,
         fix_applied_at = NOW(), verified_at = NOW()`;
    n++;
  }
  console.log(`\n${n} verificacion(es) ${APPLY ? 'registradas' : 'listadas (dry-run)'} con ai_provider='${PROVIDER}'.`);
  await sql.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
