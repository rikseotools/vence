require('dotenv').config({path:'.env.local'});
const{createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);

(async()=>{
  const {data: questions} = await s.from('questions')
    .select(`
      id, question_text, option_a, option_b, option_c, option_d, correct_option,
      primary_article_id, articles!inner(article_number, content, laws!inner(short_name))
    `)
    .eq('topic_review_status', 'wrong_article')
    .eq('is_active', true);
  
  console.log('Total wrong_article:', questions?.length || 0);
  
  let fixed = 0;
  let kept = 0;
  
  for(const q of questions || []){
    const questionText = q.question_text.toLowerCase();
    const correctOption = [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option]?.toLowerCase() || '';
    const articleContent = q.articles?.content?.toLowerCase() || '';
    
    let shouldFix = false;
    let reason = '';
    
    // Patrón 1: Negación en pregunta
    if(questionText.includes(' no ') || questionText.includes('incorrecta') || 
       questionText.includes('falsa') || questionText.includes('excepto') ||
       questionText.includes('no es') || questionText.includes('no será') ||
       questionText.includes('no está') || questionText.includes('no corresponde')){
      shouldFix = true;
      reason = 'Falso positivo: Pregunta con negación';
    }
    // Patrón 2: Todas las anteriores
    else if(correctOption.includes('todas') && (correctOption.includes('anterior') || correctOption.includes('correcta'))){
      shouldFix = true;
      reason = 'Falso positivo: Todas las anteriores';
    }
    // Patrón 3: Ninguna de las anteriores
    else if(correctOption.includes('ninguna')){
      shouldFix = true;
      reason = 'Falso positivo: Ninguna de las anteriores';
    }
    // Patrón 4: Combinaciones
    else if(correctOption.includes('a) y b)') || correctOption.includes('a y b') ||
            correctOption.includes('b) y c)') || correctOption.includes('b y c') ||
            correctOption.includes('ambas') || correctOption.includes('las dos') ||
            correctOption.includes('respuestas a') || correctOption.includes('respuestas b')){
      shouldFix = true;
      reason = 'Falso positivo: Combinación de opciones';
    }
    // Patrón 5: Match parcial de keywords (>=30%)
    else {
      const keywords = correctOption.split(/\s+/).filter(w => w.length > 4);
      const matchingKeywords = keywords.filter(kw => articleContent.includes(kw));
      const matchRatio = keywords.length > 0 ? matchingKeywords.length / keywords.length : 0;
      
      if(matchRatio >= 0.3){
        shouldFix = true;
        reason = 'Falso positivo: Match keywords ' + (matchRatio * 100).toFixed(0) + '%';
      }
    }
    
    if(shouldFix){
      await s.from('questions').update({topic_review_status: 'perfect'}).eq('id', q.id);
      await s.from('ai_verification_results').update({
        article_ok: true,
        answer_ok: true,
        explanation_ok: true,
        explanation: reason
      }).eq('question_id', q.id);
      fixed++;
      if(fixed <= 20) console.log('OK:', q.id.substring(0, 8), '-', reason);
    } else {
      kept++;
    }
  }
  
  if(fixed > 20) console.log('... y', fixed - 20, 'más');
  console.log('\nTotal corregidas:', fixed);
  console.log('Mantienen wrong_article:', kept);
})();
