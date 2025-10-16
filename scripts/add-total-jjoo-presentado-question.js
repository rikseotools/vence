import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addTotalJJOOPresentadoQuestion() {
  try {
    console.log('🔍 Buscando categoría y sección...');
    
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'capacidad-administrativa')
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
      .eq('section_key', 'tablas')
      .single();

    if (sectionError || !section) {
      console.error('❌ Error al buscar sección:', sectionError);
      return;
    }

    console.log('✅ Sección encontrada:', section.display_name);

    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: '¿Qué país tiene mayor cantidad total de JJ.OO a los que se ha presentado?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'PARTICIPACIÓN EN JUEGOS OLÍMPICOS POR PAÍS',
        question_context: 'Observa la tabla de participación en Juegos Olímpicos y calcula el total de participaciones:',
        tables: [
          {
            title: 'Participación y Medallas obtenidas - JJ.OO',
            headers: ['País', 'Participación JJ.OO verano', 'Participación JJ.OO invierno', 'Medallas obtenidas JJ.OO de verano', '', '', '', 'Total Medallas'],
            subheaders: ['', '', '', 'Oro', 'Plata', 'Bronce', ''],
            rows: [
              ['Alemania', '17', '12', '239', '267', '291', '797'],
              ['Francia', '29', '24', '231', '256', '285', '772'],
              ['España', '24', '21', '48', '72', '49', '169'],
              ['Italia', '28', '24', '222', '195', '215', '632'],
              ['Grecia', '29', '19', '36', '45', '41', '122']
            ],
            highlighted_columns: [1, 2], // Resaltar participación verano e invierno
            footer_note: 'Calcular: JJ.OO verano + JJ.OO invierno por país'
          }
        ],
        operation_type: 'sum_calculation',
        evaluation_description: 'Capacidad de sumar datos de diferentes columnas para cada fila y comparar totales entre países',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis comparativo en tablas. Evalúa la habilidad para realizar operaciones matemáticas simples (suma) en cada fila y comparar resultados entre diferentes países."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar las columnas relevantes\n• 'Participación JJ.OO verano'\n• 'Participación JJ.OO invierno'\n• Ignorar columnas de medallas\n\n📋 PASO 2: Calcular total por país\n• Alemania: 17 + 12 = 29\n• Francia: 29 + 24 = 53 ✅\n• España: 24 + 21 = 45\n• Italia: 28 + 24 = 52\n• Grecia: 29 + 19 = 48\n\n🏆 PASO 3: Comparar totales\n• Francia tiene 53 participaciones (el mayor)\n• Italia segundo con 52\n• Grecia tercero con 48"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma mental rápida\n• Alemania: 17+12 = 29\n• Francia: 29+24 = 53 (claramente el mayor)\n• No necesitas calcular el resto si Francia ya supera 50\n\n📊 Método 2: Identificación visual\n• Francia tiene números altos en ambas columnas (29, 24)\n• Comparar solo con países que tengan números similares\n\n💰 Método 3: Estimación rápida\n• Francia: ~30 + ~25 = ~55\n• Italia: ~30 + ~25 = ~55 (verificar exacto)\n• Francia gana por 1 participación"
          }
        ]
      },
      option_a: 'Italia',
      option_b: 'Grecia', 
      option_c: 'Francia',
      option_d: 'España',
      correct_option: 2, // C - Francia (53 total)
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de total JJ.OO...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de total JJ.OO añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: Francia (29 + 24 = 53 participaciones)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addTotalJJOOPresentadoQuestion();