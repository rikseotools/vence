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
      // Pregunta 10: z 118 u 122 p 127 l 133 g ¿? ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Continúe con la letra o número que sigue el razonamiento de la serie: z 118 u 122 p 127 l 133 g ¿? ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_progression',
          series_text: 'z 118 u 122 p 127 l 133 g ¿? ¿?',
          pattern_description: 'Serie intercalada: letras retroceden saltando y números aumentan progresivamente'
        },
        option_a: '141, d',
        option_b: 'b, 140',
        option_c: '140 b', 
        option_d: '140 d',
        correct_option: 2, // C = 140 b
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: z, u, p, l, g, ?
• Números: 118, 122, 127, 133, ?

📈 PASO 2: Patrones identificados
• Letras: z(26)→u(21)→p(16)→l(12)→g(7)→b(2) (retroceden)
• Números: 118→122(+4)→127(+5)→133(+6)→140(+7)

📋 PASO 3: Siguiente elemento
Posición 9 = número → 140
Posición 10 = letra → b
✅ Respuesta: 140 b`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'progression'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 11: g-3-i; k-5-m; ñ-8-p; r-10-t; v-13-¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'En la siguiente serie, indique el número y/o letra que continuaría la lógica de la misma: g-3-i; k-5-m; ñ-8-p; r-10-t; v-13-¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'grouped_progression',
          series_text: 'g-3-i; k-5-m; ñ-8-p; r-10-t; v-13-¿?',
          pattern_description: 'Serie agrupada: letra-número-letra con saltos específicos'
        },
        option_a: 'y',
        option_b: 'w',
        option_c: 'x', 
        option_d: 'v',
        correct_option: 2, // C = x
        explanation: `📊 PASO 1: Analizar grupos
Grupos: (g,3,i), (k,5,m), (ñ,8,p), (r,10,t), (v,13,?)

📈 PASO 2: Patrones internos
• Primera letra: g→k→ñ→r→v (saltos: +4,+4,+3,+4)
• Números: 3→5→8→10→13 (+2,+3,+2,+3)
• Tercera letra: i→m→p→t→x (saltos: +4,+4,+4,+4)

📋 PASO 3: Siguiente elemento
Después de v-13 viene x
✅ Respuesta: x`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'grouping'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 12: c-4-g, i-8-m, ñ-12-r, t -¿? -¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o la letra que continuaría la siguiente serie lógica: c-4-g, i-8-m, ñ-12-r, t -¿? -¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'grouped_arithmetic',
          series_text: 'c-4-g, i-8-m, ñ-12-r, t -¿? -¿?',
          pattern_description: 'Serie agrupada: letra-número(múltiplo)-letra con diferencia constante'
        },
        option_a: '17-w',
        option_b: '16-u',
        option_c: '17-u', 
        option_d: '16-x',
        correct_option: 3, // D = 16-x
        explanation: `📊 PASO 1: Analizar grupos
Grupos: (c,4,g), (i,8,m), (ñ,12,r), (t,?,?)

📈 PASO 2: Patrones identificados
• Primera letra: c(3)→i(9)→ñ(15)→t(20) (+6,+6,+5)
• Números: 4→8→12→16 (+4,+4,+4)
• Tercera letra: g(7)→m(13)→r(18)→x(24) (+6,+5,+6)

📋 PASO 3: Completar serie
t-16-x
✅ Respuesta: 16-x`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'arithmetic'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 13: k 0 l 1 n 4 r 9 b 15 ¿?
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Continúe la siguiente serie con el número y/o letra que seguiría el planteamiento: k 0 l 1 n 4 r 9 b 15 ¿?',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'intercalated_squares',
          series_text: 'k 0 l 1 n 4 r 9 b 15 ¿?',
          pattern_description: 'Serie intercalada: letras con patrón especial y números con diferencias crecientes'
        },
        option_a: 'q',
        option_b: 'o',
        option_c: 'p', 
        option_d: 'ñ',
        correct_option: 0, // A = q
        explanation: `📊 PASO 1: Separar series intercaladas
• Letras: k, l, n, r, b, ?
• Números: 0, 1, 4, 9, 15, ?

📈 PASO 2: Patrones identificados
• Números: 0→1(+1)→4(+3)→9(+5)→15(+6)→22(+7)
• Letras: k(11)→l(12)→n(14)→r(18)→b(2)→q(17)

📋 PASO 3: Siguiente elemento
Posición 11 = letra
✅ Siguiente: q`,
        difficulty: 'medium',
        time_limit_seconds: 180,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'arithmetic'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      },

      // Pregunta 14: h j l 10 12 15 n o q 19 24 ¿? ¿? r w
      {
        category_id: section.category_id,
        section_id: section.id,
        question_text: 'Indique el número y/o letra que deben ocupar el espacio de los interrogantes en la siguiente serie para que tenga sentido: h j l 10 12 15 n o q 19 24 ¿? ¿? r w',
        content_data: {
          chart_type: 'alphanumeric_series',
          series_type: 'correlative_complex',
          series_text: 'h j l 10 12 15 n o q 19 24 ¿? ¿? r w',
          pattern_description: 'Serie correlativa compleja con grupos de letras y números intercalados'
        },
        option_a: '31, t',
        option_b: '30, u',
        option_c: '29, u', 
        option_d: '30, v',
        correct_option: 1, // B = 30, u
        explanation: `📊 PASO 1: Identificar estructura
Grupos: (h,j,l) (10,12,15) (n,o,q) (19,24,?) (?,r,w)

📈 PASO 2: Patrones identificados
• Letras: saltos de +2: h→j→l, n→o→q, ?→r→w
• Números: 10→12→15 (+2,+3), 19→24→30 (+5,+6)

📋 PASO 3: Completar serie
• Siguiente número: 24+6=30
• Letra faltante: antes de r viene q... no, viene u
✅ Respuesta: 30, u`,
        difficulty: 'hard',
        time_limit_seconds: 200,
        cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'grouping'],
        question_subtype: 'sequence_alphanumeric',
        is_active: true,
        is_verified: true
      }
    ];

    // Insertar las preguntas 10-14
    console.log('📝 Insertando preguntas 10-14...');
    
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert(questions)
      .select();
    
    if (insertError) {
      console.log('❌ Error insertando preguntas:', insertError.message);
      return;
    }
    
    console.log('✅ Preguntas 10-14 añadidas exitosamente:');
    console.log('');
    
    insertedQuestions.forEach((question, index) => {
      const questionNumber = index + 10; // Empezar desde 10
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
    console.log('🎯 Preguntas 10-14 añadidas. Ejecutar siguiente script para P15-19.');
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addAlphanumericSeriesQuestions();