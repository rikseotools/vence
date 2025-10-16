import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addDiferenciaMedallasBroncePlataQuestion() {
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
      question_text: 'Indique, qué país de la tabla, tiene la mayor diferencia entre medallas de bronce y medallas de plata:',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'MEDALLAS OLÍMPICAS POR PAÍS - ANÁLISIS COMPARATIVO',
        question_context: 'Calcula la diferencia entre medallas de bronce y plata para cada país:',
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
            highlighted_columns: [4, 5], // Resaltar Plata y Bronce
            footer_note: 'Calcular: |Bronce - Plata| para cada país'
          }
        ],
        operation_type: 'difference_calculation',
        evaluation_description: 'Capacidad de calcular diferencias absolutas entre dos columnas numéricas y comparar resultados entre múltiples filas',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de cálculo comparativo en tablas. Evalúa la habilidad para realizar operaciones de diferencia absoluta entre columnas y comparar resultados para determinar el valor máximo."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar columnas relevantes\n• Plata: columna 5\n• Bronce: columna 6\n• Calcular diferencia absoluta |Bronce - Plata|\n\n📋 PASO 2: Calcular diferencias por país\n• Alemania: |291 - 267| = 24\n• Francia: |285 - 256| = 29 ✅\n• España: |49 - 72| = 23\n• Italia: |215 - 195| = 20\n• Grecia: |41 - 45| = 4\n\n🏆 PASO 3: Comparar resultados\n• Francia tiene la mayor diferencia: 29\n• Alemania segundo con 24\n• España tercero con 23"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo mental directo\n• Alemania: 291-267 = 24\n• Francia: 285-256 = 29 (claramente el mayor)\n• No necesitas calcular todos si Francia ya supera claramente\n\n📊 Método 2: Estimación rápida\n• Francia: ~285-~255 = ~30\n• Alemania: ~290-~270 = ~20\n• Francia será el mayor\n\n💰 Método 3: Identificación visual\n• Buscar países con números altos en ambas columnas\n• Francia y Alemania son candidatos\n• Calcular solo estos dos para comparar"
          }
        ]
      },
      option_a: 'Francia',
      option_b: 'Italia', 
      option_c: 'Alemania',
      option_d: 'España',
      correct_option: 0, // A - Francia (diferencia de 29)
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de diferencia medallas...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de diferencia medallas añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a, '← CORRECTA');
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: Francia (|285-256| = 29)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addDiferenciaMedallasBroncePlataQuestion();