import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addCompraMultipleProductosDescuentosQuestion() {
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
      question_text: 'Si una persona compra 3 kg de angulas, 2 y medio de gambas, 5 de mejillones y 200 gramos de percebes, ¿cuánto pagará?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'MERCADO DE NAVIDAD - COMPRA MÚLTIPLE CON DESCUENTOS',
        question_context: 'Calcula el precio total de la compra múltiple aplicando descuentos cuando corresponda:',
        tables: [
          {
            title: 'Mercado de productos navideños',
            headers: ['ARTÍCULO', 'KG EN VENTA', 'PRECIO POR KG', 'DESCUENTO'],
            rows: [
              ['GAMBAS', '56', '62,5', '30%'],
              ['PERCEBES', '32', '114', '15%'],
              ['ANGULAS', '12', '820', '20%'],
              ['MEJILLONES', '77', '12', '5%']
            ],
            highlighted_columns: [2, 3], // Resaltar precio y descuento
            footer_note: 'Condición: Si compra más de medio kilo se aplica el descuento correspondiente'
          }
        ],
        operation_type: 'complex_multi_product_discount',
        evaluation_description: 'Capacidad de calcular precios múltiples con diferentes descuentos y condiciones',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de cálculo comercial complejo con múltiples productos y descuentos. Evalúa la habilidad para aplicar diferentes porcentajes de descuento según condiciones específicas."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Calcular precio angulas\n• 3 kg × 820€/kg = 2460€ (base)\n• >0,5kg → Descuento 20%: 2460€ × 0,20 = 492€\n• Precio final: 2460€ - 492€ = 1968€\n\n📋 PASO 2: Calcular precio gambas\n• 2,5 kg × 62,5€/kg = 156,25€ (base)\n• >0,5kg → Descuento 30%: 156,25€ × 0,30 = 46,875€\n• Precio final: 156,25€ - 46,875€ = 109,375€\n\n🔢 PASO 3: Calcular precio mejillones\n• 5 kg × 12€/kg = 60€ (base)\n• >0,5kg → Descuento 5%: 60€ × 0,05 = 3€\n• Precio final: 60€ - 3€ = 57€\n\n💰 PASO 4: Calcular precio percebes\n• 0,2 kg × 114€/kg = 22,8€ (base)\n• <0,5kg → Sin descuento: 22,8€\n\n✅ PASO 5: Sumar totales\n• 1968€ + 109,375€ + 57€ + 22,8€ = 2157,175€ ≈ 2157,20€"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Verificar condiciones\n• Angulas 3kg, Gambas 2,5kg, Mejillones 5kg → Con descuento\n• Percebes 0,2kg → Sin descuento\n\n📊 Método 2: Cálculo por bloques\n• Productos caros con descuento: Angulas ~1970€\n• Productos medios: Gambas ~110€, Mejillones ~57€\n• Productos baratos: Percebes ~23€\n• Total aproximado: ~2160€\n\n💰 Método 3: Estimación y refinamiento\n• Angulas domina el precio (>90% del total)\n• Otros productos suman ~190€\n• Total: 1968€ + 190€ ≈ 2158€"
          }
        ]
      },
      option_a: '2557,80 euros',
      option_b: '2000 euros', 
      option_c: '1157,20 euros',
      option_d: '2157,20 euros',
      correct_option: 3, // D - 2157,20 euros
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de compra múltiple productos con descuentos...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de compra múltiple con descuentos añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c);
    console.log('   D)', data[0].option_d, '← CORRECTA');
    console.log('✅ Respuesta correcta: 2157,20€ (1968€+109,375€+57€+22,8€)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addCompraMultipleProductosDescuentosQuestion();