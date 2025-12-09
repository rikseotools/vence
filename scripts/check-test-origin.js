// Verificar si guardamos información de origen/URL de los tests
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkTestOrigin() {
  try {
    console.log('🔍 Verificando qué campos tenemos en la tabla tests...\n')

    // Ver estructura de la tabla tests
    const { data: tests, error } = await supabase
      .from('tests')
      .select('*')
      .limit(5)

    if (error) {
      console.error('❌ Error:', error)
      return
    }

    if (tests && tests.length > 0) {
      console.log('📋 Campos disponibles en tabla tests:')
      console.log(Object.keys(tests[0]))
      console.log('\n📊 Ejemplo de test:')
      console.log(JSON.stringify(tests[0], null, 2))
    }

    // Ver si hay algún campo que pueda indicar origen
    console.log('\n🔍 Campos que podrían indicar origen:')
    const possibleOriginFields = ['title', 'test_type', 'source', 'origin', 'url', 'path', 'referrer']

    if (tests && tests.length > 0) {
      possibleOriginFields.forEach(field => {
        if (tests[0].hasOwnProperty(field)) {
          console.log(`  ✅ ${field}: ${tests[0][field]}`)
        } else {
          console.log(`  ❌ ${field}: NO EXISTE`)
        }
      })
    }

    // Ver si el campo title tiene información útil
    console.log('\n📝 Analizando campo "title" de varios tests:')
    const { data: moreTests, error: error2 } = await supabase
      .from('tests')
      .select('id, title, test_type, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (moreTests) {
      moreTests.forEach(test => {
        console.log(`  - ${test.title || 'SIN TÍTULO'} (tipo: ${test.test_type || 'sin tipo'})`)
      })
    }

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

checkTestOrigin()
