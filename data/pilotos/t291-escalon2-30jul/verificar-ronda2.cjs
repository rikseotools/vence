const path=require('path');const ROOT=path.resolve(__dirname,'../..');
require(path.join(ROOT,'node_modules/dotenv')).config({path:path.join(ROOT,'.env.local')});
const postgres=require(path.join(ROOT,'node_modules/postgres'));
const {citaNoLiteral}=require(path.join(ROOT,'scripts/impugnaciones/validar-explicacion.cjs'));
const sql=postgres(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:false},max:2,idle_timeout:20});
(async()=>{
  // 1. ¿queda algún artículo afirmando el atajo inglés como si fuera el español?
  const arts=await sql`SELECT l.short_name ley,a.article_number num,a.content FROM articles a JOIN laws l ON l.id=a.law_id
    WHERE a.is_active AND l.short_name ILIKE '%word%'`;
  let malos=0;
  for(const a of arts){
    const re=/(?:alt\s*\+\s*ctrl|ctrl\s*\+\s*alt)\s*\+\s*F\b(?![0-9])/gi; let m;
    while((m=re.exec(a.content))!==null){
      const ctx=a.content.slice(Math.max(0,m.index-120),m.index+80);
      if(/ingles|inglesa|footnote/i.test(ctx)) continue;   // mención legítima como atajo inglés
      console.log(`❌ ${a.ley} art.${a.num}: «…${ctx.replace(/\n/g,' ')}…»`); malos++;
    }
  }
  console.log(malos===0?'✅ ningún artículo de Word afirma ya Ctrl+Alt+F como atajo español':`❌ ${malos} restos`);

  // 2. estado de las preguntas tocadas
  const IDS=['1ee365af','df6d4b02','7e6489d5','2ed3c747','742450c1','2eb1c5e5','f98e1daa','79812276','1bf7cd05','987f0ad1'];
  console.log('\npreguntas:');
  for(const p of IDS){
    const [r]=await sql`SELECT q.id,q.lifecycle_state,q.is_active,q.correct_option,q.explanation,q.explanation_data ed,
        q.shuffle_mode,a.content ac FROM questions q LEFT JOIN articles a ON a.id=q.primary_article_id WHERE q.id::text LIKE ${p+'%'}`;
    const af=(r.explanation||'').match(/Por qué ([A-D]) es correcta/);
    const coh=!af||af[1]==='ABCD'[r.correct_option];
    const cita=r.ed&&r.ed.cita?(r.ed.cita.bloque||r.ed.cita.texto):null;
    const lit=cita?(citaNoLiteral(cita,r.ac||'')===null?'cita literal ✅':'CITA NO LITERAL ❌'):'—';
    const restoF=/(?:alt\s*\+?\s*ctrl|ctrl\s*\+?\s*alt)\s*\+?\s*F\b(?![0-9])/i.test(r.explanation||'')
      && !/ingles|inglesa|footnote/i.test(r.explanation||'');
    console.log(`  ${p} · ${r.lifecycle_state.padEnd(13)} activa=${r.is_active?'sí':'NO '} · clave=${'ABCD'[r.correct_option]} · ${coh?'coherente ✅':'CONTRADICE ❌'} · ${lit} · ${restoF?'AÚN CITA Ctrl+Alt+F ❌':'sin resto ✅'}`);
  }
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
