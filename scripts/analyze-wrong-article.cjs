require('dotenv').config({path:'.env.local'});
const{createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);

(async()=>{
  // Get all wrong_article questions
  const {data: questions} = await s.from('questions')
    .select(`
      id, question_text, option_a, option_b, option_c, option_d, correct_option,
      primary_article_id, articles!inner(article_number, content, laws!inner(short_name))
    `)
    .eq('topic_review_status', 'wrong_article')
    .eq('is_active', true);
  
  console.log('Total wrong_article:', questions?.length || 0);
  
  // Analyze patterns
  let patterns = {
    otherLaw: [],           // Pregunta sobre otra ley no en BD
    sameAnswerLowMatch: [], // Respuesta correcta pero bajo match de keywords
    negation: [],           // Preguntas con negación
    todasNinguna: [],       // Todas/Ninguna de las anteriores
    combinacion: [],        // Combinaciones a y b
    mentionsOtherArticle: [], // Menciona artículo diferente
    other: []
  };
  
  // Laws that are commonly mentioned but may not be in DB
  const otherLaws = [
    'rd 364/1995', 'real decreto 364/1995',
    'rd 2271/2004', 'real decreto 2271/2004', 
    'rd 2169/1984', 'real decreto 2169/1984',
    'rd 210/2024', 'real decreto 210/2024',
    'rd 2073/1999', 'real decreto 2073/1999',
    'rd 462/2002', 'real decreto 462/2002',
    'rd 1084/1990', 'real decreto 1084/1990',
    'orden pre/1576/2002',
    'orden de 30 de julio de 1992', 'orden 30/07/1992',
    'ley 30/1984',
    'iv convenio', 'convenio colectivo',
    'orden tdf/379/2024'
  ];
  
  for(const q of questions || []){
    const questionText = q.question_text.toLowerCase();
    const correctOption = [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option]?.toLowerCase() || '';
    const linkedLaw = q.articles?.laws?.short_name?.toLowerCase() || '';
    const linkedArt = q.articles?.article_number || '';
    const articleContent = q.articles?.content?.toLowerCase() || '';
    
    // Check for other law patterns
    let isOtherLaw = false;
    for(const law of otherLaws){
      if(questionText.includes(law)){
        isOtherLaw = true;
        patterns.otherLaw.push({id: q.id, law: law});
        break;
      }
    }
    if(isOtherLaw) continue;
    
    // Check for negation
    if(questionText.includes(' no ') || questionText.includes('incorrecta') || 
       questionText.includes('falsa') || questionText.includes('excepto') ||
       questionText.includes('no es') || questionText.includes('no será')){
      patterns.negation.push(q.id);
      continue;
    }
    
    // Check for todas/ninguna
    if(correctOption.includes('todas') && (correctOption.includes('anterior') || correctOption.includes('correcta'))){
      patterns.todasNinguna.push(q.id);
      continue;
    }
    if(correctOption.includes('ninguna')){
      patterns.todasNinguna.push(q.id);
      continue;
    }
    
    // Check for combinations
    if(correctOption.includes('a) y b)') || correctOption.includes('a y b') ||
       correctOption.includes('b) y c)') || correctOption.includes('b y c') ||
       correctOption.includes('ambas') || correctOption.includes('las dos')){
      patterns.combinacion.push(q.id);
      continue;
    }
    
    // Check if question mentions different article number
    const mentionedArt = questionText.match(/art[íi]culo\s+(\d+)/i);
    if(mentionedArt && mentionedArt[1] !== linkedArt){
      patterns.mentionsOtherArticle.push({id: q.id, mentioned: mentionedArt[1], linked: linkedArt});
      continue;
    }
    
    // Check keyword match - if answer keywords are in article, it's likely a false positive
    const keywords = correctOption.split(/\s+/).filter(w => w.length > 4);
    const matchingKeywords = keywords.filter(kw => articleContent.includes(kw));
    const matchRatio = keywords.length > 0 ? matchingKeywords.length / keywords.length : 0;
    
    if(matchRatio >= 0.3){
      patterns.sameAnswerLowMatch.push(q.id);
      continue;
    }
    
    patterns.other.push(q.id);
  }
  
  console.log('\n=== ANÁLISIS DE PATRONES ===\n');
  console.log('Preguntas sobre otras leyes no en BD:', patterns.otherLaw.length);
  console.log('Preguntas con negación:', patterns.negation.length);
  console.log('Todas/Ninguna de las anteriores:', patterns.todasNinguna.length);
  console.log('Combinaciones (a y b, ambas):', patterns.combinacion.length);
  console.log('Menciona artículo diferente:', patterns.mentionsOtherArticle.length);
  console.log('Match parcial de keywords (>=30%):', patterns.sameAnswerLowMatch.length);
  console.log('Otros (requieren análisis):', patterns.other.length);
  
  const falsePositives = patterns.negation.length + patterns.todasNinguna.length + 
                         patterns.combinacion.length + patterns.sameAnswerLowMatch.length;
  
  console.log('\n=== RESUMEN ===');
  console.log('Falsos positivos identificados:', falsePositives);
  console.log('Preguntas sobre leyes no en BD:', patterns.otherLaw.length);
  console.log('Menciona artículo diferente:', patterns.mentionsOtherArticle.length);
  console.log('Otros:', patterns.other.length);
  
  // Show sample of "other laws"
  console.log('\n=== Muestra de leyes mencionadas ===');
  const lawCounts = {};
  patterns.otherLaw.forEach(x => {
    lawCounts[x.law] = (lawCounts[x.law] || 0) + 1;
  });
  Object.entries(lawCounts).sort((a,b) => b[1] - a[1]).forEach(([law, count]) => {
    console.log(count + 'x', law);
  });
})();
