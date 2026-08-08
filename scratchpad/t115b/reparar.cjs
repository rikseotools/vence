// Sincroniza el enunciado en BD con el borrador reparado. Solo toca preguntas en `draft`.
const fs=require('fs'); const {Client}=require('pg');
const { PREGUNTAS } = require('./preguntas_cjs.json');
(async()=>{
  const ids=JSON.parse(fs.readFileSync('scratchpad/t115b/gen_lcsp_t115_2026-07-31_inserted_ids.json','utf8'));
  const c=new Client({connectionString:process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''),ssl:{rejectUnauthorized:false}});
  await c.connect();
  let n=0;
  for(let i=0;i<PREGUNTAS.length;i++){
    const r=await c.query('SELECT question_text, lifecycle_state, correct_option FROM questions WHERE id=$1',[ids[i]]);
    const q=r.rows[0];
    if(q.correct_option!==PREGUNTAS[i].correct){ console.error('❌ desajuste de clave en índice',i); process.exit(2) }
    if(q.question_text===PREGUNTAS[i].question_text) continue;
    // reparación POST-aprobación (Paso 9): se tocan campos editables, nunca lifecycle_state
    await c.query('UPDATE questions SET question_text=$1 WHERE id=$2',[PREGUNTAS[i].question_text, ids[i]]);
    console.log('✔ enunciado actualizado Q'+(i+1), ids[i]);
    n++;
  }
  console.log(n+' enunciado(s) reparado(s) en BD');
  await c.end();
})();
