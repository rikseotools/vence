import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addQuintaOrthographyQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección para quinta pregunta de ortografía...');
    
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
      question_text: '¿Cuántos errores ortográficos se han cometido en la siguiente frase?',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'El tahur utilizo un as que llevaba en la vocamanga de la lebita.',
        correct_text: 'El tahúr utilizó un has que llevaba en la bocamanga de la levita.',
        error_count: 5,
        errors_found: [
          {
            incorrect: 'tahur',
            correct: 'tahúr',
            position: 2,
            error_type: 'acentuación',
            explanation: 'Lleva tilde: tahúr'
          },
          {
            incorrect: 'utilizo',
            correct: 'utilizó',
            position: 3,
            error_type: 'acentuación', 
            explanation: 'Lleva tilde: utilizó'
          },
          {
            incorrect: 'as',
            correct: 'has',
            position: 5,
            error_type: 'ortografía',
            explanation: 'Con "h" (verbo haber): has'
          },
          {
            incorrect: 'vocamanga',
            correct: 'bocamanga',
            position: 9,
            error_type: 'ortografía',
            explanation: 'Se escribe con "b": bocamanga'
          },
          {
            incorrect: 'lebita',
            correct: 'levita',
            position: 12,
            error_type: 'ortografía',
            explanation: 'Se escribe con "v": levita'
          }
        ],
        operation_type: 'orthographic_sentence_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en frases contextuales'
      },
      option_a: '5',
      option_b: '4', 
      option_c: '6',
      option_d: '7',
      correct_option: 0, // A - 5 errores
      explanation: null,
      question_subtype: 'error_detection',
      is_active: true
    };

    console.log('📝 Insertando quinta pregunta de ortografía...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Quinta pregunta de ortografía añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('✅ Respuesta correcta: 5 errores - tahur→tahúr, utilizo→utilizó, as→has, vocamanga→bocamanga, lebita→levita');

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addQuintaOrthographyQuestion();