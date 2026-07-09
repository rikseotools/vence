// Scrapea el banco de estudio RANDOM de IIPP (whole-opo, las preguntas se autoclasifican por tema)
// hasta saturación. Guarda en preguntas-para-subir/instituciones-penitenciarias/estudio-random/
const fs=require('fs'),path=require('path');
const jwt=fs.readFileSync('scripts/jwt-token.txt','utf8').trim();
const H={Authorization:'Bearer '+jwt,'Content-Type':'application/json'};
const API='https://api.opositatest.com/api/v2.0';
const OUT='preguntas-para-subir/instituciones-penitenciarias/estudio-random';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function reason(qid){for(let i=0;i<3;i++){const r=await fetch(`${API}/questions/${qid}/reason`,{headers:H});if(r.status===429){await sleep(60000);continue;}if(r.status!==200)return{};return r.json();}return{};}
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const seen=new Map(); let sinNuevas=0, batch=0;
  while(sinNuevas<12 && batch<250){
    const ex=await fetch(`${API}/exams`,{method:'POST',headers:H,body:JSON.stringify({type:'random',oppositionId:11,numberOfQuestions:100})}).then(r=>r.json());
    if(!ex.id){console.error('exam fail',JSON.stringify(ex).slice(0,80));break;}
    const t=await fetch(`${API}/tests`,{method:'POST',headers:H,body:JSON.stringify({examId:ex.id,autoStart:true})}).then(r=>r.json());
    const f=await fetch(`${API}/tests/${t.id}?embedded=questions,responses`,{headers:H}).then(r=>r.json());
    let nuevas=0;
    for(const q of (f.questions||[])){ if(!seen.has(q.id)){seen.set(q.id,q);nuevas++;} }
    await fetch(`${API}/tests/${t.id}/discard`,{method:'PUT',headers:H});
    batch++; sinNuevas = nuevas===0 ? sinNuevas+1 : 0;
    if(batch%5===0) console.error(`  batch ${batch}: ${seen.size} únicas (últimas nuevas: ${nuevas})`);
    await sleep(350);
  }
  console.error('Saturado. Únicas:',seen.size,'en',batch,'batches. Obteniendo explicaciones...');
  // explicaciones
  const arr=[...seen.values()]; let done=0;
  for(const q of arr){ const r=await reason(q.id); q.explanation=r.content; q.explanationTitle=r.title; done++; if(done%50===0)console.error('  expl '+done+'/'+arr.length); await sleep(180); }
  // guardar por bloque
  const out=arr.map(q=>{const ci=q.answers.findIndex(a=>a.id===q.correctAnswerId);return{
    id:q.id,question:q.declaration,options:q.answers.map((a,i)=>({letter:['A','B','C','D','E'][i],text:a.declaration})),
    correctAnswer:['A','B','C','D','E'][ci],explanation:q.explanation,explanationTitle:q.explanationTitle,
    isAnnulled:q.isAnnulled,isRepealed:q.isRepealed,contents:(q.contents||[]).map(c=>({name:c.name,child:c.child?c.child.name:null}))};});
  fs.writeFileSync(path.join(OUT,'estudio_random.json'),JSON.stringify({source:'opositatest-random-study',oppositionId:11,scrapedAt:new Date().toISOString(),questionCount:out.length,questions:out},null,2));
  console.log('GUARDADO:',out.length,'preguntas en estudio_random.json');
})();
