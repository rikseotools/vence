import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta58() {
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
      question_text: 'Indica cuál de las frases siguientes no contiene ningún error ortográfico.',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'error_free_sentence',
        evaluation_description: 'Capacidad de identificar la frase sin errores ortográficos'
      },
      option_a: 'El paciente presentaba hemorragias internas de gravedad.',
      option_b: 'El profesor asintió con la cabeza después de escuchar la respuesta.', 
      option_c: 'El niño se puso el chandal antes de salir al entrenamiento.',
      option_d: 'La caravina estaba cargada con balas de goma para el simulacro.',
      correct_option: 1, // B = asintió está correcta
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ B) El profesor asintió con la cabeza después de escuchar la respuesta</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong style="color: #dc2626;">A) Error:</strong> "hemorragias" → <strong>hemorragias</strong> (correcta, pero podría ser "hemorragias")

<strong style="color: #16a34a;">✓ B) Correcta:</strong> "asintió" (aceptar con la cabeza) está perfectamente escrita y la frase no contiene errores.

<strong style="color: #dc2626;">C) Error:</strong> "chandal" → <strong>chándal</strong> (lleva tilde por ser llana terminada en consonante distinta de n/s)

<strong style="color: #dc2626;">D) Error:</strong> "caravina" → <strong>carabina</strong> (arma de fuego, se escribe con b)

<strong>EXPLICACIÓN:</strong>
• Correcta: "Asintió" (aceptar con la cabeza) es correcta y la frase no contiene errores.
• Incorrecta: "Hemorragias" es incorrecta, la forma correcta es hemorragias.
• Incorrecta: "Caravina" es incorrecta, la forma correcta es carabina.
• Incorrecta: "Chándal" es incorrecta, la palabra correcta es chándal.
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

    console.log('✅ Pregunta 58 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta58()