import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkStructure() {
  // Obtener una fila de ejemplo para ver las columnas
  const { data: testSample } = await supabase
    .from('tests')
    .select('*')
    .limit(1)
  
  if (testSample && testSample[0]) {
    console.log('📋 Columnas de la tabla tests:')
    console.log(Object.keys(testSample[0]).join(', '))
  }
  
  // También para test_questions
  const { data: questionSample } = await supabase
    .from('test_questions')
    .select('*')
    .limit(1)
  
  if (questionSample && questionSample[0]) {
    console.log('\n📋 Columnas de la tabla test_questions:')
    console.log(Object.keys(questionSample[0]).join(', '))
  }
}

checkStructure().catch(console.error)
