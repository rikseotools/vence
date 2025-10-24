import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAlphanumericSeriesQuestion() {
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
    
    // Pregunta 01: Serie alfanumérica cíclica 8 h 10 k 7 n 9 p 6 s ¿?
    const question01 = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: 'Indique la letra o número que seguiría el planteamiento de la siguiente serie: 8 h 10 k 7 n 9 p 6 s ¿?',
      content_data: {
        chart_type: 'alphanumeric_series',
        series_type: 'cyclic',
        series_text: '8 h 10 k 7 n 9 p 6 s ¿?',
        pattern_description: 'Series cíclicas: combinación de correlativas e intercaladas',
        explanation_steps: [
          'Analizar las dos series intercaladas por separado',
          'Serie numérica (posiciones 1,3,5,7,9,11): 8, 10, 7, 9, 6, ?',
          'Serie de letras (posiciones 2,4,6,8,10,12): h, k, n, p, s, ?',
          'Serie numérica: +2, -3, +2, -3, +2 = 8',
          'Serie de letras: +3, +3, +2, +3 = t',
          'Respuesta: 8 (porque la pregunta pide número O letra, y el siguiente es número)'
        ],
        solution_method: 'cyclic_analysis'
      },
      option_a: 't',
      option_b: '9',
      option_c: 'v',
      option_d: '8',
      correct_option: 3, // D = 8
      explanation: `SERIES CÍCLICAS.

Las series de números y de letras están pensadas para descubrir la capacidad de razonamiento y análisis, por un lado, y factores mentales, por otro, ambos muy vinculados.

El razonamiento es una de las aptitudes mentales primarias, es decir, uno de los componentes de la inteligencia general y básico en la realización de psicotécnicos.

Este caso concreto sería una particularidad de las series lógicas, aquí nos encontramos con series donde se nos muestra la unión de números con letras.

Puede que, aunque el ejercicio nos den mezclados números y letras cada parte sea independiente y funcione con estructuras distintas o bien que exista una relación de los números con las letras o viceversa.

Nota importante: en este tipo de ejercicios lo primero que tenemos que hacer es ver si lo que nos piden, según la estructura de la serie, es un número o una letra, lógicamente para ir directamente a lo que nos interesa para contestar (número o letra) y descartando el otro planteamiento. Esto no quiere decir que no tengan una estructura lógica, tanto números como letras tienen que tener un planteamiento que explique la serie, aunque no la vayamos a utilizar para contestar el ejercicio.

En el caso de la parte numérica de la serie el tipo de operaciones que se pueden realizar son sumas, restas, multiplicaciones o incluso divisiones, siendo estas últimas menos probables. También pueden aparecer criterios basados en potencias (números elevados al cuadrado, al cubo...) y en el caso de las letras recordar que el abecedario consta de 27 letras y puede optimizar la realización del ejercicio anotarse dicho abecedario; además puede favorecer el trabajo el asociar la letra a su posición (A-1, B-2, C-3....X-25, Y-26, Z-27).

Las series cíclicas serían una combinación de correlativas e intercaladas.

En el ejercicio nos interesa la serie numérica: 8 +2 10 -3 7 +2 9 -3 6 correspondería ahora un +2, tendría que ser 8. Respuesta "8".`,
      difficulty: 'medium',
      time_limit_seconds: 180,
      cognitive_skills: ['pattern_recognition', 'logical_reasoning', 'alphanumeric_analysis'],
      question_subtype: 'sequence_alphanumeric',
      is_active: true,
      is_verified: true
    };
    
    // Insertar la pregunta
    console.log('📝 Insertando pregunta de serie alfanumérica...');
    
    const { data: insertedQuestion, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert([question01])
      .select();
    
    if (insertError) {
      console.log('❌ Error insertando pregunta:', insertError.message);
      return;
    }
    
    console.log('✅ Pregunta de serie alfanumérica añadida exitosamente:');
    console.log('');
    
    console.log('📚 PREGUNTA 01:');
    console.log(`📝 ID: ${insertedQuestion[0].id}`);
    console.log(`❓ Pregunta: ${insertedQuestion[0].question_text}`);
    console.log(`📊 Serie: 8 h 10 k 7 n 9 p 6 s ¿?`);
    console.log(`✅ Respuesta correcta: ${['A', 'B', 'C', 'D'][insertedQuestion[0].correct_option]} (${insertedQuestion[0].option_d})`);
    console.log(`🔧 Componente: ${insertedQuestion[0].question_subtype}`);
    console.log(`🔗 Debug: http://localhost:3000/debug/question/${insertedQuestion[0].id}`);
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
    console.log('🎯 La pregunta usa question_subtype: "sequence_alphanumeric"');
    console.log('   (Componente especializado SequenceAlphanumericQuestion.js)');
    
  } catch (error) {
    console.log('❌ Error general:', error.message);
  }
}

addAlphanumericSeriesQuestion();