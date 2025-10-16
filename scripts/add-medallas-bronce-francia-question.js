import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addMedallasBronceFranciaQuestion() {
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
      question_text: '¿Cuál sería la media de medallas de bronce obtenidas por Francia respecto a los JJ.OO de invierno en los que ha intervenido?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'MEDALLAS OLÍMPICAS POR PAÍS - JJ.OO VERANO E INVIERNO',
        question_context: 'Observa la siguiente tabla de participación y medallas olímpicas por país:',
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
            footer_note: 'Los datos de medallas mostrados corresponden únicamente a JJ.OO de verano'
          }
        ],
        operation_type: 'data_analysis',
        evaluation_description: 'Capacidad de análisis crítico de datos. Evalúa la habilidad para identificar información faltante y reconocer cuándo no es posible realizar un cálculo por falta de datos específicos',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis crítico y interpretación correcta de tablas de datos. Evalúa la habilidad para distinguir entre datos disponibles y datos faltantes, y reconocer cuándo no se puede realizar un cálculo."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar qué se solicita\n• Media de medallas de bronce de Francia\n• Específicamente en JJ.OO de invierno\n• Francia ha participado en 24 JJ.OO de invierno\n\n📋 PASO 2: Buscar los datos necesarios\n• La tabla muestra medallas de JJ.OO de verano solamente\n• Columna 'Bronce': 285 (pero es de verano, no invierno)\n• No hay datos de medallas de JJ.OO de invierno\n\n❌ PASO 3: Conclusión\n• Los datos de medallas son solo de verano\n• No se proporcionan datos de medallas de invierno\n• Por tanto: NO SE PUEDE CALCULAR ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Lectura cuidadosa del encabezado\n• Verificar qué datos proporciona la tabla\n• 'Medallas obtenidas JJ.OO de verano' (no invierno)\n• Si pide datos de invierno → No disponibles\n\n📊 Método 2: Identificación de información faltante\n• Francia: 24 participaciones en invierno\n• Pero medallas mostradas: solo de verano\n• Falta: datos específicos de medallas de invierno\n\n💰 Método 3: Reconocer opciones 'trampa'\n• Otras opciones dan números específicos\n• Pero sin datos de invierno, cualquier cálculo sería incorrecto\n• 'No se puede saber' es la respuesta lógica cuando faltan datos"
          }
        ]
      },
      option_a: '11,87',
      option_b: 'No se puede saber', 
      option_c: '9,82',
      option_d: '9,62',
      correct_option: 1, // B - No se puede saber
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de medallas de bronce Francia...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de medallas de bronce Francia añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b, '← CORRECTA');
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: No se puede saber (faltan datos de JJ.OO invierno)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addMedallasBronceFranciaQuestion();