import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addOctavaOrthographyQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección para octava pregunta de ortografía...');
    
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
      question_text: 'Señale la cantidad de errores ortográficos cometidos en la siguiente frase:',
      content_data: {
        chart_type: 'error_detection',
        original_text: 'Deberíamos errar ésa yegua zaina antes de que venga éste a recogerla junto a la vaya del cercado.',
        correct_text: 'Deberíamos herrar esa yegua zaina antes de que venga este a recogerla junto a la valla del cercado.',
        error_count: 5,
        errors_found: [
          {
            incorrect: 'errar',
            correct: 'herrar',
            position: 2,
            error_type: 'ortografía',
            explanation: 'Con "h" (poner herraduras): herrar'
          },
          {
            incorrect: 'ésa',
            correct: 'esa',
            position: 3,
            error_type: 'acentuación',
            explanation: 'Sin tilde: esa'
          },
          {
            incorrect: 'éste',
            correct: 'este',
            position: 10,
            error_type: 'acentuación',
            explanation: 'Sin tilde: este'
          },
          {
            incorrect: 'vaya',
            correct: 'valla',
            position: 16,
            error_type: 'ortografía',
            explanation: 'Con "ll" (muro, barrera): valla'
          }
        ],
        operation_type: 'orthographic_sentence_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en frases contextuales'
      },
      option_a: '3',
      option_b: '5', 
      option_c: '4',
      option_d: '6',
      correct_option: 1, // B - 5 errores
      explanation: null,
      question_subtype: 'error_detection',
      is_active: true
    };

    console.log('📝 Insertando octava pregunta de ortografía...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Octava pregunta de ortografía añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('✅ Respuesta correcta: 5 errores - errar→herrar, ésa→esa, éste→este, vaya→valla');

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addOctavaOrthographyQuestion();