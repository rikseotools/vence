import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addInsuranceClassificationQuestion() {
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

    // 3. Preparar datos de la pregunta de seguros
    const questionData = {
      category_id: category.id,
      section_id: section.id,
      question_text: 'Clasifique el siguiente seguro según los criterios dados:',
      content_data: {
        // Datos del seguro a clasificar
        example_row: {
          cantidad: "1000 EUROS",
          tipo: "VIDA", 
          fecha: "22/10/2016"
        },
        
        // Criterios de clasificación
        criteria: [
          {
            column: "Columna A",
            rule: "Seguro de incendios o accidentes, desde 1500 a 4500 euros inclusive, contratado entre el 15 de marzo de 2016 y el 10 de mayo de 2017."
          },
          {
            column: "Columna B", 
            rule: "Seguro de vida o de accidentes, hasta 3000 euros inclusive, contratado entre el 15 de octubre de 2016 y el 20 de agosto de 2017."
          },
          {
            column: "Columna C",
            rule: "Seguro de incendios o de vida, desde 2000 a 5000 euros, inclusive, contratado entre el 10 de febrero de 2016 y el 15 de junio de 2017."
          }
        ],
        
        // Tabla de clasificación (para mostrar las opciones)
        classification_table: {
          headers: ["Criterio", "Tipo de seguro", "Rango de euros", "Período de contratación"],
          rows: [
            ["A", "Incendios o accidentes", "1500-4500 €", "15/03/2016 - 10/05/2017"],
            ["B", "Vida o accidentes", "Hasta 3000 €", "15/10/2016 - 20/08/2017"], 
            ["C", "Incendios o vida", "2000-5000 €", "10/02/2016 - 15/06/2017"],
            ["D", "No cumple ninguna condición", "-", "-"]
          ]
        },
        
        explanation_sections: [
          {
            title: "💡 ¿Qué evalúa este ejercicio?",
            content: "Capacidad de aplicar criterios de clasificación múltiples a datos específicos, verificando simultáneamente tipo, cantidad y fecha en condiciones complejas."
          },
          {
            title: "📊 ANÁLISIS PASO A PASO:",
            content: "📋 DATOS DEL SEGURO:\n✅ Cantidad: 1000 euros\n✅ Tipo: VIDA\n✅ Fecha: 22/10/2016\n\n📋 VERIFICACIÓN DE CRITERIOS:\n\n❌ CRITERIO A: Incendios o accidentes (1500-4500 €, 15/03/2016-10/05/2017)\n• Tipo: ❌ Es VIDA (no incendios/accidentes)\n• Cantidad: ❌ 1000 € (fuera de rango 1500-4500)\n• Fecha: ❌ 22/10/2016 (fuera de período 15/03/2016-10/05/2017)\n\n✅ CRITERIO B: Vida o accidentes (hasta 3000 €, 15/10/2016-20/08/2017)\n• Tipo: ✅ Es VIDA (cumple vida o accidentes)\n• Cantidad: ✅ 1000 € (cumple hasta 3000 €)\n• Fecha: ✅ 22/10/2016 (cumple 15/10/2016-20/08/2017)\n\n✅ CRITERIO C: Incendios o vida (2000-5000 €, 10/02/2016-15/06/2017)\n• Tipo: ✅ Es VIDA (cumple incendios o vida)\n• Cantidad: ❌ 1000 € (fuera de rango 2000-5000)\n• Fecha: ❌ 22/10/2016 (fuera de período 10/02/2016-15/06/2017)"
          },
          {
            title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
            content: "🔍 Método 1: Verificación secuencial\n• Paso 1: Identificar los 3 datos del seguro (cantidad, tipo, fecha)\n• Paso 2: Para cada criterio, verificar LAS 3 condiciones\n• Paso 3: Solo es válido si cumple las 3 simultáneamente\n• Resultado: Solo B cumple todas las condiciones\n\n📊 Método 2: Descarte rápido por tipo\n• El seguro es de VIDA\n• Criterio A: ❌ requiere incendios/accidentes\n• Criterio B: ✅ acepta vida\n• Criterio C: ✅ acepta vida\n• Luego verificar cantidad y fecha solo en B y C\n\n💰 Método 3: Verificación por exclusión\n• Criterio A: Falla en tipo y cantidad → Descartado\n• Criterio C: Falla en cantidad (1000 < 2000) → Descartado\n• Criterio B: Únicas condiciones que 1000€ VIDA puede cumplir"
          }
        ]
      },
      option_a: 'Criterio A',
      option_b: 'Criterio D', 
      option_c: 'Criterio B',
      option_d: 'Criterio C',
      correct_option: 2, // C = B
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

    console.log('✅ Pregunta de clasificación de seguros añadida exitosamente')
    console.log('📝 ID:', data[0]?.id)
    console.log('✅ Respuesta correcta: C (Criterio B - cumple vida, hasta 3000€, período correcto)')
    console.log('♻️  Reutiliza el componente DataTableQuestion existente - no se necesitan cambios')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

addInsuranceClassificationQuestion()