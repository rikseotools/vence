#!/usr/bin/env node
// Vuelca a `ai_verification_results` los veredictos de la campaña "citas ajenas"
// (hallazgos de barrido-citas.cjs, familia AJENA), respetando la trazabilidad del
// manual `docs/maintenance/revisar-preguntas-con-agente.md` (§5.1 + §17):
//   - ai_provider  : propio de campaña. NUNCA 'claude_code': el constraint único es
//                    (question_id, ai_provider) y machacaría la traza previa (§5.1, incidente
//                    Extremadura). De estas preguntas, 121 ya tenían fila 'claude_code'.
//   - ai_model     : qué LLM lo verificó.
//   - review_method_version : con qué criterios (§17.2). Actual: v2.1.
//
// NO modifica `questions`: esto solo registra diagnóstico. Aplicar es otro paso, y solo
// tras la auditoría ciega independiente + adjudicación (§15.1).
//
// Uso:
//   node scripts/impugnaciones/ingesta-verificacion-citas.cjs <dir_json> --provider <p> [--model <m>] [--dry-run]
const fs = require('fs');
const path = require('path');
// postgres.js: deps raíz; backend/node_modules como respaldo (scripts CLI, no corren en CI)
const pg = (() => { try { return require('postgres'); } catch { return require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'postgres')); } })();

const METHOD_VERSION = 'v2.1';
const PROVIDER_PROHIBIDO = 'claude_code';

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > -1 ? process.argv[i + 1] : d;
};

(async () => {
  const dir = process.argv[2];
  const provider = arg('--provider');
  const model = arg('--model', 'claude-sonnet-4-6');
  const dryRun = process.argv.includes('--dry-run');

  if (!dir || !provider) {
    console.error('Uso: ingesta-verificacion-citas.cjs <dir_json> --provider <p> [--model <m>] [--dry-run]');
    process.exit(2);
  }
  if (provider === PROVIDER_PROHIBIDO) {
    console.error(`✋ ai_provider='${PROVIDER_PROHIBIDO}' SOBRESCRIBIRÍA la traza previa (constraint único question_id+ai_provider).`);
    console.error('   Usa un proveedor de campaña, p.ej. claude_code_citas_2026_07 / ..._audit (§5.1, §17.3).');
    process.exit(2);
  }

  const ficheros = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const filas = ficheros.flatMap((f) => {
    const contenido = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return (Array.isArray(contenido) ? contenido : [contenido]).map((r) => ({ ...r, _lote: f }));
  });
  console.log(`Ficheros: ${ficheros.length} → veredictos: ${filas.length}`);

  const porVeredicto = {};
  filas.forEach((r) => { porVeredicto[r.veredicto] = (porVeredicto[r.veredicto] || 0) + 1; });
  console.log('Reparto:', Object.entries(porVeredicto).map(([k, v]) => `${k}=${v}`).join(' | '));

  const sinId = filas.filter((r) => !r.question_id);
  if (sinId.length) { console.error(`✋ ${sinId.length} veredicto(s) sin question_id — abortado.`); process.exit(1); }

  if (dryRun) { console.log('\n--dry-run: no se escribe nada.'); process.exit(0); }

  const sql = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    // Contexto: article_id/law_id son los que la pregunta tiene AHORA (lo verificado), no la sugerencia.
    const ctx = await sql`
      SELECT q.id, q.primary_article_id AS article_id, a.law_id
      FROM questions q LEFT JOIN articles a ON a.id = q.primary_article_id
      WHERE q.id = ANY(${filas.map((r) => r.question_id)})`;
    const porId = Object.fromEntries(ctx.map((r) => [r.id, r]));

    let ok = 0;
    for (const r of filas) {
      const c = porId[r.question_id];
      if (!c) { console.error(`  ⚠️  ${r.question_id} no existe en questions — saltada`); continue; }
      await sql`
        INSERT INTO ai_verification_results (
          question_id, article_id, law_id, article_ok, answer_ok, explanation_ok, options_ok,
          confidence, explanation, article_quote, correct_article_suggestion,
          correct_option_should_be, ai_provider, ai_model, review_method_version, verified_at
        ) VALUES (
          ${r.question_id}, ${c.article_id}, ${c.law_id}, ${r.article_ok ?? null}, ${r.answer_ok ?? null},
          ${r.explanation_ok ?? null}, ${r.options_ok ?? null}, ${r.confidence || 'media'},
          ${`[${r.veredicto}] ${r.explanation || ''}`}, ${r.article_quote || null},
          ${r.correct_article_suggestion_texto || r.correct_article_suggestion_id || null},
          ${r.correct_option_should_be || null}, ${provider}, ${model}, ${METHOD_VERSION}, now()
        )
        ON CONFLICT (question_id, ai_provider) DO UPDATE SET
          article_ok = EXCLUDED.article_ok, answer_ok = EXCLUDED.answer_ok,
          explanation_ok = EXCLUDED.explanation_ok, options_ok = EXCLUDED.options_ok,
          confidence = EXCLUDED.confidence, explanation = EXCLUDED.explanation,
          article_quote = EXCLUDED.article_quote,
          correct_article_suggestion = EXCLUDED.correct_article_suggestion,
          correct_option_should_be = EXCLUDED.correct_option_should_be,
          ai_model = EXCLUDED.ai_model, review_method_version = EXCLUDED.review_method_version,
          verified_at = now()`;
      ok++;
    }
    console.log(`\n✅ Registrados ${ok} veredictos como ai_provider='${provider}', modelo='${model}', método='${METHOD_VERSION}'.`);
    const prev = await sql`
      SELECT ai_provider, count(*)::int n FROM ai_verification_results
      WHERE question_id = ANY(${filas.map((r) => r.question_id)}) GROUP BY ai_provider ORDER BY n DESC`;
    console.log('\nTraza acumulada de estas preguntas (la previa sigue intacta):');
    console.table(prev);
  } finally {
    await sql.end();
  }
})();
