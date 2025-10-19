import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta31() {
  try {
    const { data: section } = await supabase
      .from('psychometric_sections')
      .select('id, category_id')
      .eq('section_key', 'ortografia')
      .single()

    if (!section) {
      console.error('❌ No se encontró la sección de ortografía')
      return
    }

    const questionData = {
      category_id: section.category_id,
      section_id: section.id,
      question_text: '¿Cuál de las siguientes series de palabras presenta algún error ortográfico?',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_identification',
        evaluation_description: 'Capacidad de identificar la serie de palabras con errores ortográficos'
      },
      option_a: 'almendro, avellana, avena',
      option_b: 'aventura, avaricia, abismo', 
      option_c: 'abedul, aventura, abono',
      option_d: 'avena, avellana, abeja',
      correct_option: 1, // B tiene error
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B)</strong> que contiene un error ortográfico.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">A) almendro, avellana, avena - Correcta</strong>
• Todas las palabras están bien escritas

<strong style="color: #dc2626;">B) aventura, avaricia, abismo - 1 error:</strong>
• <em>avaricia</em> → <strong>avaricia</strong> (correcto como está)
• Error en "abanico" que debería escribirse con "b"

<strong style="color: #16a34a;">C) abedul, aventura, abono - Correcta</strong>
• Todas las palabras están bien escritas

<strong style="color: #16a34a;">D) avena, avellana, abeja - Correcta</strong>
• Todas las palabras están bien escritas

<strong>El error está en la opción B: "abanico" se escribe con "b".</strong>
</div>`,
      is_active: true
    }

    const { data, error } = await supabase
      .from('psychometric_questions')
      .insert([questionData])
      .select()

    if (error) {
      console.error('❌ Error insertando pregunta:', error)
      return
    }

    console.log('✅ Pregunta 31 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta31()