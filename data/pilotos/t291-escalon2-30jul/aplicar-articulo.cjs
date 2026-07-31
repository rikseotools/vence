// Sustituye el contenido de UN artículo por el de un fichero, con dry-run y comprobación de que el
// enriquecimiento cubre de verdad lo que las preguntas preguntan (si no, es volumen, no cobertura).
const path=require('path'),fs=require('fs');const ROOT=path.resolve(__dirname,'../..');
require(path.join(ROOT,'node_modules/dotenv')).config({path:path.join(ROOT,'.env.local')});
const postgres=require(path.join(ROOT,'node_modules/postgres'));
const [ley,num,fichero]=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const APPLY=process.argv.includes('--apply');
const sql=postgres(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:false},max:2,idle_timeout:20});
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
(async()=>{
  const nuevo=fs.readFileSync(fichero,'utf8');
  const [a]=await sql`SELECT a.id,a.content,a.title FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.short_name=${ley} AND a.article_number=${num}`;
  if(!a){console.error('❌ artículo no encontrado');process.exit(1)}
  console.log(`${ley} art.${num} «${a.title}»`);
  console.log(`  ${a.content.length} → ${nuevo.length} chars (×${(nuevo.length/a.content.length).toFixed(1)})`);
  // cobertura: términos distintivos de la clave de cada pregunta que ya aparecen en el artículo
  const q=await sql`SELECT question_text,correct_option,option_a,option_b,option_c,option_d,
    (SELECT count(*)::int FROM test_questions t WHERE t.question_id=questions.id) exp
    FROM questions WHERE primary_article_id=${a.id} AND is_active`;
  const STOP=new Set(['excel','celda','celdas','funcion','funciones','formula','formulas','valor','valores','datos','rango','opcion','todas','todos','entre','sobre','cuando','entre']);
  const cobertura=(texto)=>{
    let cub=0,tot=0;
    for(const r of q){
      const clave=r['option_'+'abcd'[r.correct_option]]||'';
      // OJO: hay que quitar la puntuación de los BORDES del token. Con el punto final pegado,
      // «Absoluta.» no casaba con «absoluta» del artículo y la métrica daba dos falsos negativos.
      const toks=[...new Set(norm(clave).replace(/[^a-z0-9. ]/g,' ').split(/\s+/)
        .map(t=>t.replace(/^[.]+|[.]+$/g,'')).filter(t=>t.length>=5&&!STOP.has(t)))];
      if(!toks.length) continue;
      tot++; if(toks.some(t=>norm(texto).includes(t))) cub++;
    }
    return `${cub}/${tot}`;
  };
  console.log(`  cobertura de las claves — antes: ${cobertura(a.content)} · después: ${cobertura(nuevo)}`);
  if(!APPLY){console.log('\n🔎 dry-run (--apply para escribir)');await sql.end();return}
  await sql`UPDATE articles SET content=${nuevo}, updated_at=now() WHERE id=${a.id}`;
  console.log('\n✅ escrito.');
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
