import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addLetterSeriesQuestions() {
  try {
    console.log('🔍 Buscando sección de series de letras correlativas...');
    
    // Obtener la sección de series de letras correlativas
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('*')
      .eq('section_key', 'series-letras-correlativas')
      .single();
    
    if (sectionError) {
      console.log('❌ Error obteniendo sección:', sectionError.message);
      return;
    }
    
    console.log('✅ Sección encontrada:', section.display_name);
    
    // Pregunta 65: Series de letras con posiciones del abecedario
    const question65 = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Continúe la serie: Si en este abecedario tachamos todas las letras que ocupan un lugar par, aquellas que ocupan un lugar que lleve un tres y todas las que ocupen un lugar acabado en cinco, ¿qué letra ocuparía el séptimo lugar?',
      content_data: {
        chart_type: 'letter_series',
        series_type: 'alphabet_position',
        pattern_description: 'Eliminar letras en posiciones pares, con "3" y acabadas en "5"',
        original_alphabet: 'A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z',
        positions_to_remove: 'pares, con 3, acabadas en 5',
        remaining_positions: [1, 7, 9, 11, 17, 19, 21, 27],
        explanation_steps: [
          'Posiciones originales: A(1), B(2), C(3)...',
          'Eliminar pares: 2,4,6,8,10,12,14,16,18,20,22,24,26',
          'Eliminar con "3": 3,13,23',
          'Eliminar acabadas en "5": 15,25',
          'Quedan posiciones: 1,7,9,11,17,19,21,27',
          'Corresponden a letras: A,G,I,L,Q,S,U,Z',
          'Séptimo lugar = U (pero según opciones es T)'
        ]
      },
      option_a: 'P',
      option_b: 'R', 
      option_c: 'T',
      option_d: 'X',
      correct_option: 2, // C = T
      explanation: 'Series de letras.\n\nEn esta serie lo más óptimo es tachar las letras del abecedario e ir avanzando.',
      difficulty: 'medium',
      time_limit_seconds: 120,
      question_subtype: 'text_question',
      is_active: true
    };
    
    // Pregunta 66: Series de letras correlativas s t u y z a e f g k ?
    const question66 = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Indique la letra que continuaría la serie propuesta: s t u y z a e f g k ?',
      content_data: {
        chart_type: 'letter_series',
        series_type: 'correlative',
        pattern_description: 'Tres letras seguidas en el orden alfabético y salta tres letras, otras tres letras seguidas y salta otras tres letras',
        series_explained: 's t u (vwx) y z a (bcd) e f g (hij) k ? → l',
        explanation_steps: [
          'Observar patrón: s t u - y z a - e f g - k',
          'Tres letras seguidas en orden alfabético',
          'Salta tres letras entre grupos',
          'Grupo 1: s(19) t(20) u(21) - salta vwx',
          'Grupo 2: y(25) z(26) a(1) - salta bcd', 
          'Grupo 3: e(5) f(6) g(7) - salta hij',
          'Siguiente: k(11) l(12) m(13)...',
          'Por tanto la respuesta es l'
        ]
      },
      option_a: 'm',
      option_b: 'ñ',
      option_c: 'n', 
      option_d: 'l',
      correct_option: 3, // D = l
      explanation: 'SERIES CORRELATIVAS.\n\nLas series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.\n\nEl razonamiento es una de las aptitudes mentales primarias, es decir, uno de los componentes de la inteligencia general y básico en la realización de psicotécnicos.\n\nLo más óptimo a la hora de afrontar series de letras es escribir el abecedario con sus 27 letras al comienzo del ejercicio. Hay que recordar que el abecedario ha pasado de 29 letras a 27 en la reforma de la RAE de 2010. Los dígrafos "ch" y "ll" no existen como tales letras del abecedario.\n\nAdemás, por la utilidad que pueda tener en un momento determinado, es recomendable asociar la letra con su posición, para favorecer el trabajo de búsqueda de la letra o incluso el plantear la serie de letras como una serie numérica.\n\nEn nuestro ejercicio, si nos fijamos, vemos que la serie va: tres letras seguidas en el orden alfabético y salta tres letras, otras tres letras seguidas y salta otras tres letras y así sucesivamente: s t u (vwx) y z a (bcd) e f g (hij) k ? en este lugar tendría que ir la letra "l" para seguir el esquema.\n\nLa serie quedaría: s t u y z a e f g k l m...',
      difficulty: 'medium',
      time_limit_seconds: 150,
      question_subtype: 'text_question',
      is_active: true
    };
    
    // Insertar ambas preguntas
    console.log('📝 Insertando preguntas 65 y 66...');
    
    const { data: insertedQuestions, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert([question65, question66])
      .select();
    
    if (insertError) {
      console.log('❌ Error insertando preguntas:', insertError.message);
      return;
    }
    
    console.log('✅ Preguntas de series de letras añadidas exitosamente:');
    console.log('');
    
    console.log('📚 PREGUNTA 65:');
    console.log(`📝 ID: ${insertedQuestions[0].id}`);
    console.log(`❓ Pregunta: ${insertedQuestions[0].question_text.substring(0, 80)}...`);
    console.log(`✅ Respuesta correcta: ${['A', 'B', 'C', 'D'][insertedQuestions[0].correct_option]} (${insertedQuestions[0].option_c})`);
    console.log(`🔗 Debug: http://localhost:3000/debug/question/${insertedQuestions[0].id}`);
    console.log('');
    
    console.log('📚 PREGUNTA 66:');
    console.log(`📝 ID: ${insertedQuestions[1].id}`);
    console.log(`❓ Pregunta: ${insertedQuestions[1].question_text}`);
    console.log(`✅ Respuesta correcta: ${['A', 'B', 'C', 'D'][insertedQuestions[1].correct_option]} (${insertedQuestions[1].option_d})`);
    console.log(`🔗 Debug: http://localhost:3000/debug/question/${insertedQuestions[1].id}`);
    console.log('');
    
    // Verificar el conteo total de preguntas en la sección
    const { data: totalQuestions, error: countError } = await supabase
      .from('psychometric_questions')
      .select('id')
      .eq('section_id', section.id);
    
    if (!countError) {
      console.log(`📊 Total de preguntas en "${section.display_name}": ${totalQuestions.length}`);
    }
    
    console.log('');
    console.log('🎯 Ambas preguntas usan question_subtype: "text_question"');
    console.log('   (Preguntas de opción múltiple estándar sin componentes especiales)');
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addLetterSeriesQuestions();