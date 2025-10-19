import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta37() {
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
      question_text: 'Indique los errores ortográficos que se han cometido en la siguiente serie de palabras:',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_error_count',
        original_text: 'Egido, elite, empollar, epiteto, épsilon, escéptico, explénico, exención, exalación, estirpe',
        evaluation_description: 'Capacidad de identificar errores ortográficos en serie de palabras diversas'
      },
      option_a: '3',
      option_b: '5', 
      option_c: '6',
      option_d: '4',
      correct_option: 3, // D = 4 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) 4</strong> errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores encontrados (4):</strong>

<strong>Palabras correctas (6):</strong>
• <strong>egido</strong> - correcto
• <strong>empollar</strong> - correcto
• <strong>épsilon</strong> - correcto (con acento)
• <strong>escéptico</strong> - correcto (con acento)
• <strong>exención</strong> - correcto (con acento)
• <strong>estirpe</strong> - correcto

<strong>Palabras con errores (4):</strong>
• <em>elite</em> → <strong>élite</strong> (lleva acento según RAE)
• <em>epiteto</em> → <strong>epíteto</strong> (lleva acento)
• <em>explénico</em> → <strong>esplénico</strong> (es con s)
• <em>exalación</em> → <strong>exhalación</strong> (con h intercalada)

<strong>Total: 4 errores ortográficos</strong>
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

    console.log('✅ Pregunta 37 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta37()