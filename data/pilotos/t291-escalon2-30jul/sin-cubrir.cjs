const path=require('path'),fs=require('fs');const ROOT=path.resolve(__dirname,'../..');
require(path.join(ROOT,'node_modules/dotenv')).config({path:path.join(ROOT,'.env.local')});
const postgres=require(path.join(ROOT,'node_modules/postgres'));
const [ley,num,fichero]=process.argv.slice(2);
const sql=postgres(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:false},max:2,idle_timeout:20});
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const STOP=new Set(['excel','word','celda','celdas','funcion','funciones','formula','formulas','valor','valores','datos','rango','opcion','opciones','todas','todos','entre','sobre','cuando','respuestas','correctas','correcta','documento','pulse','podemos','debemos']);
(async()=>{
  const texto=norm(fs.readFileSync(fichero,'utf8'));
  const [a]=await sql`SELECT a.id FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.short_name=${ley} AND a.article_number=${num}`;
  const q=await sql`SELECT question_text,correct_option,option_a,option_b,option_c,option_d,
    (SELECT count(*)::int FROM test_questions t WHERE t.question_id=questions.id) exp
    FROM questions WHERE primary_article_id=${a.id} AND is_active ORDER BY exp DESC`;
  for(const r of q){
    const clave=r['option_'+'abcd'[r.correct_option]]||'';
    const toks=[...new Set(norm(clave).replace(/[^a-z0-9. ]/g,' ').split(/\s+/).map(t=>t.replace(/^[.]+|[.]+$/g,'')).filter(t=>t.length>=5&&!STOP.has(t)))];
    if(!toks.length){console.log(`(sin tokens) ${r.exp}exp «${r.question_text.replace(/\s+/g,' ').slice(0,80)}» → «${clave.slice(0,50)}»`);continue}
    if(!toks.some(t=>texto.includes(t))) console.log(`❌ ${r.exp}exp «${r.question_text.replace(/\s+/g,' ').slice(0,86)}»\n     clave: «${clave.slice(0,72)}»\n     faltan: ${toks.filter(t=>!texto.includes(t)).join(', ')}`);
  }
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
