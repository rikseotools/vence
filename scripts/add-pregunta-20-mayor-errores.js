import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addPregunta20() {
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
      question_text: 'En las siguientes alternativas de respuesta, marque la opción que contenga mayor número de errores ortográficos:',
      question_subtype: 'text_question',
      content_data: {
        chart_type: 'text_analysis',
        question_type: 'orthographic_comparison',
        evaluation_description: 'Capacidad de identificar la opción con mayor cantidad de errores ortográficos'
      },
      option_a: 'Laud, áspiz, tesitura',
      option_b: 'lacallo, ioduro, alcayata', 
      option_c: 'Yantar, gayo, inexcrutable',
      option_d: 'detección, lasante, parosismo',
      correct_option: 3, // D tiene más errores
      explanation: `La respuesta correcta es <strong style="color: #16a34a;">✓ D)</strong> que contiene mayor número de errores ortográficos.

<div style="background-color: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #e2e8f0; margin: 8px 0;">
<strong>Análisis por opción:</strong>

<strong>A) Laud, áspiz, tesitura - 2 errores:</strong>
• <em>Laud</em> → <strong>laúd</strong> (falta tilde)
• <em>áspiz</em> → <strong>áspid</strong> (terminación incorrecta)

<strong>B) lacallo, ioduro, alcayata - 1 error:</strong>
• <em>lacayo</em> → <strong>lacayo</strong> (con "y")

<strong>C) Yantar, gayo, inexcrutable - 1 error:</strong>
• <em>inexcrutable</em> → <strong>inescrutable</strong> (con "s")

<strong style="color: #dc2626;">D) detección, lasante, parosismo - 3 errores:</strong>
• <em>detección</em> → <strong>detección</strong> (doble "c")
• <em>lasante</em> → <strong>laxante</strong> (con "x")
• <em>parosismo</em> → <strong>paroxismo</strong> (con "x")
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

    console.log('✅ Pregunta 20 añadida exitosamente')
    console.log(`📝 ID: ${data[0].id}`)
    console.log(`🔧 Componente: text_question`)
    console.log(`🔗 Link: http://localhost:3000/debug/question/${data[0].id}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

addPregunta20()