require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  // Fecha de hoy en Madrid
  const todayMadrid = new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })

  console.log(`📅 Verificando tests completados hoy (${todayMadrid})...\n`)

  const { data: completedToday, error } = await supabase
    .from('tests')
    .select('id, user_id, created_at, completed_at, is_completed, total_questions')
    .eq('is_completed', true)
    .gte('completed_at', new Date().toISOString().split('T')[0] + 'T00:00:00Z')

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`✅ Tests completados hoy: ${completedToday.length}`)

  if (completedToday.length > 0) {
    console.log('\n📝 DETALLES:')
    completedToday.forEach((test, i) => {
      const completedTime = new Date(test.completed_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
      console.log(`${i + 1}. Test ${test.id} - ${test.total_questions} preguntas - ${completedTime}`)
    })

    const uniqueUsers = new Set(completedToday.map(t => t.user_id)).size
    console.log(`\n👥 Usuarios únicos: ${uniqueUsers}`)
  }
}

main()
