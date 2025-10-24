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
    
    const questions = [
      // Pregunta 05: S = 432; R = 144; Q = 72; P= 24; O= 12; N = ?; M = ?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Cada una de las series que figuran a continuación siguen un orden lógico. Indique la opción de respuesta que considere sustituya de izquierda a derecha, a las interrogaciones que figuran en cada serie. No se tendrá en cuenta la letra "ñ". S = 432; R = 144; Q = 72; P= 24; O= 12; N = ?; M = ?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'division_pattern',
          series_text: 'S = 432; R = 144; Q = 72; P= 24; O= 12; N = ?; M = ?',
          pattern_description: 'Serie descendente en orden alfabético con división por 3',
          explanation_steps: [
            'Letras van hacia atrás: S→R→Q→P→O→N→M',
            'Números se dividen por 3: 432÷3=144, 144÷3=48... Error',
            'Patrón real: 432÷3=144, 144÷2=72, 72÷3=24, 24÷2=12',
            'Alternar ÷3 y ÷2: N = 12÷3 = 4, M = 4÷2 = 2'
          ]
        },
        option_a: '6, 3',
        option_b: '4, 1',
        option_c: '6, 2', 
        option_d: '4, 2',
        correct_option: 3, // D = 4, 2
        explanation: `📊 PASO 1: Identificar patrones
• Letras: S→R→Q→P→O→N→M (hacia atrás en alfabeto)
• Números: 432, 144, 72, 24, 12, ?, ?

📈 PASO 2: Patrón numérico
432÷3=144, 144÷2=72, 72÷3=24, 24÷2=12
✅ Alternar ÷3 y ÷2

📋 PASO 3: Calcular valores faltantes
N = 12÷3 = 4
M = 4÷2 = 2
✅ Respuesta: 4, 2`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'division', 'alphabet_order'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 06: m 13 p 17 u 22 a 28 ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra y/o número que continúa la siguiente serie: m 13 p 17 u 22 a 28 ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_progressive',
          series_text: 'm 13 p 17 u 22 a 28 ¿?',
          pattern_description: 'Serie intercalada: letras con saltos variables y números que suman progresivamente'
        },
        option_a: '27',
        option_b: 'g',
        option_c: '26', 
        option_d: 'h',
        correct_option: 3, // D = h
        explanation: `📊 PASO 1: Separar series
• Letras: m, p, u, a, ?
• Números: 13, 17, 22, 28, ?

📈 PASO 2: Patrón de letras
m(13)→p(16)→u(21)→a(1)→? 
✅ Saltos: +3, +5, -20, +7 → siguiente: h(8)

📋 PASO 3: Verificar qué se pide
Posición 9 = letra
✅ Respuesta: h`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'alphabet_position'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 07: a c 3 e g 5 i k 8 m ñ 12 p ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique la letra o número que seguiría el planteamiento de la siguiente serie: a c 3 e g 5 i k 8 m ñ 12 p ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'complex_intercalated',
          series_text: 'a c 3 e g 5 i k 8 m ñ 12 p ¿?',
          pattern_description: 'Serie compleja intercalada con grupos de 2 letras seguidos de números'
        },
        option_a: '15',
        option_b: 'r',
        option_c: 's', 
        option_d: 't',
        correct_option: 1, // B = r
        explanation: `📊 PASO 1: Identificar patrón
Grupos: (a,c,3), (e,g,5), (i,k,8), (m,ñ,12), (p,?,?)

📈 PASO 2: Patrón interno
• Dos letras consecutivas + número
• Letras: a,c→e,g→i,k→m,ñ→p,r
• Números: 3→5(+2)→8(+3)→12(+4)→16(+4)

📋 PASO 3: Siguiente elemento
Después de 'p' viene 'r'
✅ Respuesta: r`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'grouping'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 08: v 1 x 2 a 3 e 4 j 5 ¿? ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la siguiente serie, busque la letra y/o número que tienen que ir en lugar de los interrogantes para que la serie tenga un sentido: v 1 x 2 a 3 e 4 j 5 ¿? ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_sequential',
          series_text: 'v 1 x 2 a 3 e 4 j 5 ¿? ¿?',
          pattern_description: 'Serie intercalada: letras con patrón especial y números consecutivos'
        },
        option_a: 'o, 6',
        option_b: '7, p',
        option_c: '6, o', 
        option_d: 'o, 7',
        correct_option: 0, // A = o, 6
        explanation: `📊 PASO 1: Separar series
• Letras: v, x, a, e, j, ?
• Números: 1, 2, 3, 4, 5, ?

📈 PASO 2: Patrones
• Números: consecutivos 1,2,3,4,5,6
• Letras: v(22)→x(24)→a(1)→e(5)→j(10)→o(15)
✅ Patrón letras: +2, -23, +4, +5, +5

📋 PASO 3: Respuesta
Siguiente: o, 6
✅ Respuesta: o, 6`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'sequential_numbers'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 09: w 3 5 v 7 u 11 13 t 15 ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: '¿Qué número o letra continuaría la siguiente serie lógica?: w 3 5 v 7 u 11 13 t 15 ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'correlative_mixed',
          series_text: 'w 3 5 v 7 u 11 13 t 15 ¿?',
          pattern_description: 'Serie correlativa mixta con letras descendentes y números con patrón específico'
        },
        option_a: '16',
        option_b: '18',
        option_c: 's', 
        option_d: '17',
        correct_option: 3, // D = 17
        explanation: `📊 PASO 1: Separar elementos
• Letras: w, v, u, t, ?
• Números: 3, 5, 7, 11, 13, 15, ?

📈 PASO 2: Patrones
• Letras: w→v→u→t→s (descendente)
• Números: 3,5,7,11,13,15,17 (+2,+2,+4,+2,+2,+2)

📋 PASO 3: Siguiente elemento
Posición 11 = número
✅ Siguiente: 15 + 2 = 17`,
        difficulty: 'medium',
        time_limit_seconds: 150,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'arithmetic'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      }
    ];

    // Insertar las primeras 5 preguntas
    console.log('📝 Insertando preguntas 05-09...');
    
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert(questions)
      .select();
    
    if (insertError) {
      console.log('❌ Error insertando preguntas:', insertError.message);
      return;
    }
    
    console.log('✅ Preguntas 05-09 añadidas exitosamente:');
    console.log('');
    
    insertedQuestions.forEach((question, index) => {
      const questionNumber = index + 5; // Empezar desde 05
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
    console.log('🎯 Preguntas 05-09 añadidas. Ejecutar siguiente script para P10-14.');
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addAlphanumericSeriesQuestions();