require('dotenv').config({path:'.env.local'});
const{createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);

(async()=>{
  // Get all bad_answer questions
  const {data: questions} = await s.from('questions')
    .select(`
      id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      primary_article_id
    `)
    .eq('topic_review_status', 'bad_answer')
    .eq('is_active', true);
  
  console.log('Total bad_answer:', questions?.length || 0);
  console.log('\n=== Análisis de patrones ===\n');
  
  let patterns = {
    todasAnteriores: [],
    ningunaAnteriores: [],
    negacion: [],
    aYb: [],
    otros: []
  };
  
  for(const q of questions || []){
    const correctOption = [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option]?.toLowerCase() || '';
    const questionText = q.question_text.toLowerCase();
    
    // Patrón 1: "Todas las anteriores"
    if(correctOption.includes('todas') && (correctOption.includes('anterior') || correctOption.includes('correcta'))){
      patterns.todasAnteriores.push(q.id);
      continue;
    }
    
    // Patrón 2: "Ninguna de las anteriores"
    if(correctOption.includes('ninguna')){
      patterns.ningunaAnteriores.push(q.id);
      continue;
    }
    
    // Patrón 3: Preguntas con negación
    if(questionText.includes(' no ') || questionText.includes('incorrecta') || 
       questionText.includes('falsa') || questionText.includes('excepto') ||
       questionText.includes('no es') || questionText.includes('no está')){
      patterns.negacion.push(q.id);
      continue;
    }
    
    // Patrón 4: "a) y b)" o similar
    if(correctOption.includes('a) y b)') || correctOption.includes('a y b') ||
       correctOption.includes('b) y c)') || correctOption.includes('las dos primeras')){
      patterns.aYb.push(q.id);
      continue;
    }
    
    patterns.otros.push(q.id);
  }
  
  console.log('Todas las anteriores:', patterns.todasAnteriores.length);
  console.log('Ninguna de las anteriores:', patterns.ningunaAnteriores.length);
  console.log('Preguntas con negación:', patterns.negacion.length);
  console.log('Combinaciones (a y b):', patterns.aYb.length);
  console.log('Otros (revisar manual):', patterns.otros.length);
  
  // Mostrar algunos ejemplos de "otros"
  if(patterns.otros.length > 0){
    console.log('\n=== Muestra de "otros" (primeros 5) ===\n');
    for(const id of patterns.otros.slice(0, 5)){
      const q = questions.find(x => x.id === id);
      console.log('ID:', id.substring(0, 8));
      console.log('Q:', q.question_text.substring(0, 100));
      console.log('Correcta:', ['A','B','C','D'][q.correct_option], '-', [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option]?.substring(0, 60));
      console.log('---');
    }
  }
  
  // Guardar IDs para corrección
  const falsePositives = [
    ...patterns.todasAnteriores,
    ...patterns.ningunaAnteriores,
    ...patterns.negacion,
    ...patterns.aYb
  ];
  
  console.log('\n=== RESUMEN ===');
  console.log('Falsos positivos identificados:', falsePositives.length);
  console.log('Requieren revisión manual:', patterns.otros.length);
})();
