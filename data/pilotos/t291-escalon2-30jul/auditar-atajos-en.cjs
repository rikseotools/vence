const path=require('path');const ROOT=path.resolve(__dirname,'../..');
require(path.join(ROOT,'node_modules/dotenv')).config({path:path.join(ROOT,'.env.local')});
const postgres=require(path.join(ROOT,'node_modules/postgres'));
const sql=postgres(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:false},max:2,idle_timeout:20});
// Atajos que Microsoft LOCALIZA. Si un artículo da el valor inglés, viene del set inglés.
const REGLAS=[
  [/ctrl\s*\+\s*s\b[^\n|]{0,40}guardar/i,'Ctrl+S = guardar (ES es Ctrl+G)'],
  [/guardar[^\n|]{0,40}ctrl\s*\+\s*s\b/i,'guardar = Ctrl+S (ES es Ctrl+G)'],
  [/ctrl\s*\+\s*b\b[^\n|]{0,40}negrita/i,'Ctrl+B = negrita (ES es Ctrl+N)'],
  [/negrita[^\n|]{0,40}ctrl\s*\+\s*b\b/i,'negrita = Ctrl+B (ES es Ctrl+N)'],
  [/ctrl\s*\+\s*i\b[^\n|]{0,40}cursiva/i,'Ctrl+I = cursiva (ES es Ctrl+K)'],
  [/cursiva[^\n|]{0,40}ctrl\s*\+\s*i\b/i,'cursiva = Ctrl+I (ES es Ctrl+K)'],
  [/ctrl\s*\+\s*u\b[^\n|]{0,40}subray/i,'Ctrl+U = subrayado (ES es Ctrl+S)'],
  [/ctrl\s*\+\s*f\b[^\n|]{0,40}buscar/i,'Ctrl+F = buscar (ES es Ctrl+B)'],
  [/ctrl\s*\+\s*n\b[^\n|]{0,25}(nuevo|nueva)/i,'Ctrl+N = nuevo (ES es Ctrl+U)'],
  [/ctrl\s*\+\s*a\b[^\n|]{0,40}(seleccionar todo)/i,'Ctrl+A = seleccionar todo (ES es Ctrl+E)'],
];
(async()=>{
  const arts=await sql`SELECT l.short_name ley,a.article_number num,a.title,a.content
    FROM articles a JOIN laws l ON l.id=a.law_id WHERE a.is_active AND l.is_virtual
      AND a.content ~* 'ctrl *\\+'`;
  let total=0;
  for(const a of arts){
    const hits=[];
    for(const linea of a.content.split('\n')){
      for(const [re,msg] of REGLAS) if(re.test(linea)) hits.push(`${msg} → «${linea.trim().slice(0,110)}»`);
    }
    if(hits.length){total+=hits.length;console.log(`\n❌ ${a.ley} art.${a.num} (${a.title})`);for(const h of hits)console.log(`   ${h}`)}
  }
  console.log(`\n${total===0?'✅ ningún contenedor da un atajo localizable en su forma inglesa':`❌ ${total} afirmaciones sospechosas`}`);
  console.log(`   (revisados ${arts.length} artículos virtuales que mencionan Ctrl+)`);
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
