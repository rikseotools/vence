const path=require('path');const ROOT=path.resolve(__dirname,'../..');
require(path.join(ROOT,'node_modules/dotenv')).config({path:path.join(ROOT,'.env.local')});
const postgres=require(path.join(ROOT,'node_modules/postgres'));
const {citaNoLiteral}=require(path.join(ROOT,'scripts/impugnaciones/validar-explicacion.cjs'));
const sql=postgres(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:false},max:2,idle_timeout:20});
(async()=>{
  const IDS=['55c6e0c9','d0614236','d94d07d9','a7ab2b0c','f1eadf63','6f8d7590','aad17666','1bf7cd05'];
  for(const p of IDS){
    const [r]=await sql`SELECT q.id,q.lifecycle_state,q.is_active,q.correct_option,q.explanation,q.explanation_data ed,
        q.shuffle_mode,q.shuffle_safety,q.question_text, a.content acontent
        FROM questions q LEFT JOIN articles a ON a.id=q.primary_article_id WHERE q.id::text LIKE ${p+'%'}`;
    const clave='ABCD'[r.correct_option];
    const afirma=(r.explanation||'').match(/Por qué ([A-D]) es correcta/);
    const coherente = !afirma || afirma[1]===clave;
    const cita = r.ed && r.ed.cita ? (r.ed.cita.bloque||r.ed.cita.texto) : null;
    const lit = cita ? (citaNoLiteral(cita, r.acontent||'')===null?'literal ✅':'NO LITERAL ❌') : '(sin cita)';
    const barajable = r.ed && r.shuffle_mode==='full';
    console.log(`${p} · ${r.lifecycle_state.padEnd(13)} activa=${r.is_active?'sí':'NO'} · clave=${clave} · expl ${coherente?'coherente ✅':'CONTRADICE ❌'} · ${lit} · ${barajable?'barajable ✅':'no barajable'}`);
  }
  const [f]=await sql`SELECT question_text FROM questions WHERE id::text LIKE 'f1eadf63%'`;
  console.log(`\nf1eadf63 enunciado: ${f.question_text.slice(0,150)}`);
  const arts=await sql`SELECT l.short_name ley,a.content FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE l.short_name IN ('Supuesto Excel CyL','Supuesto Word CyL')`;
  console.log('\ntemario:');
  for(const a of arts){
    const malo = a.ley.includes('Excel') ? /no existe\*\* como botón en el cuadro "Ver macros"/ : /\*\*Atajo de teclado:\*\* \*\*Alt\+Ctrl\+F\*\*/;
    console.log(`  ${a.ley}: error antiguo ${malo.test(a.content)?'TODAVÍA PRESENTE ❌':'eliminado ✅'}`);
  }
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
