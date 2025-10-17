import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addTerceraSeriePalabrasOrtografiaQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección para tercera pregunta de serie de palabras...');
    
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'capacidad-ortografica')
      .single();

    if (categoryError || !category) {
      console.error('❌ Error al buscar categoría:', categoryError);
      return;
    }

    console.log('✅ Categoría encontrada:', category.display_name);

    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id)
      .eq('section_key', 'ortografia')
      .single();

    if (sectionError || !section) {
      console.error('❌ Error al buscar sección:', sectionError);
      return;
    }

    console.log('✅ Sección encontrada:', section.display_name);

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: '¿Cuántos errores ortográficos se han cometido en la siguiente serie de palabras?',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'gérmenes, agüja, aya, rivera, vácilo, verdaz, honda, enhebrar, ojear, hojear.',
        correct_text: 'gérmenes, aguja, aya, rivera, vacilo, verdad, honda, enhebrar, ojear, hojear.',
        error_count: 4,
        errors_found: [
          {
            incorrect: 'gérmenes',
            correct: 'gérmenes',
            position: 1,
            error_type: 'acentuación',
            explanation: 'El acento en la primera "e": gérmenes'
          },
          {
            incorrect: 'agüja',
            correct: 'aguja',
            position: 2,
            error_type: 'diéresis', 
            explanation: 'No lleva diéresis: aguja'
          },
          {
            incorrect: 'vácilo',
            correct: 'vacilo',
            position: 5,
            error_type: 'acentuación',
            explanation: 'No lleva acento: vacilo'
          },
          {
            incorrect: 'verdaz',
            correct: 'verdad',
            position: 6,
            error_type: 'ortografía',
            explanation: 'Termina en "d": verdad'
          }
        ],
        operation_type: 'orthographic_word_series_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en una serie de palabras aisladas'
      },
      option_a: '4',
      option_b: '6', 
      option_c: '7',
      option_d: '5',
      correct_option: 0, // A - 4 errores
      explanation: null,
      question_subtype: 'error_detection',
      is_active: true
    };

    console.log('📝 Insertando tercera pregunta de serie de palabras ortográficas...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Tercera pregunta de serie de palabras ortográficas añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a, '← CORRECTA');
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 4 errores ortográficos');
    console.log('📝 Errores: gérmenes(acento primera e), agüja→aguja(sin diéresis), vácilo→vacilo(sin acento), verdaz→verdad(termina en d)');

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addTerceraSeriePalabrasOrtografiaQuestion();