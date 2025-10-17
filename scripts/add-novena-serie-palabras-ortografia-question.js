import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addNovenaOrthographyQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección para novena pregunta de ortografía...');
    
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
      question_text: 'En las siguientes oraciones algunas letras han sido sustituidas por un guion bajo ("_"). ¿En cuántas de las siguientes oraciones la letra que falta debería llevar tilde?',
      content_data: {
        chart_type: 'error_detection',
        original_text: '• ¿Para qu_ hablo si no me comprendes?\n• Mi madre fue la albac_a de la herencia.\n• Parecía haber olvidado lo sucedido el d_a anterior.\n• Sabía que cuando se quedara solo tendr_a que examinar el retrato.',
        correct_text: '• ¿Para qué hablo si no me comprendes?\n• Mi madre fue la albacea de la herencia.\n• Parecía haber olvidado lo sucedido el día anterior.\n• Sabía que cuando se quedara solo tendría que examinar el retrato.',
        error_count: 3,
        errors_found: [
          {
            incorrect: 'qu_',
            correct: 'qué',
            position: 1,
            error_type: 'acentuación',
            explanation: 'Lleva tilde (interrogativo): qué'
          },
          {
            incorrect: 'd_a',
            correct: 'día',
            position: 3,
            error_type: 'acentuación',
            explanation: 'Lleva tilde: día'
          },
          {
            incorrect: 'tendr_a',
            correct: 'tendría',
            position: 4,
            error_type: 'acentuación',
            explanation: 'Lleva tilde: tendría'
          }
        ],
        operation_type: 'orthographic_missing_accents_count',
        evaluation_description: 'Capacidad de identificar palabras que requieren acentuación'
      },
      option_a: '1',
      option_b: '3', 
      option_c: '2',
      option_d: '0',
      correct_option: 1, // B - 3 errores
      explanation: null,
      question_subtype: 'error_detection',
      is_active: true
    };

    console.log('📝 Insertando novena pregunta de ortografía...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Novena pregunta de ortografía añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('✅ Respuesta correcta: 3 errores - qué(interrogativo), día, tendría');

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addNovenaOrthographyQuestion();