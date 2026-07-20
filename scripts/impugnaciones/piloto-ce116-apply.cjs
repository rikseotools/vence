#!/usr/bin/env node
// Aplica la reescritura de explicaciones del cluster CE art.116 (lote tráfico >=10 respuestas).
// NO toca correct_option ni primary_article_id. Trazado en AVR con proveedor propio de campaña.
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
const PROVIDER='claude_code_expl_traffic_v1';
const DRY = !process.argv.includes('--apply');

const NUEVAS = JSON.parse(fs.readFileSync(path.join(__dirname,'piloto-ce116-drafts.json'),'utf8'));
NUEVAS['27b39247'] = fs.readFileSync(path.join(__dirname,'ce116-27b39247.md'),'utf8').trim();
NUEVAS['5fae34ce'] = fs.readFileSync(path.join(__dirname,'ce116-5fae34ce.md'),'utf8').trim();

(async()=>{
  const prefixes=Object.keys(NUEVAS);
  const rows=await sql`SELECT id, correct_option, primary_article_id FROM questions
                       WHERE left(id::text,8) = ANY(${prefixes})`;
  if(rows.length!==prefixes.length) throw new Error(`esperaba ${prefixes.length} preguntas, encontré ${rows.length}`);
  console.log(DRY?'— DRY RUN (usa --apply para escribir) —':'— APLICANDO —');
  for(const r of rows){
    const pfx=r.id.slice(0,8), nueva=NUEVAS[pfx];
    if(!/^>|\n>/.test(nueva)) throw new Error(`${pfx}: la nueva explicación no tiene blockquote`);
    if(!/Por qué/.test(nueva)) throw new Error(`${pfx}: falta análisis "Por qué"`);
    console.log(`  ${pfx}  ${nueva.length} chars  clave=${'ABCD'[r.correct_option]} (intacta)`);
    if(DRY) continue;
    await sql.begin(async tx=>{
      await tx`UPDATE questions SET explanation=${nueva}, updated_at=now() WHERE id=${r.id}`;
      await tx`INSERT INTO ai_verification_results
                 (question_id, article_id, ai_provider, ai_model, is_correct,
                  article_ok, answer_ok, explanation_ok, fix_applied, fix_applied_at,
                  new_explanation, review_method_version, verified_at, verified_by, explanation)
               VALUES (${r.id}, ${r.primary_article_id}, ${PROVIDER}, 'claude-opus-4-8', true,
                  true, true, true, true, now(), ${nueva}, 'v2.1', now(), NULL,
                  'Reescritura de formato didáctico (blockquote literal + análisis A/B/C/D). Clave y artículo NO tocados.')
               ON CONFLICT (question_id, ai_provider) DO UPDATE
                 SET new_explanation=EXCLUDED.new_explanation, explanation_ok=true,
                     fix_applied=true, fix_applied_at=now(), verified_at=now()`;
    });
  }
  console.log(DRY?'\n(nada escrito)':'\n✅ aplicado');
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
