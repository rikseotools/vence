import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPreguntaOrtografia03() {
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
      question_text: '¿Cuál de las siguientes opciones tiene un significado más parecido a la palabra INTEGRAR?',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'word_meaning_similarity',
        evaluation_description: 'Identificar sinónimo más cercano a la palabra dada'
      },
      option_a: 'Sustituir',
      option_b: 'Marcar',
      option_c: 'Componer',
      option_d: 'Convertir',
      correct_option: 2, // C = Componer
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ C) Componer</strong>.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis del significado de "INTEGRAR":</strong>

<strong>Definición de "integrar":</strong> Formar un todo con las partes que faltaban, incorporar elementos para completar algo.

<strong>Análisis de opciones:</strong>

<strong style="color: #dc2626;">A) Sustituir:</strong> Reemplazar una cosa por otra - no es sinónimo

<strong style="color: #dc2626;">B) Marcar:</strong> Señalar, indicar - no es sinónimo

<strong style="color: #16a34a;">✓ C) Componer:</strong> Formar un todo juntando partes - SÍ es sinónimo

<strong style="color: #dc2626;">D) Convertir:</strong> Transformar algo en otra cosa - no es sinónimo

<strong>Sinónimos de "integrar":</strong> componer, formar, constituir, conformar, incluir, incorporar.
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

    console.log('✅ Pregunta Ortografía 03 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPreguntaOrtografia03()