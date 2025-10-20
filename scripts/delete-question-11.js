import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function deleteQuestion11() {
  try {
    const { data, error } = await supabase
      .from('psychometric_questions')
      .delete()
      .eq('id', '70859b70-8829-4db2-aab4-e787a3dbbcac')
      .select()

    if (error) {
      console.error('❌ Error eliminando pregunta:', error)
      return
    }

    console.log('✅ Pregunta 11 (código palabra) eliminada exitosamente')
    console.log(`📝 Pregunta eliminada: ${data[0]?.id || 'No encontrada'}`)

  } catch (error) {
    console.error('❌ Error en script:', error)
  }
}

deleteQuestion11()