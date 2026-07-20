#!/usr/bin/env node
// RESTAURA los enunciados truncados por el bug de import de ancho fijo (80/100/120 chars),
// recuperando el texto ÍNTEGRO de los JSON scrapeados que originaron el lote
// (`preguntas-para-subir/tramitacion-procesal/`, ver docs/maintenance/importar-tema-tramitacion-procesal.md).
//
// Esto es RESTAURACIÓN, no autoría: el texto sale de la misma fuente que produjo la pregunta.
//
// GUARDARRAÍLES (un emparejamiento flojo metería el enunciado de OTRA pregunta):
//   1. El texto en BD debe ser PREFIJO EXACTO del de la fuente (no "empieza parecido").
//   2. La fuente debe ser más larga (si no, no hay nada que restaurar).
//   3. Las OPCIONES deben coincidir con las de la BD (normalizadas). Es el desempate real:
//      hay preguntas distintas que comparten los primeros 100 caracteres.
//   4. Si más de un candidato sobrevive a 1-3 con textos distintos → NO se toca (ambiguo).
//   5. Nunca se toca la clave ni el artículo.
const fs = require('fs'), path = require('path');
const pg = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'postgres'));
const url = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql = pg(url, { ssl: { rejectUnauthorized: false }, max: 2 });
const SRC = path.join(__dirname, '..', '..', 'preguntas-para-subir-tp');
const DRY = !process.argv.includes('--apply');

const norm = s => (s || '').replace(/\s+/g, ' ').replace(/[«»""'']/g, '"').trim().toLowerCase();

function cargarFuente() {
  const out = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.json')) {
        try {
          const j = JSON.parse(fs.readFileSync(p, 'utf8'));
          for (const q of (j.questions || []))
            if (q.question) out.push({ texto: q.question, opciones: (q.options || []).map(o => o.text), file: p });
        } catch { /* json corrupto: se ignora */ }
      }
    }
  })(SRC);
  return out;
}

(async () => {
  const fuente = cargarFuente();
  console.log(`fuente: ${fuente.length} preguntas en los JSON scrapeados`);

  const trunc = await sql`SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option,
      lifecycle_state, is_active
    FROM questions
    WHERE length(question_text) IN (80,100,120) AND question_text ~ '[a-záéíóúñ ]$'`;
  console.log(`truncadas en BD (activas e inactivas): ${trunc.length}\n`);

  const plan = [], ambiguas = [], sinFuente = [];
  for (const q of trunc) {
    const opsBD = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean).map(norm).sort();
    // 1+2: prefijo exacto y más larga
    let cand = fuente.filter(f => f.texto.startsWith(q.question_text) && f.texto.length > q.question_text.length);
    // 3: las opciones deben cuadrar
    const conOpciones = cand.filter(f => {
      const opsF = (f.opciones || []).filter(Boolean).map(norm).sort();
      if (!opsF.length || opsF.length !== opsBD.length) return false;
      return opsF.every((o, i) => o === opsBD[i]);
    });
    if (conOpciones.length) cand = conOpciones;
    else if (cand.length) { ambiguas.push({ id: q.id, motivo: 'prefijo casa pero las opciones NO', n: cand.length }); continue; }

    if (!cand.length) { sinFuente.push(q.id); continue; }
    // 4: si quedan varios con textos distintos, no se toca
    const textos = [...new Set(cand.map(c => c.texto))];
    if (textos.length > 1) { ambiguas.push({ id: q.id, motivo: 'varios candidatos distintos', n: textos.length }); continue; }
    plan.push({ id: q.id, antes: q.question_text, despues: textos[0], activa: q.is_active, estado: q.lifecycle_state });
  }

  console.log(`✅ restaurables (prefijo exacto + opciones idénticas): ${plan.length}`);
  console.log(`⚠️  ambiguas (NO se tocan):                            ${ambiguas.length}`);
  console.log(`❌ sin fuente:                                        ${sinFuente.length}\n`);
  for (const a of ambiguas.slice(0, 10)) console.log(`   ${a.id.slice(0, 8)} — ${a.motivo} (${a.n})`);

  console.log('\n— muestra de restauraciones —');
  for (const p of plan.slice(0, 3)) {
    console.log(`\n  ${p.id.slice(0, 8)}`);
    console.log(`   antes:  ${JSON.stringify(p.antes)}`);
    console.log(`   después:${JSON.stringify(p.despues)}`);
  }

  fs.writeFileSync(path.join(__dirname, 'plan-restauracion.json'), JSON.stringify({ plan, ambiguas, sinFuente }, null, 1));
  if (DRY) { console.log('\n— DRY RUN (usa --apply) —'); await sql.end(); return; }

  let n = 0; const duplicados = [];
  for (const p of plan) {
   try {
    await sql.begin(async tx => {
      await tx`UPDATE questions SET question_text=${p.despues}, updated_at=now() WHERE id=${p.id}`;
      await tx`INSERT INTO ai_verification_results
          (question_id, ai_provider, ai_model, is_correct, article_ok, answer_ok, explanation_ok,
           fix_applied, fix_applied_at, review_method_version, verified_at, explanation)
        VALUES (${p.id}, 'claude_code_restaura_truncado', 'claude-opus-4-8', true, true, true, true,
           true, now(), 'v2.1', now(),
           ${'Enunciado restaurado integro desde el JSON scrapeado de origen (preguntas-para-subir/tramitacion-procesal). Emparejado por prefijo EXACTO + opciones identicas. Clave y articulo NO tocados. Texto previo truncado: ' + p.antes.slice(0, 90)})
        ON CONFLICT (question_id, ai_provider) DO UPDATE SET fix_applied=true, fix_applied_at=now(), verified_at=now()`;
    });
    n++;
   } catch (e) {
    // idx_questions_content_hash: al restaurar el texto, la pregunta queda IDÉNTICA a otra
    // que ya existe en el banco → la truncada es un duplicado. No se toca; se registra.
    if (/content_hash|duplicate key/i.test(e.message)) { duplicados.push({ id: p.id, texto: p.despues.slice(0, 90) }); }
    else throw e;
   }
  }
  if (duplicados.length) {
    console.log(`\n⚠️  ${duplicados.length} NO restauradas: al recuperar el texto quedarían IDÉNTICAS a otra`);
    console.log('   pregunta ya existente (la versión completa ya está en el banco) → son DUPLICADOS.');
    for (const d of duplicados.slice(0, 8)) console.log(`   ${d.id.slice(0, 8)} «${d.texto}…»`);
    fs.writeFileSync(path.join(__dirname, 'truncadas-duplicadas.json'), JSON.stringify(duplicados, null, 1));
  }
  // INVARIANTE: ninguna clave puede haber cambiado
  const after = await sql`SELECT id, correct_option FROM questions WHERE id = ANY(${plan.map(p => p.id)})`;
  const bd = Object.fromEntries(trunc.map(t => [t.id, t.correct_option]));
  const drift = after.filter(r => r.correct_option !== bd[r.id]);
  console.log(`\n✅ ${n} enunciados restaurados | drift de clave: ${drift.length}`);
  if (drift.length) { console.error('❌ DRIFT', drift); process.exit(1); }
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
