import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAlphanumericSeriesQuestions() {
  try {
    console.log('🔍 Buscando sección de series alfanuméricas...');
    
    // Obtener la sección de series alfanuméricas
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('*, psychometric_categories(*)')
      .eq('section_key', 'series-mixtas')
      .single();
    
    if (sectionError) {
      console.log('❌ Error obteniendo sección:', sectionError.message);
      return;
    }
    
    console.log('✅ Sección encontrada:', section.display_name);
    
    // Pregunta 02: Serie con valores alfanuméricos a=2, c=6; e=10
    const question02 = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Según la serie: a=2, c=6; e=10, ¿Cuál es el resultado de la siguiente operación? b + a + d',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'value_assignment',
        series_text: 'a=2, c=6; e=10',
        pattern_description: 'Serie de valores alfanuméricos con progresión +4',
        explanation_steps: [
          'Identificar el patrón: a=2, c=6, e=10',
          'Diferencia: c-a = 6-2 = 4, e-c = 10-6 = 4',
          'Patrón: cada letra salta una posición y suma 4',
          'Calcular b: b = a+4 = 2+4 = 6... No, b va entre a y c',
          'Patrón correcto: a(2) → b(4) → c(6) → d(8) → e(10)',
          'Resultado: b + a + d = 4 + 2 + 8 = 14'
        ],
        solution_method: 'value_assignment'
      },
      option_a: '10',
      option_b: '12', 
      option_c: '14',
      option_d: '8',
      correct_option: 2, // C = 14
      explanation: `🔍 ANÁLISIS RÁPIDO DE LA SERIE:

📊 PASO 1: Identificar el patrón
Serie dada: a=2, c=6, e=10
• Posiciones: a(1), c(3), e(5) - posiciones impares
• Valores: 2, 6, 10 - progresión +4

📈 PASO 2: Encontrar valores faltantes
• a=2 → b=4 → c=6 → d=8 → e=10
• Patrón: cada letra consecutiva suma 2

📋 PASO 3: Calcular la operación
b + a + d = 4 + 2 + 8 = 14

✅ Respuesta: 14`,
      difficulty: 'medium',
      time_limit_seconds: 120,
      cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'alphanumeric_analysis', 'arithmetic'],
      question_subtype: 'sequence_alphanumeric',
      is_active: true,
      is_verified: true
    };

    // Pregunta 03: Serie 5 B 10 D 30 ? ? K 600 O
    const question03 = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: '¿Qué alternativa sustituiría a las interrogaciones? 5 B 10 D 30 ? ? K 600 O',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'multiplicative_pattern',
        series_text: '5 B 10 D 30 ? ? K 600 O',
        pattern_description: 'Serie con números que se multiplican y letras que saltan posiciones',
        explanation_steps: [
          'Analizar números: 5 → 10 (×2) → 30 (×3) → ? (×4) → 600 (×5)',
          'Calcular número faltante: 30 × 4 = 120',
          'Analizar letras: B → D (salta C) → ? (salta F) → K (salta HIJ) → O',
          'Letra faltante después de D: salta EF → G',
          'Respuesta: G - 120'
        ],
        solution_method: 'multiplicative_analysis'
      },
      option_a: 'H - 190',
      option_b: 'H - 120',
      option_c: 'G - 120', 
      option_d: 'G - 90',
      correct_option: 2, // C = G - 120
      explanation: `🔍 ANÁLISIS RÁPIDO DE LA SERIE:

📊 PASO 1: Separar números y letras
• Números: 5, 10, 30, ?, 600
• Letras: B, D, ?, K, O

📈 PASO 2: Patrón numérico
5 → 10 (×2) → 30 (×3) → ? (×4) → 600 (×5)
✅ 30 × 4 = 120

📋 PASO 3: Patrón de letras  
B → D (salta C) → ? (salta EF) → K → O
✅ Siguiente letra: G

⚡ RESPUESTA: G - 120`,
      difficulty: 'medium',
      time_limit_seconds: 150,
      cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'alphanumeric_analysis', 'multiplication'],
      question_subtype: 'sequence_alphanumeric',
      is_active: true,
      is_verified: true
    };

    // Pregunta 04: Serie 3 p 6 r 10 u 15 y 18 d ...
    const question04 = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: '¿Qué letra o número continuaría la siguiente serie? 3 p 6 r 10 u 15 y 18 d ...',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'intercalated_progressive',
        series_text: '3 p 6 r 10 u 15 y 18 d ...',
        pattern_description: 'Serie intercalada con números que suman progresivamente y letras con saltos variables',
        explanation_steps: [
          'Separar: Números (3,6,10,15,18,?) y Letras (p,r,u,y,d,...)',
          'Números: 3→6(+3), 6→10(+4), 10→15(+5), 15→18(+3), 18→?(+4)',
          'Patrón numérico: +3,+4,+5,+3,+4... (ciclo 3,4,5)',
          'Siguiente: 18 + 4 = 22',
          'Verificar que pide número o letra: posición 11 = número'
        ],
        solution_method: 'intercalated_progressive'
      },
      option_a: '21',
      option_b: 'j',
      option_c: 'i',
      option_d: '22',
      correct_option: 3, // D = 22
      explanation: `🔍 ANÁLISIS RÁPIDO DE LA SERIE:

📊 PASO 1: Separar series intercaladas
• Números: 3, 6, 10, 15, 18, ?
• Letras: p, r, u, y, d, ?

📈 PASO 2: Patrón numérico
3 → 6 (+3) → 10 (+4) → 15 (+5) → 18 (+3) → ? (+4)
✅ Patrón cíclico: +3, +4, +5, +3, +4...
✅ Siguiente: 18 + 4 = 22

📋 PASO 3: Verificar qué se pide
La serie continúa con número en posición 11
✅ Respuesta: 22`,
      difficulty: 'medium',
      time_limit_seconds: 180,
      cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'alphanumeric_analysis', 'arithmetic'],
      question_subtype: 'sequence_alphanumeric',
      is_active: true,
      is_verified: true
    };
    
    // Insertar las tres preguntas
    console.log('📝 Insertando preguntas 02, 03 y 04...');
    
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert([question02, question03, question04])
      .select();
    
    if (insertError) {
      console.log('❌ Error insertando preguntas:', insertError.message);
      return;
    }
    
    console.log('✅ Preguntas de series alfanuméricas añadidas exitosamente:');
    console.log('');
    
    insertedQuestions.forEach((question, index) => {
      const questionNumber = index + 2; // Empezar desde 02
      console.log(`📚 PREGUNTA ${questionNumber.toString().padStart(2, '0')}:`);
      console.log(`📝 ID: ${question.id}`);
      console.log(`❓ Pregunta: ${question.question_text.substring(0, 60)}...`);
      console.log(`✅ Respuesta correcta: ${['A', 'B', 'C', 'D'][question.correct_option]} (${question[`option_${['a', 'b', 'c', 'd'][question.correct_option]}`]})`);
      console.log(`🔗 Debug: http://localhost:3000/debug/question/${question.id}`);
      console.log('');
    });
    
    // Verificar el conteo total de preguntas en la sección
    const { data: totalQuestions, error: countError } = await supabase
      .from('psychometric_questions')
      .select('id')
      .eq('section_id', section.id);
    
    if (!countError) {
      console.log(`📊 Total de preguntas en "${section.display_name}": ${totalQuestions.length}`);
    }
    
    console.log('');
    console.log('🎯 Todas las preguntas usan question_subtype: "sequence_alphanumeric"');
    console.log('   (Componente especializado SequenceAlphanumericQuestion.js)');
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addAlphanumericSeriesQuestions();