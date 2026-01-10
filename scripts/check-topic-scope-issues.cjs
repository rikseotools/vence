require('dotenv').config({path:'.env.local'});
const{createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);

(async()=>{
  // Get wrong_article questions and group by topic
  const {data: questions} = await s.from('questions')
    .select(`
      id, question_text,
      primary_article_id, 
      articles!inner(article_number, law_id, laws!inner(short_name, name))
    `)
    .eq('topic_review_status', 'wrong_article')
    .eq('is_active', true);
  
  console.log('Total wrong_article:', questions?.length || 0);
  
  // Analyze which laws are mentioned in questions vs linked articles
  const lawMentions = {};
  const linkedLaws = {};
  
  // Common law patterns in questions
  const lawPatterns = [
    {pattern: /rd\s*364\/1995|real decreto 364\/1995/i, name: 'RD 364/1995 (Reglamento Ingreso)'},
    {pattern: /rd\s*2271\/2004|real decreto 2271\/2004/i, name: 'RD 2271/2004 (Acceso Discapacitados)'},
    {pattern: /rd\s*2073\/1999|real decreto 2073\/1999/i, name: 'RD 2073/1999 (Registro Personal)'},
    {pattern: /rd\s*462\/2002|real decreto 462\/2002/i, name: 'RD 462/2002 (Indemnizaciones)'},
    {pattern: /rd\s*210\/2024|real decreto 210\/2024/i, name: 'RD 210/2024'},
    {pattern: /ley 30\/1984/i, name: 'Ley 30/1984 (Reforma FP)'},
    {pattern: /orden pre\/1576\/2002/i, name: 'Orden PRE/1576/2002'},
    {pattern: /orden.*30.*julio.*1992/i, name: 'Orden 30/07/1992 (Nóminas)'},
    {pattern: /iv convenio|convenio colectivo/i, name: 'IV Convenio Colectivo'},
    {pattern: /trebep|rdl 5\/2015/i, name: 'RDL 5/2015 (TREBEP)'},
    {pattern: /ley 47\/2003/i, name: 'Ley 47/2003 (LGP)'},
    {pattern: /ley 38\/2003/i, name: 'Ley 38/2003 (Subvenciones)'},
  ];
  
  for(const q of questions || []){
    const qText = q.question_text.toLowerCase();
    const linkedLaw = q.articles?.laws?.short_name || 'Unknown';
    
    // Count linked laws
    linkedLaws[linkedLaw] = (linkedLaws[linkedLaw] || 0) + 1;
    
    // Find mentioned laws
    for(const {pattern, name} of lawPatterns){
      if(pattern.test(qText)){
        lawMentions[name] = (lawMentions[name] || 0) + 1;
        break;
      }
    }
  }
  
  console.log('\n=== Leyes vinculadas (artículo linked) ===');
  Object.entries(linkedLaws).sort((a,b) => b[1] - a[1]).forEach(([law, count]) => {
    console.log(count + 'x', law);
  });
  
  console.log('\n=== Leyes mencionadas en preguntas ===');
  Object.entries(lawMentions).sort((a,b) => b[1] - a[1]).forEach(([law, count]) => {
    console.log(count + 'x', law);
  });
  
  // Find mismatches
  console.log('\n=== ANÁLISIS DE DISCREPANCIAS ===');
  let mismatchCount = 0;
  let notInDbCount = 0;
  
  const lawsInDb = ['RDL 5/2015', 'Ley 47/2003', 'Ley 38/2003', 'RD 462/2002', 'LO 2/1982'];
  const lawsNotInDb = ['RD 364/1995', 'RD 2271/2004', 'RD 2073/1999', 'Ley 30/1984', 
                       'Orden PRE/1576/2002', 'Orden 30/07/1992', 'IV Convenio', 'RD 210/2024'];
  
  for(const q of questions || []){
    const qText = q.question_text.toLowerCase();
    const linkedLaw = q.articles?.laws?.short_name || '';
    
    for(const law of lawsNotInDb){
      if(qText.includes(law.toLowerCase().replace('/', '/'))){
        notInDbCount++;
        break;
      }
    }
  }
  
  console.log('Preguntas sobre leyes NO en BD:', notInDbCount);
  console.log('Esto representa:', ((notInDbCount / questions.length) * 100).toFixed(1) + '% del total');
  console.log('\nConclusión: Estas preguntas están vinculadas a artículos incorrectos porque');
  console.log('las leyes específicas (RD 364/1995, etc.) no están en la BD de artículos.');
})();
