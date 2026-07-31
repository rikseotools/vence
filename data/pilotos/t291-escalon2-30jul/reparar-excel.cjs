const path=require('path');const ROOT=path.resolve(__dirname,'../..');
require(path.join(ROOT,'node_modules/dotenv')).config({path:path.join(ROOT,'.env.local')});
const postgres=require(path.join(ROOT,'node_modules/postgres'));
const APPLY=process.argv.includes('--apply');
const sql=postgres(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:false},max:2,idle_timeout:20});
// Excel español: Ctrl+B = Buscar, Ctrl+L = Reemplazar. Ctrl+F / Ctrl+H son los INGLESES.
// Verificado en exceltotal.com y en fuentes de oposiciones; nuestro propio Excel 365 art.10 ya lo
// tenía bien («Ctrl+L | Abrir Buscar y reemplazar»). Los art.150 daban las dos teclas como si las
// dos operasen, y el art.140 usaba directamente la inglesa.
const FILA_H='| **Ctrl+H** | Buscar y Reemplazar (cuadro de diálogo directo) |';
const FILA_H_NUEVA='| ~~Ctrl+H~~ | **Convención INGLESA** de Reemplazar (*Replace*). En el Excel instalado en español la tecla es **Ctrl+L**; Ctrl+H aparece como distractor típico. |';
const PLAN=[
 { ley:'Excel 365', num:'150', reps:[[FILA_H, FILA_H_NUEVA]] },
 { ley:'Excel 365 Escritorio', num:'150', reps:[[FILA_H, FILA_H_NUEVA]] },
 { ley:'Excel 365', num:'140', reps:[
   ['- Usar **Buscar y reemplazar** (Ctrl+H) para eliminar espacios extraños',
    '- Usar **Buscar y reemplazar** (Ctrl+L en el Excel en español) para eliminar espacios extraños'] ] },
];
(async()=>{
  console.log(APPLY?'⚠️  APPLY\n':'🔎 DRY-RUN\n');
  let abortar=false;const nuevos=[];
  for(const p of PLAN){
    const [a]=await sql`SELECT a.id,a.content FROM articles a JOIN laws l ON l.id=a.law_id
      WHERE l.short_name=${p.ley} AND a.article_number=${p.num}`;
    if(!a){console.error(`❌ no existe ${p.ley} art.${p.num}`);abortar=true;continue}
    let c=a.content;console.log(`— ${p.ley} art.${p.num}`);
    for(const [de,to] of p.reps){
      const n=c.split(de).length-1;
      console.log(`   ${n===1?'✅':'❌'} ${n}× «${de.slice(0,64)}…»`);
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
