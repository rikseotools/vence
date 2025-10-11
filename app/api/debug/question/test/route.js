import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔍 Testing Supabase connection...')
    console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('Service key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Test básico de conexión
    const { data: test, error: testError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, question_subtype')
      .limit(3)

    if (testError) {
      console.error('❌ Test error:', testError)
      return Response.json({ 
        error: 'Database connection failed', 
        details: testError 
      }, { status: 500 })
    }

    console.log('✅ Found questions:', test?.length)

    // Buscar la pregunta específica
    const questionId = '588c79ed-05fa-421a-8f32-23e4038b700b'
    const { data: specific, error: specificError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text, question_subtype')
      .eq('id', questionId)

    if (specificError) {
      console.error('❌ Specific error:', specificError)
    }

    console.log('🎯 Specific question found:', specific?.length)

    return Response.json({
      success: true,
      test_query: test,
      specific_query: specific,
      connection: 'OK'
    })

  } catch (error) {
    console.error('❌ API Error:', error)
    return Response.json(
      { error: 'Internal server error', details: error.message }, 
      { status: 500 }
    )
  }
}