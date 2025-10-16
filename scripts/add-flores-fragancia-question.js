import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addFloresFraganciaQuestion() {
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
      question_text: 'Según las tablas Flores, ¿cuál de estas flores con fragancia potente se ofrece en ramos de una docena y es pequeña?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'TABLAS FLORES - CARACTERÍSTICAS Y DISPONIBILIDAD',
        question_context: 'Consulta las siguientes tablas de flores para encontrar la que cumple todos los criterios solicitados:',
        tables: [
          {
            title: 'Características de las Flores',
            headers: ['Flor', 'Colores', 'Tipos de ramos (unidades)'],
            rows: [
              ['Margarita', 'blanco y amarillo', '3'],
              ['Rosa', 'blanco, amarillo y rosa', '6'],
              ['Clavel', 'amarillo y rosa', '3 y 6'],
              ['Salvia', 'rosa', '3, 6 y 12'],
              ['Crisantemo', 'blanco y rosa', '3, 6 y 12'],
              ['Tulipán', 'amarillo', '3, 6 y 12'],
              ['Cardo', 'blanco', '3'],
              ['Lirio', 'blanco y amarillo', '6'],
              ['Orquídea', 'blanco y rosa', '3, 6 y 12'],
              ['Gerbera', 'amarillo y rosa', '3 y 6']
            ]
          },
          {
            title: 'Información Comercial',
            headers: ['Flor', 'Pétalos', 'Peso en gramos', 'Estambres', 'Precio por unidad'],
            rows: [
              ['Margarita', '2', '2', '2', '3'],
              ['Rosa', '4', '5', '4', '2'],
              ['Clavel', '3', '1', '6', '5'],
              ['Salvia', '1', '6', '3', '2'],
              ['Crisantemo', '4', '4', '6', '9'],
              ['Tulipán', '5', '5', '5', '4'],
              ['Cardo', '4', '1', '4', '5'],
              ['Lirio', '3', '5', '6', '4'],
              ['Orquídea', '4', '6', '8', '3'],
              ['Gerbera', '5', '1', '7', '5']
            ]
          },
          {
            title: 'Características Adicionales',
            headers: ['Flor', 'Fragancia potente', 'Entrega a domicilio', 'Disponible', 'En promoción', 'Duradera'],
            rows: [
              ['Margarita', 'NO', 'SI', 'NO', 'SI', 'SI'],
              ['Rosa', 'NO', 'NO', 'SI', 'SI', 'SI'],
              ['Clavel', 'SI', 'NO', 'NO', 'NO', 'NO'],
              ['Salvia', 'SI', 'SI', 'SI', 'SI', 'NO'],
              ['Crisantemo', 'NO', 'NO', 'SI', 'SI', 'NO'],
              ['Tulipán', 'SI', 'SI', 'NO', 'NO', 'SI'],
              ['Cardo', 'NO', 'NO', 'SI', 'SI', 'NO'],
              ['Lirio', 'SI', 'NO', 'NO', 'NO', 'SI'],
              ['Orquídea', 'NO', 'SI', 'SI', 'SI', 'NO'],
              ['Gerbera', 'SI', 'NO', 'SI', 'SI', 'NO']
            ]
          }
        ],
        operation_type: 'multiple_criteria_filter',
        evaluation_description: 'Capacidad de aplicar múltiples filtros simultáneos en datos tabulares complejos, cruzando información de diferentes tablas',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de análisis multitabla y aplicación de filtros múltiples. Evalúa la habilidad para cruzar información de diferentes tablas y aplicar varios criterios de selección simultáneamente."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Identificar los criterios\n• Fragancia potente: SI\n• Ramos de una docena (12 unidades): disponible\n• Tamaño pequeño: peso bajo\n\n📋 PASO 2: Filtrar por fragancia potente\n• Clavel: SI ✓\n• Salvia: SI ✓\n• Tulipán: SI ✓\n• Lirio: SI ✓\n• Gerbera: SI ✓\n\n🔢 PASO 3: Filtrar por ramos de 12\n• De las anteriores, buscar '12' en tipos de ramos:\n• Salvia: '3, 6 y 12' ✓\n• Tulipán: '3, 6 y 12' ✓\n\n⚖️ PASO 4: Filtrar por tamaño pequeño (peso)\n• Salvia: 6 gramos\n• Tulipán: 5 gramos\n• Solo Salvia cumple todos los criterios ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Eliminación por criterios\n• Descartar flores sin fragancia potente\n• De las restantes, descartar las que no tienen ramos de 12\n• De las finales, elegir la más pequeña\n\n📊 Método 2: Verificación directa\n• Ir a cada opción de respuesta\n• Verificar si cumple los 3 criterios\n• La primera que cumpla todos es la correcta\n\n💰 Método 3: Uso de tablas múltiples\n• Fragancia: Tabla 3\n• Ramos docena: Tabla 1\n• Tamaño pequeño: Tabla 2 (peso)\n• Cruzar datos de las 3 tablas"
          }
        ]
      },
      option_a: 'Tulipán',
      option_b: 'Margarita', 
      option_c: 'Salvia',
      option_d: 'Crisantemo',
      correct_option: 2, // C - Salvia
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de flores con fragancia...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de flores con fragancia añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: Salvia (fragancia potente + ramos de 12 + pequeña)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addFloresFraganciaQuestion();