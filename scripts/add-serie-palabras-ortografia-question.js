import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addSeriePalabrasOrtografiaQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección para pregunta de serie de palabras...');
    
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
      .eq('section_key', 'deteccion_errores')
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
        original_text: 'Avalorio, astemio, ambigüo, ecatombe, sobervia, bondaz, balloneta, heroísmo, ganzúa, ipotálamo.',
        correct_text: 'Abalorio, abstemio, ambiguo, hecatombe, soberbia, bondad, bayoneta, heroísmo, ganzúa, hipotálamo.',
        error_count: 8,
        errors_found: [
          {
            incorrect: 'Avalorio',
            correct: 'Abalorio',
            position: 1,
            error_type: 'ortografía',
            explanation: 'Se escribe con "b": abalorio'
          },
          {
            incorrect: 'astemio',
            correct: 'abstemio',
            position: 2,
            error_type: 'ortografía', 
            explanation: 'Se escribe con "b": abstemio'
          },
          {
            incorrect: 'ambigüo',
            correct: 'ambiguo',
            position: 3,
            error_type: 'diéresis',
            explanation: 'No lleva diéresis: ambiguo'
          },
          {
            incorrect: 'ecatombe',
            correct: 'hecatombe',
            position: 4,
            error_type: 'ortografía',
            explanation: 'Se escribe con "h": hecatombe'
          },
          {
            incorrect: 'sobervia',
            correct: 'soberbia',
            position: 5,
            error_type: 'ortografía',
            explanation: 'Se escribe con "b": soberbia'
          },
          {
            incorrect: 'bondaz',
            correct: 'bondad',
            position: 6,
            error_type: 'ortografía',
            explanation: 'Termina en "d": bondad'
          },
          {
            incorrect: 'balloneta',
            correct: 'bayoneta',
            position: 7,
            error_type: 'ortografía',
            explanation: 'Se escribe con "y": bayoneta'
          },
          {
            incorrect: 'ipotálamo',
            correct: 'hipotálamo',
            position: 10,
            error_type: 'ortografía',
            explanation: 'Se escribe con "h": hipotálamo'
          }
        ],
        operation_type: 'orthographic_word_series_count',
        evaluation_description: 'Capacidad de identificar errores ortográficos en una serie de palabras aisladas'
      },
      option_a: '8',
      option_b: '7', 
      option_c: '6',
      option_d: '9',
      correct_option: 0, // A - 8 errores
      explanation: null,
      question_subtype: 'error_detection',
      is_active: true
    };

    console.log('📝 Insertando pregunta de serie de palabras ortográficas...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de serie de palabras ortográficas añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a, '← CORRECTA');
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 8 errores ortográficos');
    console.log('📝 Errores: Avalorio→Abalorio, astemio→abstemio, ambigüo→ambiguo, ecatombe→hecatombe, sobervia→soberbia, bondaz→bondad, balloneta→bayoneta, ipotálamo→hipotálamo');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addSeriePalabrasOrtografiaQuestion();