import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAlphanumericSeriesQuestions() {
  try {
    console.log('🔍 Buscando sección de series alfanuméricas...');
    
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
    
    const questions = [
      // Pregunta 15: 6 Z 10 X 15 V 21 T ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '6 Z 10 X 15 V 21 T ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_progression',
          series_text: '6 Z 10 X 15 V 21 T ?',
          pattern_description: 'Serie intercalada: números con diferencias crecientes y letras retrocediendo'
        },
        option_a: '34L',
        option_b: '28R',
        option_c: '32N', 
        option_d: '36Y',
        correct_option: 1, // B = 28R
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 6, 10, 15, 21, ?
• Letras: Z, X, V, T, ?

📈 PASO 2: Patrones identificados
• Números: 6→10(+4)→15(+5)→21(+6)→28(+7)
• Letras: Z(26)→X(24)→V(22)→T(20)→R(18) (-2 cada vez)

📋 PASO 3: Siguiente elemento
Posición 9 = número → 28
Posición 10 = letra → R
✅ Respuesta: 28R`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'progression'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 16: a 1 d 4 e 7 j 10 m ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número o la letra que continuarían la siguiente serie lógica: a 1 d 4 e 7 j 10 m ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_arithmetic',
          series_text: 'a 1 d 4 e 7 j 10 m ¿?',
          pattern_description: 'Serie intercalada: letras con saltos variables y números con suma constante'
        },
        option_a: '13',
        option_b: 'ñ',
        option_c: '12', 
        option_d: 'o',
        correct_option: 0, // A = 13
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: a, d, e, j, m, ?
• Números: 1, 4, 7, 10, ?

📈 PASO 2: Patrones identificados
• Números: 1→4→7→10→13 (+3 constante)
• Letras: a(1)→d(4)→e(5)→j(10)→m(13)→?(16)

📋 PASO 3: Siguiente elemento
Posición 10 = número
✅ Siguiente: 10 + 3 = 13`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'arithmetic'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 17: 83 W 79 R 75 N 71 I ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '83 W 79 R 75 N 71 I ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_descending',
          series_text: '83 W 79 R 75 N 71 I ?',
          pattern_description: 'Serie intercalada: números descendiendo de 4 en 4 y letras retrocediendo'
        },
        option_a: '68A',
        option_b: '70B',
        option_c: '69C', 
        option_d: '67D',
        correct_option: 3, // D = 67D
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 83, 79, 75, 71, ?
• Letras: W, R, N, I, ?

📈 PASO 2: Patrones identificados
• Números: 83→79(-4)→75(-4)→71(-4)→67(-4)
• Letras: W(23)→R(18)→N(14)→I(9)→D(4) (-5,-4,-5,-5)

📋 PASO 3: Siguiente elemento
Posición 9 = número → 67
Posición 10 = letra → D
✅ Respuesta: 67D`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'descending_series'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 18: 1 z 2 x w 4 t s r 7 ñ n m l 11 ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué letra o número tendría que continuar la siguiente serie?: 1 z 2 x w 4 t s r 7 ñ n m l 11 ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'cyclic_complex',
          series_text: '1 z 2 x w 4 t s r 7 ñ n m l 11 ¿?',
          pattern_description: 'Serie cíclica compleja con números y grupos de letras descendentes'
        },
        option_a: '16',
        option_b: 'g',
        option_c: 'f', 
        option_d: '15',
        correct_option: 1, // B = g
        explanation: `📊 PASO 1: Identificar patrón
• Números: 1, 2, 4, 7, 11, ? (diferencias: +1,+2,+3,+4,+5)
• Letras: z, x-w, t-s-r, ñ-n-m-l, ?

📈 PASO 2: Patrón de letras
Grupos descendentes: (z), (x,w), (t,s,r), (ñ,n,m,l), (?)
✅ Siguiente grupo: 4 letras hacia atrás: k,j,i,h,g

📋 PASO 3: Siguiente elemento
Posición 16 = letra
✅ Primera letra del grupo: g`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'grouping'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 19: 60 w 75 s 95 o 120 l ¿? ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que iría en lugar de los interrogantes para continuar la serie: 60 w 75 s 95 o 120 l ¿? ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_progressive',
          series_text: '60 w 75 s 95 o 120 l ¿? ¿?',
          pattern_description: 'Serie intercalada: números con diferencias crecientes y letras retrocediendo'
        },
        option_a: '160, g',
        option_b: '175, g',
        option_c: 'h, 175', 
        option_d: '150, h',
        correct_option: 3, // D = 150, h
        explanation: `📊 PASO 1: Separar series intercaladas
• Números: 60, 75, 95, 120, ?
• Letras: w, s, o, l, ?

📈 PASO 2: Patrones identificados
• Números: 60→75(+15)→95(+20)→120(+25)→150(+30)
• Letras: w(23)→s(19)→o(15)→l(12)→h(8) (-4,-4,-3,-4)

📋 PASO 3: Siguiente elemento
Posición 9 = número → 150
Posición 10 = letra → h
✅ Respuesta: 150, h`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'progression'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      }
    ];

    // Insertar las preguntas 15-19
    console.log('📝 Insertando preguntas 15-19...');
    
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert(questions)
      .select();
    
    if (insertError) {
      console.log('❌ Error insertando preguntas:', insertError.message);
      return;
    }
    
    console.log('✅ Preguntas 15-19 añadidas exitosamente:');
    console.log('');
    
    insertedQuestions.forEach((question, index) => {
      const questionNumber = index + 15; // Empezar desde 15
      console.log(`📚 PREGUNTA ${questionNumber.toString().padStart(2, '0')}:`);
      console.log(`📝 ID: ${question.id}`);
      console.log(`❓ Pregunta: ${question.question_text.substring(0, 60)}...`);
      console.log(`✅ Respuesta correcta: ${['A', 'B', 'C', 'D'][question.correct_option]}`);
      console.log(`🔗 Debug: http://localhost:3000/debug/question/${question.id}`);
      console.log('');
    });
    
    // Verificar el conteo total
    const { data: totalQuestions, error: countError } = await supabase
      .from('psychometric_questions')
      .select('id')
      .eq('section_id', section.id);
    
    if (!countError) {
      console.log(`📊 Total de preguntas en "${section.display_name}": ${totalQuestions.length}`);
    }
    
    console.log('');
    console.log('🎯 ¡Todas las 19 preguntas de series alfanuméricas añadidas exitosamente!');
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addAlphanumericSeriesQuestions();