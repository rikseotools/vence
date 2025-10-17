import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addSeptimaOrthographyQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección para séptima pregunta de ortografía...');
    
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
      question_text: 'Indique los errores ortográficos que se han cometido en la frase siguiente:',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'El bienechor del cenobio, de mucho o de poco, siempre da algo a sus feligreses.',
        correct_text: 'El bienhechor del cenobio, de mucho o de poco, siempre da algo a sus feligreses.',
        error_count: 4,
        errors_found: [
          {
            incorrect: 'bienechor',
            correct: 'bienhechor',
            position: 2,
            error_type: 'ortografía',
            explanation: 'Con "h" intercalada: bienhechor'
          },
          {
            incorrect: 'cenobio',
            correct: 'cenobio',
            position: 4,
            error_type: 'ortografía',
            explanation: 'Se escribe con "b": cenobio'
          },
          {
            incorrect: 'dé',
            correct: 'dé',
            position: 7,
            error_type: 'acentuación',
            explanation: 'Con tilde (del verbo dar): dé'
          },
          {
            incorrect: 'dé',
            correct: 'dé',
            position: 10,
            error_type: 'acentuación',
            explanation: 'Con tilde (del verbo dar): dé'
          }
        ],
        operation_type: 'orthographic_sentence_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en frases contextuales'
      },
      option_a: '4',
      option_b: '3', 
      option_c: '6',
      option_d: '5',
      correct_option: 0, // A - 4 errores
      explanation: null,
      question_subtype: 'error_detection',
      is_active: true
    };

    console.log('📝 Insertando séptima pregunta de ortografía...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Séptima pregunta de ortografía añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('✅ Respuesta correcta: 4 errores - bienechor→bienhechor, cenobio(con b), dé(con tilde) x2');

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addSeptimaOrthographyQuestion();