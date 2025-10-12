// scripts/add-fruits-vegetables-sum-question.js
// Añadir pregunta psicotécnica de gráfico de barras - suma frutas y verduras 2020-2021

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addFruitsVegetablesSumQuestion() {
  console.log('🥗 Añadiendo pregunta de suma de frutas y verduras...')

  // Primero obtenemos el section_id de "graficos" en "capacidad-administrativa"
  const { data: section, error: sectionError } = await supabase
    .from('psychometric_sections')
    .select('id, section_key, category_id, psychometric_categories(id, category_key)')
    .eq('section_key', 'graficos')
    .eq('psychometric_categories.category_key', 'capacidad-administrativa')
    .single()

  if (sectionError || !section) {
    console.error('❌ Error obteniendo sección de gráficos:', sectionError)
    return
  }

  console.log(`✅ Sección encontrada: ${section.id} (${section.section_key})`)
  console.log(`✅ Categoría ID: ${section.category_id}`)

  const questionData = {
    category_id: section.category_id,
    section_id: section.id,
    question_text: 'Si tomásemos los años 2020 y 2021, ¿Cuál sería la cantidad de frutas y verduras consumido?',
    content_data: {
      chart_type: 'bar_chart',
      chart_title: 'Consumo de alimentos frescos por persona expresado en Kg/mes',
      x_axis_label: 'Años',
      y_axis_label: 'Kg/mes',
      description: 'Gráfico que muestra el consumo de frutas, pescado y verduras desde 2019 hasta 2022',
      chart_data: {
        type: 'bar_chart',
        title: 'Consumo de alimentos frescos por persona expresado en Kg/mes',
        quarters: [
          {
            name: 'Año 2019',
            frutas: 15,
            pescado: 10,
            verduras: 20
          },
          {
            name: 'Año 2020', 
            frutas: 20,
            pescado: 10,
            verduras: 20
          },
          {
            name: 'Año 2021',
            frutas: 10,
            pescado: 5,
            verduras: 15
          },
          {
            name: 'Año 2022',
            frutas: 5,
            pescado: 5,
            verduras: 10
          }
        ],
        legend: {
          frutas: 'Frutas',
          pescado: 'Pescado',
          verduras: 'Verduras'
        }
      },
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de extraer datos específicos de múltiples años y categorías de un gráfico de barras, realizando operaciones de suma con 4 valores diferentes."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Identificación de años y categorías:\n✅ Años requeridos: 2020 y 2021\n✅ Categorías requeridas: Frutas y Verduras (ignorar Pescado)\n\n📋 Extracción de datos del gráfico:\n• Año 2020: Frutas = 20 kg/mes, Verduras = 20 kg/mes\n• Año 2021: Frutas = 10 kg/mes, Verduras = 15 kg/mes\n\n📋 Suma total:\n• 2020: 20 + 20 = 40 kg/mes\n• 2021: 10 + 15 = 25 kg/mes\n• Total: 40 + 25 = 65 kg/mes"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Suma por años\n• 2020: 20 (frutas) + 20 (verduras) = 40\n• 2021: 10 (frutas) + 15 (verduras) = 25\n• Total: 40 + 25 = 65 kg/mes\n\n📊 Método 2: Suma por categorías\n• Frutas totales: 20 (2020) + 10 (2021) = 30\n• Verduras totales: 20 (2020) + 15 (2021) = 35\n• Total: 30 + 35 = 65 kg/mes\n\n💰 Método 3: Descarte de opciones\n• Opción A: 65 → ✅ CORRECTO (20+20+10+15)\n• Opción B: 60 → ❌ Faltarían 5 kg/mes\n• Opción C: 70 → ❌ Sobrarían 5 kg/mes\n• Opción D: 55 → ❌ Faltarían 10 kg/mes"
        },
        {
          title: "❌ Errores comunes a evitar",
          content: "• Incluir pescado: sumar datos de pescado que no se piden\n• Confundir años: usar 2019 o 2022 en lugar de 2020 y 2021\n• Leer mal las barras: confundir valores de categorías similares\n• Sumar solo un año: calcular solo 2020 o solo 2021"
        },
        {
          title: "💪 Consejo de oposición",
          content: "En sumas múltiples de gráficos: 1) Identifica EXACTAMENTE qué años y categorías pide, 2) Marca visualmente las barras necesarias, 3) Extrae valores uno por uno, 4) Suma ordenadamente. Verifica que el resultado sea lógico."
        }
      ]
    },
    option_a: '65 kg/mes',
    option_b: '60 kg/mes',
    option_c: '70 kg/mes',
    option_d: '55 kg/mes',
    correct_option: 0, // A = 65 kg/mes (20+20+10+15)
    explanation: "Año 2020: Frutas = 20 kg/mes, Verduras = 20 kg/mes. Año 2021: Frutas = 10 kg/mes, Verduras = 15 kg/mes. Total: 20 + 20 + 10 + 15 = 65 kg/mes.",
    difficulty: 'easy',
    time_limit_seconds: 90, // 1.5 minutos
    cognitive_skills: ['mathematical_reasoning', 'data_extraction', 'chart_reading', 'addition'],
    question_subtype: 'bar_chart',
    is_active: true,
    is_verified: true
  }

  try {
    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta de suma de frutas y verduras añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text}`)
    console.log(`   ✅ Respuesta correcta: 65 kg/mes (20+20+10+15)`)

    // Verificar que se insertó correctamente
    const { data: verification, error: verifyError } = await supabase
      .from('psychometric_questions')
      .select('*')
      .eq('id', data[0].id)
      .single()

    if (verifyError) {
      console.error('❌ Error verificando pregunta:', verifyError)
      return
    }

    console.log('\n🔍 Verificación exitosa - la pregunta está en la base de datos')
    console.log('🎯 La pregunta aparecerá en los tests de Capacidad Administrativa > Gráficos')
    console.log('♻️  Reutiliza el componente BarChartQuestion existente - no se necesitan cambios')
    console.log('')
    console.log('🔗 REVISAR PREGUNTA VISUALMENTE:')
    console.log(`   http://localhost:3000/debug/question/${data[0]?.id}`)

  } catch (err) {
    console.error('❌ Error general:', err)
  }
}

// Ejecutar
addFruitsVegetablesSumQuestion()