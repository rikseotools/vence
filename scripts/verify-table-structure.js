import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verifyTableStructure() {
  console.log('📊 VERIFICANDO ESTRUCTURA DE test_questions\n')
  console.log('='.repeat(60))

  // Obtener columnas de la tabla
  const { data: columns, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', 'test_questions')
    .order('ordinal_position')

  if (error) {
    console.error('Error:', error)
    return
  }

  if (columns) {
    console.log('Columnas de test_questions:')
    columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(required)'
      console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}`)
    })
  }

  // Ver si hay triggers asociados
  console.log('\n🔧 TRIGGERS ASOCIADOS:')

  // Esta query no funciona directamente, pero podemos intentar
  console.log('No se puede consultar triggers directamente desde cliente')
  console.log('Pero podemos hacer una prueba práctica...')

  // Hacer prueba real con inserción mínima
  console.log('\n🧪 PRUEBA PRÁCTICA DE TRIGGER:')

  // Ver un registro existente para entender la estructura
  const { data: sample } = await supabase
    .from('test_questions')
    .select('*')
    .limit(1)
    .single()

  if (sample) {
    console.log('\nEjemplo de registro existente:')
    Object.keys(sample).forEach(key => {
      const value = sample[key]
      if (value !== null && value !== undefined && value !== '') {
        console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
      }
    })
  }
}

verifyTableStructure().catch(console.error)