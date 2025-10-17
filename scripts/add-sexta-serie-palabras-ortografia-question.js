import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addSextaOrthographyQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección para sexta pregunta de ortografía...');
    
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'capacidad-ortografica')
      .single();

    if (categoryError || !category) {
      console.error('❌ Error al buscar categoría:', categoryError);
      return;
    }

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

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: '¿Cuántos errores ortográficos se han cometido al transcribir la siguiente frase?',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'El hermitaño habita en la hermita situada en la ribera del arrollo.',
        correct_text: 'El ermitaño habita en la ermita situada en la ribera del arroyo.',
        error_count: 4,
        errors_found: [
          {
            incorrect: 'hermitaño',
            correct: 'ermitaño',
            position: 2,
            error_type: 'ortografía',
            explanation: 'Sin "h": ermitaño'
          },
          {
            incorrect: 'hermita',
            correct: 'ermita',
            position: 6,
            error_type: 'ortografía', 
            explanation: 'Sin "h": ermita'
          },
          {
            incorrect: 'ribera',
            correct: 'ribera',
            position: 10,
            error_type: 'ortografía',
            explanation: 'Se escribe con "b": ribera (orilla del mar)'
          },
          {
            incorrect: 'arrollo',
            correct: 'arroyo',
            position: 13,
            error_type: 'ortografía',
            explanation: 'Se escribe con "y": arroyo'
          }
        ],
        operation_type: 'orthographic_sentence_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en frases contextuales'
      },
      option_a: '6',
      option_b: '5', 
      option_c: '3',
      option_d: '4',
      correct_option: 3, // D - 4 errores
      explanation: null,
      question_subtype: 'error_detection',
      is_active: true
    };

    console.log('📝 Insertando sexta pregunta de ortografía...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Sexta pregunta de ortografía añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('✅ Respuesta correcta: 4 errores - hermitaño→ermitaño, hermita→ermita, ribera(con b), arrollo→arroyo');

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addSextaOrthographyQuestion();