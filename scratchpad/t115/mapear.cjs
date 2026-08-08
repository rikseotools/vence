// Empareja cada estructura §8.2 con su question_id — pero NO por el orden del fichero de ids:
// se verifica contra el enunciado REAL en BD. Si el orden no casara, aborta.
const fs=require('fs'); const {Client}=require('pg');
const { PREGUNTAS } = require('./preguntas_cjs.json');
(async()=>{
  const ids=JSON.parse(fs.readFileSync('scratchpad/t115/gen_lopdgdd_t115_2026-07-31_inserted_ids.json','utf8'));
  const c=new Client({connectionString:process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''),ssl:{rejectUnauthorized:false}});
  await c.connect();
  fs.mkdirSync('scratchpad/t115/lote',{recursive:true});
  for(let i=0;i<PREGUNTAS.length;i++){
    const id=ids[i];
    const r=await c.query('SELECT question_text, correct_option FROM questions WHERE id=$1',[id]);
    if(!r.rows[0] || r.rows[0].question_text!==PREGUNTAS[i].question_text || r.rows[0].correct_option!==PREGUNTAS[i].correct){
      console.error('❌ desajuste en índice',i,id); process.exit(2);
    }
    const est=JSON.parse(fs.readFileSync(`scratchpad/t115/estructuradas/q${String(i+1).padStart(2,'0')}.json`,'utf8'));
    fs.writeFileSync(`scratchpad/t115/lote/${id}.json`,JSON.stringify(est,null,2));
  }
  console.log('✅ '+PREGUNTAS.length+' estructuras emparejadas y verificadas contra el enunciado en BD');
  await c.end();
})();
