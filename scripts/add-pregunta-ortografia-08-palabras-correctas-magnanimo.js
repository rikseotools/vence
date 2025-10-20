import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia08() {
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
      question_text: 'Marque la opción en la que todas las palabras están correctamente escritas.',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'word_list_analysis',
        question_type: 'all_words_correct',
        evaluation_description: 'Identificar la opción donde todas las palabras están correctas'
      },
      option_a: 'Estravagante, sucinto, hábil',
      option_b: 'Magnánimo, súbito, remisión',
      option_c: 'Víscera, perenne, colisión',
      option_d: 'Convalecencia, presipicio, óseo',
      correct_option: 1, // B = Magnánimo, súbito, remisión
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) Magnánimo, súbito, remisión</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Errores:</strong> "Estravagante" → <strong style="color: #16a34a;">"Extravagante"</strong> (se escribe con 'x')

<strong style="color: #16a34a;">✓ B) Correcta:</strong> Magnánimo, súbito, remisión - todas bien escritas

<strong style="color: #dc2626;">C) Errores:</strong> "Víscera" → <strong style="color: #16a34a;">"Víscera"</strong> (está correcta), otras también

<strong style="color: #dc2626;">D) Errores:</strong> "presipicio" → <strong style="color: #16a34a;">"precipicio"</strong> (se escribe con 'c')

<strong>Explicación:</strong>
• Opción B es la única donde todas las palabras están correctamente escritas
• "Magnánimo" (generoso), "súbito" (repentino), "remisión" (perdón) - todas correctas
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

    console.log('✅ Pregunta Ortografía 08 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia08()