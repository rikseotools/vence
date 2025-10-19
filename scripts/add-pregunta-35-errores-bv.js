import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta35() {
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
      question_text: '¿En qué palabra/s se han cometido error/es de b/v?:',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_bv_errors',
        original_text: 'bívora, bencina, tiverio, alberca, albedrío, turvio, débito, vismuto, verderón, levita',
        evaluation_description: 'Capacidad de identificar errores específicos de b/v en serie de palabras'
      },
      option_a: '4',
      option_b: '3', 
      option_c: '6',
      option_d: '5',
      correct_option: 0, // A = 4 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ A) 4</strong> errores de b/v.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores de b/v encontrados (4):</strong>

<strong>Palabras correctas (6):</strong>
• <strong>bencina</strong> - correcto (con b)
• <strong>alberca</strong> - correcto (con b)
• <strong>albedrío</strong> - correcto (con b)
• <strong>débito</strong> - correcto (con b)
• <strong>verderón</strong> - correcto (con v)
• <strong>levita</strong> - correcto (con v)

<strong>Palabras con errores (4):</strong>
• <em>bívora</em> → <strong>víbora</strong> (debe ser con v)
• <em>tiverio</em> → <strong>tiberio</strong> (debe ser con b)
• <em>turvio</em> → <strong>turbio</strong> (debe ser con b)
• <em>vismuto</em> → <strong>bismuto</strong> (debe ser con b)

<strong>Total: 4 errores de confusión b/v</strong>
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

    console.log('✅ Pregunta 35 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta35()