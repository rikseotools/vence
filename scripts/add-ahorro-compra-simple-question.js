import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function addAhorroCompraSimpleQuestion() {
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
      question_text: 'Si una persona compra 2 kg de gambas y 1 kg de mejillones, ¿cuánto pagará en total aplicando los descuentos?',
      content_data: {
        chart_type: 'data_tables',
        chart_title: 'MERCADO DE NAVIDAD - PRECIOS Y DESCUENTOS',
        question_context: 'Calcula el precio total aplicando los descuentos correspondientes:',
        tables: [
          {
            title: 'Productos del mercado',
            headers: ['ARTÍCULO', 'KG EN VENTA', 'PRECIO POR KG', 'DESCUENTO'],
            rows: [
              ['GAMBAS', '50', '60', '20%'],
              ['PERCEBES', '30', '100', '10%'],
              ['ANGULAS', '10', '80', '15%'],
              ['MEJILLONES', '70', '10', '0%']
            ],
            highlighted_columns: [2, 3], // Resaltar precio y descuento
            highlighted_rows: [0, 3], // Resaltar GAMBAS y MEJILLONES
            footer_note: 'Si compra más de medio kilo se aplica el descuento correspondiente'
          }
        ],
        operation_type: 'price_calculation_with_discount',
        evaluation_description: 'Capacidad de calcular precios con descuentos aplicados en compras múltiples',
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de cálculo comercial con descuentos. Evalúa la habilidad para aplicar porcentajes de descuento y sumar precios finales de múltiples productos."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "🔍 PASO 1: Calcular precio gambas\n• 2 kg × 60€/kg = 120€ (precio base)\n• Descuento 20%: 120€ × 0,20 = 24€\n• Precio final gambas: 120€ - 24€ = 96€\n\n📋 PASO 2: Calcular precio mejillones\n• 1 kg × 10€/kg = 10€ (precio base)\n• Descuento 0%: sin descuento\n• Precio final mejillones: 10€\n\n🔢 PASO 3: Sumar totales\n• Gambas: 96€\n• Mejillones: 10€\n• Total: 96€ + 10€ = 106€ ✅"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Cálculo por pasos\n• Gambas: 2×60 = 120€, descuento 20% = 24€ → 96€\n• Mejillones: 1×10 = 10€, sin descuento → 10€\n• Total: 96+10 = 106€\n\n📊 Método 2: Descuento directo\n• Gambas con 20% descuento = 80% del precio\n• 120€ × 0,80 = 96€\n• Mejillones: 10€ (sin descuento)\n• Total: 106€\n\n💰 Método 3: Verificación mental\n• Gambas: ~120€ con ~20% descuento ≈ 96€\n• Mejillones: 10€\n• Total aproximado: ~106€"
          }
        ]
      },
      option_a: '110 euros',
      option_b: '100 euros', 
      option_c: '106 euros',
      option_d: '96 euros',
      correct_option: 2, // C - 106 euros
      explanation: null,
      question_subtype: 'data_tables',
      is_active: true
    };

    console.log('📝 Insertando pregunta de ahorro compra simplificada...');
    
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option');

    if (error) {
      console.error('❌ Error al insertar pregunta:', error);
      return;
    }

    console.log('✅ Pregunta de ahorro compra simplificada añadida exitosamente');
    console.log('📝 ID:', data[0].id);
    console.log('📊 Pregunta:', data[0].question_text);
    console.log('🎯 Opciones:');
    console.log('   A)', data[0].option_a);
    console.log('   B)', data[0].option_b);
    console.log('   C)', data[0].option_c, '← CORRECTA');
    console.log('   D)', data[0].option_d);
    console.log('✅ Respuesta correcta: 106 euros (96€ gambas + 10€ mejillones)');
    console.log('');
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:');
    console.log(`   http://localhost:3000/debug/question/${data[0].id}`);

    return data[0].id;

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

addAhorroCompraSimpleQuestion();