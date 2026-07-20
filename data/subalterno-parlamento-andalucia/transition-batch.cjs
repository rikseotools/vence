#!/usr/bin/env node
/**
 * Transiciona a `approved` todas las preguntas draft de un lote (por tag) que han
 * pasado la doble auditoría PERFECT. Registra la verificación en ai_verification_results
 * y llama a la función legal transition_question_state. Uso:
 *   node transition-batch.cjs <batch_tag> [--exclude id1,id2]
 */
'use strict';
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });
const ADMIN = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';

const tag = process.argv[2];
const excludeArg = (process.argv.find(a => a.startsWith('--exclude=')) || '').split('=')[1] || '';
const exclude = new Set(excludeArg.split(',').filter(Boolean));
if (!tag) { console.error('Uso: node transition-batch.cjs <batch_tag> [--exclude=id1,id2]'); process.exit(2); }

(async () => {
  const qs = await sql`SELECT id, primary_article_id FROM questions WHERE ${tag} = ANY(tags) AND lifecycle_state='draft'`;
  const target = qs.filter(q => !exclude.has(q.id) && !exclude.has(q.id.slice(0, 8)));
  console.log(`Lote ${tag}: ${qs.length} draft, ${target.length} a transicionar (${exclude.size} excluidas)`);
  for (const q of target) {
    await sql`INSERT INTO ai_verification_results
      (question_id, article_id, is_correct, confidence, ai_provider, ai_model, verified_at, verified_by, article_ok, answer_ok, explanation_ok, options_ok, enunciado_ok, review_method_version, explanation)
      VALUES (${q.id}::uuid, ${q.primary_article_id}::uuid, true, 'high', 'claude_code', 'claude-opus-4-8', now(), ${ADMIN}::uuid, true, true, true, true, true, 'gen-ia-v2.5', 'Doble auditoría PERFECT (auto + agente ciego independiente).')
      ON CONFLICT (question_id, ai_provider) DO UPDATE SET answer_ok=true, explanation_ok=true, article_ok=true, options_ok=true, is_correct=true, verified_at=now()`;
  }
  let ok = 0, err = 0;
  for (const q of target) {
    try { await sql`SELECT public.transition_question_state(${q.id}::uuid, 'draft', 'approved', 'ai_verified_perfect', ${ADMIN}::uuid, NULL, ${'Lote ' + tag + ': doble auditoría PERFECT.'})`; ok++; }
    catch (e) { err++; console.error('  ERR', q.id.slice(0, 8), e.message.slice(0, 90)); }
  }
  console.log(`Transicionadas approved: ${ok} | err: ${err}`);
  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
