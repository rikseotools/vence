// scripts/add-chocolate-sales-question.js
// Añadir pregunta psicotécnica de gráfico de barras - chocolatinas vendidas por trimestre 2022 vs 2023

import { createClient } from '@supabase/supabase-js'

// Configuración de Supabase
const supabaseUrl = 'https://yqbpstxowvgipqspqrgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'

const supabase = createClient(supabaseUrl, supabaseKey)

async function addChocolateSalesQuestion() {
  console.log('🍫 Añadiendo pregunta de chocolatinas vendidas por trimestre...')

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
    question_text: 'En el año 2022, ¿En qué trimestre se vendieron más chocolatinas?',
    content_data: {
      chart_type: 'bar_chart',
      chart_title: 'CHOCOLATINAS VENDIDAS',
      x_axis_label: 'Trimestres',
      y_axis_label: 'Cantidad vendida',
      description: 'Una tienda de barrio se dedica a la venta de golosinas y quiere saber si les compensa o no seguir vendiendo chocolatinas comparando las que se vendieron en el 2022 con las que se vendieron en 2023. Conteste las preguntas relacionadas con el gráfico:',
      chart_data: {
        type: 'bar_chart',
        title: 'CHOCOLATINAS VENDIDAS',
        quarters: [
          {
            name: 'PRIMER TRIMESTRE',
            año2022: 24,
            año2023: 89
          },
          {
            name: 'SEGUNDO TRIMESTRE', 
            año2022: 36,
            año2023: 24
          },
          {
            name: 'TERCER TRIMESTRE',
            año2022: 12,
            año2023: 37
          },
          {
            name: 'CUARTO TRIMESTRE',
            año2022: 38,
            año2023: 63
          }
        ],
        legend: {
          año2022: 'AÑO 2022',
          año2023: 'AÑO 2023'
        }
      },
      explanation_sections: [
        {
          title: "💡 ¿Qué evalúa este ejercicio?",
          content: "Capacidad de leer e interpretar gráficos de barras comparativos, extrayendo datos específicos de un año concreto (2022) ignorando información de distracción (2023)."
        },
        {
          title: "📊 ANÁLISIS PASO A PASO:",
          content: "📋 Datos del año 2022 (barras naranjas):\n✅ PRIMER TRIMESTRE: 24 chocolatinas\n✅ SEGUNDO TRIMESTRE: 36 chocolatinas  \n✅ TERCER TRIMESTRE: 12 chocolatinas\n✅ CUARTO TRIMESTRE: 38 chocolatinas\n\n📋 Comparación rápida:\n• Trimestre con MÁS ventas: 4º (38)\n• Trimestre con MENOS ventas: 3º (12)"
        },
        {
          title: "⚡ TÉCNICAS DE ANÁLISIS RÁPIDO (Para oposiciones)",
          content: "🔍 Método 1: Descarte visual rápido\n• Ignorar completamente las barras azules (2023)\n• Comparar solo alturas de barras naranjas (2022)\n• El cuarto trimestre claramente supera al resto\n\n📊 Método 2: Lectura directa de valores\n• Leer números encima de cada barra naranja\n• 24 → 36 → 12 → 38\n• Máximo = 38 = Cuarto trimestre\n\n💰 Método 3: Descarte de opciones\n• Opción A: \"En el cuarto\" → ✅ CORRECTO (38 > todos)\n• Opción B: \"En el tercero\" → ❌ Es el MÍNIMO (12)\n• Opción C: \"En el primero\" → ❌ Solo 24 (menor que 36 y 38)\n• Opción D: \"En el segundo\" → ❌ 36 es menor que 38"
        },
        {
          title: "❌ Errores comunes a evitar",
          content: "• Confundir años: leer datos de 2023 en lugar de 2022\n• Leer la pregunta mal: buscar mínimo en lugar de máximo\n• Comparar trimestres entre años: 1º de 2022 vs 1º de 2023\n• Sumar trimestres: dar el total en lugar del trimestre específico"
        },
        {
          title: "💪 Consejo de oposición",
          content: "En gráficos comparativos, SIEMPRE lee la pregunta DOS veces para identificar qué año/categoría específica te piden. Marca visualmente la serie correcta antes de buscar el valor."
        }
      ]
    },
    option_a: 'En el cuarto.',
    option_b: 'En el tercero.', 
    option_c: 'En el primero.',
    option_d: 'En el segundo.',
    correct_option: 0, // A = En el cuarto (38 chocolatinas en 2022)
    explanation: "En 2022, las ventas por trimestre fueron: Primer trimestre: 24, Segundo trimestre: 36, Tercer trimestre: 12, Cuarto trimestre: 38. El cuarto trimestre tuvo las mayores ventas con 38 chocolatinas.",
    difficulty: 'easy', // Es fácil, solo hay que leer las barras del 2022
    time_limit_seconds: 90, // 1.5 minutos
    cognitive_skills: ['chart_reading', 'data_comparison', 'visual_analysis'],
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

    console.log('✅ Pregunta de chocolatinas añadida exitosamente:')
    console.log(`   📝 ID: ${data[0]?.id}`)
    console.log(`   🏷️ Tipo: ${data[0]?.question_subtype}`)
    console.log(`   ❓ Pregunta: ${data[0]?.question_text}`)
    console.log(`   ✅ Respuesta correcta: En el cuarto (38 chocolatinas en 2022)`)

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
addChocolateSalesQuestion()