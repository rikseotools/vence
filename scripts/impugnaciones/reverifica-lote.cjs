#!/usr/bin/env node
// RE-VERIFICACIÓN sobre la pregunta VIVA (lee de BD, no del JSON del agente).
// Comprueba de forma independiente lo que se sirve ahora al usuario.
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
const PROVIDER='claude_code_expl_traffic_v1';
(async()=>{
  const rows=await sql`
    SELECT q.id, q.correct_option, q.explanation, q.option_a,q.option_b,q.option_c,q.option_d,
           a.content art, a.article_number n, l.short_name ley
    FROM questions q JOIN ai_verification_results r ON r.question_id=q.id AND r.ai_provider=${PROVIDER}
    LEFT JOIN articles a ON a.id=q.primary_article_id LEFT JOIN laws l ON l.id=a.law_id`;
  console.log('preguntas vivas con la reescritura:', rows.length);
  const bad=[];
  for(const q of rows){
    const e=q.explanation||'', L='ABCD'[q.correct_option];
    const p=[];
    if(!/(^|\n)>/.test(e)) p.push('sin blockquote');
    if(!/Por qué/.test(e)) p.push('sin análisis');
    // la explicación debe defender la clave REAL de la BD, no otra letra
    const m=e.match(/Por qué ([A-D]) es correcta/);
    if(m && m[1]!==L) p.push(`defiende ${m[1]} pero la clave es ${L}`);
    if(!/[áéíóúñ]/.test(e)) p.push('sin tildes (cita no literal)');
    if(e.length<400) p.push('demasiado corta');
    // OJO: 'TODO' debe ir case-SENSITIVE y con \b — con /i casaba con la palabra española
    // «todo» («en todo caso», «todos los…») y marcaba 34 explicaciones buenas como sucias.
    if(/\.\.\.\s*$/.test(e) || /placeholder|\bTODO\b/.test(e)) p.push('resto de plantilla');
    if(p.length) bad.push({id:q.id.slice(0,8), ley:q.ley, art:q.n, problemas:p.join('; ')});
  }
  console.log(`limpias: ${rows.length-bad.length} | sucias: ${bad.length}`);
  if(bad.length) console.table(bad);
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
