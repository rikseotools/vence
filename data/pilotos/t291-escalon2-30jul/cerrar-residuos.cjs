const path=require('path');const ROOT=path.resolve(__dirname,'../..');
require(path.join(ROOT,'node_modules/dotenv')).config({path:path.join(ROOT,'.env.local')});
const postgres=require(path.join(ROOT,'node_modules/postgres'));
const APPLY=process.argv.includes('--apply');
const sql=postgres(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:false},max:2,idle_timeout:20});
const PLAN=[
 { ley:'Supuesto Word CyL', num:'1', reps:[
   // Cabo que quedó abierto el 30/07 porque las fuentes se partían. Zanjado: el temario de
   // oposiciones AGE da el mnemotécnico español (la «L» de documento finaL) y otros once sitios
   // del propio banco ya decían L. Además Alt+Ctrl+D es, en español, la vista Diseño de impresión.
   ['| **Insertar nota al final** | **Alt+Ctrl+D** |','| **Insertar nota al final** | **Alt+Ctrl+L** |'],
   ['**Atajo de teclado:** **Alt+Ctrl+D**','**Atajo de teclado:** **Alt+Ctrl+L**'],
 ]},
 { ley:'Outlook 2016', num:'2', reps:[
   // El artículo daba dos atajos distintos para «Buscar» en la misma línea de listado. En Outlook
   // español, Buscar es Ctrl+E; Ctrl+Mayús+F es la BÚSQUEDA AVANZADA, que es otra acción.
   ['Buscar: Ctrl+Mayus+F','Búsqueda avanzada: Ctrl+Mayús+F'],
 ]},
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
      console.log(`   ${n===1?'✅':'❌'} ${n}× «${de.slice(0,60)}»`);
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
  console.log('\n✅ confirmado.');
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
