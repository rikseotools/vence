import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta30() {
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
      question_text: 'Indique, en qué palabras de la siguiente serie, se ha cometido un error de g/j:',
      question_subtype: 'word_analysis',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_gj_errors',
        original_text: 'cangear, jenjibre, alunizage, ogén, efigie, larinje, ajenjo, paraje, crujido, ultraje',
        evaluation_description: 'Capacidad de identificar errores específicos de g/j en serie de palabras'
      },
      option_a: '5',
      option_b: '8', 
      option_c: '6',
      option_d: '7',
      correct_option: 2, // C = 6 errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ C) 6</strong> errores de g/j.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong style="color: #dc2626;">Errores de g/j encontrados (6):</strong>

<strong>Palabras correctas (4):</strong>
• <strong>efigie</strong> - correcto (con g)
• <strong>ajenjo</strong> - correcto (con j)
• <strong>paraje</strong> - correcto (con j)
• <strong>crujido</strong> - correcto (con j)

<strong>Palabras con errores (6):</strong>
• <em>cangear</em> → <strong>canjear</strong> (debe ser con j)
• <em>jenjibre</em> → <strong>gengibre</strong> (debe ser con g)
• <em>alunizage</em> → <strong>alunizaje</strong> (debe ser con j)
• <em>ogén</em> → <strong>ojén</strong> (debe ser con j)
• <em>larinje</em> → <strong>laringe</strong> (debe ser con g)
• <em>ultraje</em> → <strong>ultraje</strong> (correcto como está)

<strong>Total: 6 errores de confusión g/j</strong>
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

    console.log('✅ Pregunta 30 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: word_analysis`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta30()