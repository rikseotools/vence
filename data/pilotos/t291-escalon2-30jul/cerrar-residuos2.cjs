const path=require('path');const ROOT=path.resolve(__dirname,'../..');
require(path.join(ROOT,'node_modules/dotenv')).config({path:path.join(ROOT,'.env.local')});
const postgres=require(path.join(ROOT,'node_modules/postgres'));
const APPLY=process.argv.includes('--apply');
const sql=postgres(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:false},max:2,idle_timeout:20});
// Los dos últimos restos del set inglés en Word, ambos contra la tabla de referencia ya corregida
// del art.5 (Buscar = Ctrl+B, Hipervínculo = Ctrl+Alt+K) y contra Word 2016, que ya los tenía bien.
const PLAN=[
 { ley:'Word 365', num:'6', reps:[['| **Ctrl+F** | Buscar (abre panel de navegación) |','| **Ctrl+B** | Buscar (abre panel de navegación) |']]},
 { ley:'Word 365 Escritorio', num:'6', reps:[['| **Ctrl+F** | Buscar (abre panel de navegación) |','| **Ctrl+B** | Buscar (abre panel de navegación) |']]},
 { ley:'Word 365', num:'1', reps:[['| Insertar hipervínculo | Ctrl+Alt+H |','| Insertar hipervínculo | Ctrl+Alt+K |']]},
 { ley:'Word 365 Escritorio', num:'1', reps:[['| Insertar hipervínculo | Ctrl+Alt+H |','| Insertar hipervínculo | Ctrl+Alt+K |']]},
];
(async()=>{
  console.log(APPLY?'⚠️  APPLY\n':'🔎 DRY-RUN\n');
  let abortar=false; const nuevos=[];
  for(const p of PLAN){
    const [a]=await sql`SELECT a.id,a.content FROM articles a JOIN laws l ON l.id=a.law_id
      WHERE l.short_name=${p.ley} AND a.article_number=${p.num}`;
    let c=a.content; console.log(`— ${p.ley} art.${p.num}`);
    for(const [de,to] of p.reps){
      const n=c.split(de).length-1;
      console.log(`   ${n===1?'✅':'❌'} ${n}× «${de.slice(0,58)}»`);
      if(n!==1){abortar=true;continue}
      c=c.replace(de,to);
    }
    nuevos.push({id:a.id,que:`${p.ley} art.${p.num}`,c});
  }
  if(abortar){console.error('\n❌ abortado');await sql.end();process.exit(1)}
  if(!APPLY){console.log('\n✅ todo cuadra.');await sql.end();return}
  await sql.begin(async(tx)=>{for(const n of nuevos){
    await tx`UPDATE articles SET content=${n.c}, updated_at=now() WHERE id=${n.id}`;
    console.log(`  ✍️  ${n.que}`);}});
  console.log('\n✅ confirmado.');await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
