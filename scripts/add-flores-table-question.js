import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addFloresTableQuestion() {
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

    // 3. Preparar datos de las tablas
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'Según las tablas Flores, ¿cuántas flores de color rosa están disponibles con entrega a domicilio en ramos de media docena?',
      content_data: {
        tables: [
          {
            title: "TABLA 1: TIPOS DE FLORES Y COLORES",
            headers: ["Flor", "Colores", "Tipos de ramos"],
            rows: [
              ["Margarita", "blanco y amarillo", "3"],
              ["Rosa", "blanco, amarillo y rosa", "6"],
              ["Clavel", "amarillo y rosa", "3 y 6"],
              ["Gardenia", "rosa", "3, 6 y 12"],
              ["Crisantemo", "blanco y rosa", "3, 6 y 12"],
              ["Tulipán", "amarillo", "3, 6 y 12"],
              ["Cardo", "blanco", "3"],
              ["Lirio", "blanco y amarillo", "6"],
              ["Orquídea", "blanco y rosa", "3, 6 y 12"],
              ["Gerbera", "amarillo y rosa", "3 y 6"]
            ]
          },
          {
            title: "TABLA 2: PÉTALOS Y PRECIOS",
            headers: ["Flor", "Pétalos", "Peso grandes", "Estambres", "Precio unidad"],
            rows: [
              ["Margarita", "2", "2", "2", "3"],
              ["Rosa", "4", "5", "4", "3"],
              ["Clavel", "3", "4", "6", "5"],
              ["Gardenia", "1", "4", "3", "2"],
              ["Crisantemo", "4", "4", "6", "5"],
              ["Tulipán", "5", "6", "5", "4"],
              ["Cardo", "4", "1", "4", "5"],
              ["Lirio", "3", "5", "6", "4"],
              ["Orquídea", "4", "6", "8", "3"],
              ["Gerbera", "5", "1", "7", "5"]
            ]
          },
          {
            title: "TABLA 3: DISPONIBILIDAD Y ENTREGA",
            headers: ["Flor", "Fragancia fuerte", "Entrega domicilio", "Presentes", "En jardinería", "Duradera"],
            rows: [
              ["Margarita", "NO", "SÍ", "NO", "SÍ", "SÍ"],
              ["Rosa", "NO", "NO", "SÍ", "SÍ", "NO"],
              ["Clavel", "SÍ", "NO", "NO", "NO", "SÍ"],
              ["Gardenia", "SÍ", "SÍ", "SÍ", "NO", "NO"],
              ["Crisantemo", "NO", "NO", "SÍ", "SÍ", "NO"],
              ["Tulipán", "SÍ", "SÍ", "SÍ", "SÍ", "SÍ"],
              ["Cardo", "NO", "NO", "SÍ", "SÍ", "NO"],
              ["Lirio", "NO", "NO", "NO", "NO", "SÍ"],
              ["Orquídea", "NO", "SÍ", "SÍ", "SÍ", "NO"],
              ["Gerbera", "SÍ", "NO", "SÍ", "SÍ", "NO"]
            ]
          }
        ],
        operation_type: "cross_reference_multiple_conditions",
        filter_conditions: [
          "Color rosa (Tabla 1)",
          "Entrega a domicilio = SÍ (Tabla 3)",
          "Ramos de media docena = 6 flores (Tabla 1)"
        ],
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de cross-referencing múltiple: localizar datos específicos combinando información de 3 tablas diferentes con múltiples filtros simultáneos."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 TABLA 1: Identificar flores con color rosa\n✅ Rosa (colores: blanco, amarillo y rosa) - tiene ramos 6\n✅ Clavel (colores: amarillo y rosa) - tiene ramos 3 y 6\n✅ Gardenia (color: rosa) - tiene ramos 3, 6 y 12\n✅ Crisantemo (colores: blanco y rosa) - tiene ramos 3, 6 y 12\n✅ Orquídea (colores: blanco y rosa) - tiene ramos 3, 6 y 12\n✅ Gerbera (colores: amarillo y rosa) - tiene ramos 3 y 6\n\n📋 FILTRO: Solo las que tienen ramos de 6 (media docena)\n✅ Rosa, Clavel, Gardenia, Crisantemo, Orquídea, Gerbera\n\n📋 TABLA 3: De estas, ¿cuáles tienen entrega a domicilio = SÍ?\n❌ Rosa: NO\n❌ Clavel: NO\n✅ Gardenia: SÍ\n❌ Crisantemo: NO\n✅ Orquídea: SÍ\n❌ Gerbera: NO"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Filtrado progresivo\n• Paso 1: Marcar todas las flores rosas en Tabla 1\n• Paso 2: De estas, seleccionar las que tienen ramos \"6\"\n• Paso 3: Verificar en Tabla 3 cuáles tienen \"SÍ\" en entrega\n• Resultado: 2 flores (Gardenia y Orquídea)\n\n📊 Método 2: Descarte visual rápido\n• Observar columna \"Entrega domicilio\" en Tabla 3\n• Solo hay 4 flores con \"SÍ\": Margarita, Gardenia, Tulipán, Orquídea\n• De estas, verificar cuáles son rosas en Tabla 1\n• Descartar: Margarita (blanco/amarillo), Tulipán (amarillo)\n\n💰 Método 3: Descarte de opciones\n• Opción A (3): Imposible, máximo 2 cumplen entrega = SÍ y color rosa\n• Opción B (2): ✅ Correcto (Gardenia + Orquídea)\n• Opción C (0): Incorrecto, sí hay flores que cumplen\n• Opción D (1): Incorrecto, son más de 1"
          },
          {
            title: "❌ Errores comunes a evitar",
            content: "• Confundir \"media docena\" (6) con \"docena\" (12) o \"3 flores\"\n• No verificar TODAS las condiciones (rosa + ramos 6 + entrega SÍ)\n• Leer mal la columna de colores (some tienen múltiples colores)\n• No distinguir entre flores que \"pueden ser\" rosas vs \"solo\" rosas\n• Olvidar que una flor puede tener varios colores simultáneamente"
          },
          {
            title: "💪 Consejo de oposición",
            content: "En tablas complejas, trabaja sistemáticamente: 1) Identifica TODAS las condiciones requeridas, 2) Aplica filtros uno por uno marcando con lápiz, 3) Cuenta solo los que cumplen TODAS las condiciones. Las preguntas de cross-referencing son eliminatorias - la precisión es más importante que la velocidad."
          }
        ]
      },
      option_a: '3',
      option_b: '2', 
      option_c: '0',
      option_d: '1',
      correct_option: 1, // B = 2
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

    console.log('✅ Pregunta de flores y tablas añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: B (2 flores: Gardenia y Orquídea)')
    console.log('♻️  Reutiliza el componente DataTableQuestion existente - no se necesitan cambios')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

addFloresTableQuestion()