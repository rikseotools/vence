import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addProyeccionPoblacionSimpleQuestion() {
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
      question_text: 'Si la población de Montoro aumenta un 10% respecto a 2020, ¿qué número de habitantes tendrá en 2024?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'PROYECCIÓN DEMOGRÁFICA - CRECIMIENTO POBLACIONAL',
        question_context: 'Calcula la proyección poblacional con el incremento porcentual:',
        tables: [
          {
            title: 'Datos de población en municipios y CCAA de España',
            headers: ['Municipios', 'Nº hab. 2020', 'Nº hab. 2019', 'Diferencia (±)', 'CCAA pertenece', 'Población de la CCAA'],
            rows: [
              ['Medina del Campo', '20416', '20510', '94', 'Castilla y León', '2.383.702'],
              ['Coslada', '81391', '81661', '270', 'C. de Madrid', '6.917.111'],
              ['Muros', '8427', '8506', '129', 'Galicia', '2.699.938'],
              ['Montoro', '9000', '9100', '100', 'Andalucía', '8.600.224'],
              ['Membrilla', '5942', '6005', '63', 'Castilla La Mancha', '2.089.074']
            ],
            highlighted_columns: [1], // Resaltar Nº hab. 2020
            highlighted_rows: [3], // Resaltar Montoro
            footer_note: 'Calcular: Población 2020 + (Población 2020 × 10%)'
          }
        ],
        operation_type: 'percentage_increase',
        evaluation_description: 'Capacidad de aplicar aumentos porcentuales a datos demográficos base',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de cálculo de proyecciones demográficas. Evalúa la habilidad para aplicar incrementos porcentuales simples a datos de población base."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar datos de Montoro\n• Población 2020: 9.000 habitantes\n• Incremento proyectado: 10%\n\n📋 PASO 2: Calcular el aumento\n• 10% de 9.000 = 9.000 × 0,10 = 900 habitantes\n• Incremento: 900 habitantes\n\n🔢 PASO 3: Sumar población base + incremento\n• Población 2020: 9.000 habitantes\n• Incremento 10%: 900 habitantes\n• Población 2024: 9.000 + 900 = 9.900 habitantes ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo mental directo\n• 10% de 9.000 = 900\n• 9.000 + 900 = 9.900\n\n📊 Método 2: Factor multiplicativo\n• Aumento 10% = multiplicar por 1,10\n• 9.000 × 1,10 = 9.900\n\n💰 Método 3: Cálculo por partes\n• 9.000 × 0,10 = 900 (el aumento)\n• 9.000 + 900 = 9.900 (total proyectado)"
          }
        ]
      },
      option_a: '9.500 habitantes',
      option_b: '9.800 habitantes', 
      option_c: '9.900 habitantes',
      option_d: '10.000 habitantes',
      correct_option: 2, // C - 9.900 habitantes
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de proyección población simplificada...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de proyección población simplificada añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 9.900 habitantes (9.000 + 900)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addProyeccionPoblacionSimpleQuestion();