import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addOlympicsWinterQuestion() {
  try {
    // 1. Obtener la categoría "capacidad-administrativa"
    const { data: category, error: categoryError } = await supabase
      .from('psychometric_categories')
      .select('id, category_key, display_name')
      .eq('category_key', 'capacidad-administrativa')
      .single()
    
    if (categoryError) {
      console.error('❌ Error obteniendo categoría:', categoryError)
      return
    }
    console.log('✅ Categoría encontrada:', category.display_name)

    // 2. Obtener la sección "tablas"
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select('id, section_key, display_name')
      .eq('category_id', category.id)
      .eq('section_key', 'tablas')
      .single()
    
    if (sectionError) {
      console.error('❌ Error obteniendo sección:', sectionError)
      return
    }
    console.log('✅ Sección encontrada:', section.display_name)

    // 3. Preparar datos de la pregunta de JJ.OO
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: '¿Cuál sería el total de JJ.OO de invierno en que han participado los cinco países de la tabla?',
      content_data: {
        tables: [
          {
            title: "PARTICIPACIÓN EN JUEGOS OLÍMPICOS Y MEDALLAS OBTENIDAS",
            headers: ["País", "JJ.OO verano", "JJ.OO invierno", "Oro", "Plata", "Bronce", "Total Medallas"],
            rows: [
              ["Alemania", "17", "12", "239", "267", "291", "797"],
              ["Francia", "29", "24", "231", "256", "265", "772"],
              ["España", "24", "21", "48", "72", "49", "169"],
              ["Italia", "28", "24", "222", "195", "215", "632"],
              ["Grecia", "29", "19", "36", "45", "41", "122"]
            ]
          }
        ],
        
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de localización y suma de datos específicos en tablas: identificar una columna concreta y realizar operaciones aritméticas básicas con los valores encontrados."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 IDENTIFICAR COLUMNA OBJETIVO:\n✅ Buscar columna 'JJ.OO invierno' (tercera columna)\n\n📋 EXTRAER DATOS POR PAÍS:\n✅ Alemania: 12 JJ.OO invierno\n✅ Francia: 24 JJ.OO invierno\n✅ España: 21 JJ.OO invierno\n✅ Italia: 24 JJ.OO invierno\n✅ Grecia: 19 JJ.OO invierno\n\n📋 REALIZAR SUMA:\n✅ 12 + 24 + 21 + 24 + 19 = 100\n\n📋 VERIFICACIÓN:\n✅ Total: 100 JJ.OO de invierno"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Suma directa\n• Paso 1: Localizar columna 'JJ.OO invierno'\n• Paso 2: Extraer los 5 valores: 12, 24, 21, 24, 19\n• Paso 3: Sumar: 12+24+21+24+19 = 100\n• Resultado: Opción C (100)\n\n📊 Método 2: Agrupación inteligente\n• Agrupar números fáciles: (12+24) + (21+19) + 24\n• Calcular: 36 + 40 + 24 = 100\n• Verificar con descarte de opciones\n\n💰 Método 3: Descarte de opciones\n• Opción A (90): Muy baja, faltan ~10 unidades\n• Opción B (108): Muy alta, sobran ~8 unidades\n• Opción C (100): ✅ Número redondo, probable\n• Opción D (99): Cerca pero no exacta"
          }
        ]
      },
      option_a: '90',
      option_b: '108',
      option_c: '100',
      option_d: '99',
      correct_option: 2, // C = 100
      explanation: null, // Se maneja en componente
      question_subtype: 'data_tables', // Tipo para DataTableQuestion.js
      is_active: true
    }

    // 4. Insertar la pregunta
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de JJ.OO de invierno añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: C (100 = 12+24+21+24+19)')
    console.log('♻️  Reutiliza el componente DataTableQuestion existente - no se necesitan cambios')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

addOlympicsWinterQuestion()