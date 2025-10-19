import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta50() {
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
      question_text: 'Señale la opción que presenta una palabra inexistente o inventada.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'word_identification',
        evaluation_description: 'Capacidad de identificar palabras inexistentes o inventadas entre opciones válidas'
      },
      option_a: 'Iracundo, flemático, prosopopeya',
      option_b: 'Fragoroso, tácito, pernicioso', 
      option_c: 'Sutileza, pródigo, omnívoro',
      option_d: 'Contundente, inhóspito, relactar',
      correct_option: 3, // D = relactar es inventada
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D) Contundente, inhóspito, relactar</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #16a34a;">A) Iracundo, flemático, prosopopeya</strong> - Todas correctas:
• Iracundo (propenso a la ira)
• Flemático (tranquilo, impasible)  
• Prosopopeya (figura retórica)

<strong style="color: #16a34a;">B) Fragoroso, tácito, pernicioso</strong> - Todas correctas:
• Fragoroso (que hace mucho ruido)
• Tácito (callado, silencioso)
• Pernicioso (dañino, perjudicial)

<strong style="color: #16a34a;">C) Sutileza, pródigo, omnívoro</strong> - Todas correctas:
• Sutileza (delicadeza, finura)
• Pródigo (generoso, abundante)
• Omnívoro (que come de todo)

<strong style="color: #dc2626;">✗ D) Contundente, inhóspito, relactar</strong> - "Relactar" es inventada:
• Contundente (convincente, categórico) ✓
• Inhóspito (poco acogedor) ✓  
• <strong>Relactar</strong> ❌ (palabra inexistente - debería ser "redactar")
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

    console.log('✅ Pregunta 50 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta50()