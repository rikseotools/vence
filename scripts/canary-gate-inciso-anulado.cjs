#!/usr/bin/env node
// CANARIO del gate de incisos anulados (T-048 capa 3). Comprueba contra RDS que la promoción a
// visible se BLOQUEA cuando la clave reproduce un inciso que el TC anuló, y que NO se bloquea una
// clave legítima del mismo artículo. Todo en transacciones que se revierten: no altera nada.
//
//   node scripts/canary-gate-inciso-anulado.cjs
const fs=require('fs');
const path=require('path');
const pg=require(path.join(__dirname,'..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:1});
const FRAG='Asimismo, toda devolución acordada en aplicación del párrafo b) del mismo apartado de este artículo llevará consigo la prohibición de entrada en territorio español por un plazo máximo de tres años.';
const BUENA='La devolución acordada en el párrafo a) del apartado 2 conllevará la reiniciación del cómputo del plazo de prohibición de entrada.';
// Cada caso en SU PROPIA transacción: un RAISE aborta la transacción entera y los
// comandos siguientes se ignoran (eso me dio un falso "bloqueó una buena" en el 1er intento).
async function caso(nombre, clave, esperaBloqueo){
  let bloqueado=false, err='';
  try {
    await sql.begin(async tx => {
      const art=(await tx`SELECT a.id FROM articles a JOIN laws l ON l.id=a.law_id
        WHERE l.boe_url LIKE '%BOE-A-2000-544%' AND a.article_number='58'`)[0].id;
      const id=(await tx`INSERT INTO questions (question_text, option_a, option_b, option_c, option_d,
          correct_option, primary_article_id, lifecycle_state, difficulty, question_type, explanation)
        VALUES ('CANARIO T-048 (se revierte)','Otra A',${clave},'Otra C','Otra D',1,${art},'draft','medium','single','canario')
        RETURNING id`)[0].id;
      try { await tx`SELECT public.transition_question_state(${id}::uuid,'draft','approved','admin_marked_perfect',NULL,NULL,'canario')`; }
      catch(e){ bloqueado=true; err=e.message; throw new Error('ROLLBACK'); }
      throw new Error('ROLLBACK');
    });
  } catch(e){ if(e.message!=='ROLLBACK') throw e; }
  const ok = bloqueado===esperaBloqueo;
  console.log(`${ok?'✅':'❌'} ${nombre} → bloqueado=${bloqueado} (esperado ${esperaBloqueo})`);
  if(bloqueado && esperaBloqueo) console.log('   motivo:', err.split('—')[1]?.trim().slice(0,80));
}
(async()=>{
  await caso('clave = inciso anulado por el TC', FRAG, true);
  await caso('clave legítima del MISMO artículo', BUENA, false);
  const q=await sql`SELECT count(*)::int n FROM questions WHERE question_text='CANARIO T-048 (se revierte)'`;
  console.log('\ncanarios que quedan en BD:', q[0].n, q[0].n===0?'✅ nada tocado':'❌');
  await sql.end();
})();
