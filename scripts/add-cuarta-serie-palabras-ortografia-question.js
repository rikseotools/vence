import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addCuartaSeriePalabrasOrtografiaQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección para cuarta pregunta de serie de palabras...');
    
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
      question_text: '¿Cuántos errores ortográficos se han cometido en total en la siguiente serie de palabras?',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'amnesia, torax, expectáculo, raíz, asfisia, aficción, espléndido, luxación.',
        correct_text: 'amnesia, tórax, espectáculo, raíz, asfixia, afección, espléndido, lujación.',
        error_count: 6,
        errors_found: [
          {
            incorrect: 'amnesia',
            correct: 'amnesia',
            position: 1,
            error_type: 'ortografía',
            explanation: 'Se escribe con "m": amnesia'
          },
          {
            incorrect: 'torax',
            correct: 'tórax',
            position: 2,
            error_type: 'acentuación', 
            explanation: 'Lleva tilde: tórax'
          },
          {
            incorrect: 'expectáculo',
            correct: 'espectáculo',
            position: 3,
            error_type: 'ortografía',
            explanation: 'Se escribe con "s": espectáculo'
          },
          {
            incorrect: 'raíz',
            correct: 'raíz',
            position: 4,
            error_type: 'acentuación',
            explanation: 'Lleva tilde: raíz'
          },
          {
            incorrect: 'asfisia',
            correct: 'asfixia',
            position: 5,
            error_type: 'ortografía',
            explanation: 'Se escribe con "x": asfixia'
          },
          {
            incorrect: 'espléndido',
            correct: 'espléndido',
            position: 7,
            error_type: 'acentuación',
            explanation: 'Lleva tilde: espléndido'
          }
        ],
        operation_type: 'orthographic_word_series_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en una serie de palabras aisladas'
      },
      option_a: '6',
      option_b: '8', 
      option_c: '5',
      option_d: '7',
      correct_option: 0, // A - 6 errores
      explanation: null,
      question_subtype: 'error_detection',
      is_active: true
    };

    console.log('📝 Insertando cuarta pregunta de serie de palabras ortográficas...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Cuarta pregunta de serie de palabras ortográficas añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a, '← CORRECTA');
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 6 errores ortográficos');
    console.log('📝 Errores: amnesia(con m), torax→tórax(falta tilde), expectáculo→espectáculo(con s), raíz(lleva tilde), asfisia→asfixia(con x), espléndido(llevaría tilde)');

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addCuartaSeriePalabrasOrtografiaQuestion();