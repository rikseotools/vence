// Analizar títulos de tests para detectar método de estudio
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function analyzeTestTitles() {
  try {
    console.log('🔍 Analizando títulos de tests para detectar patrones...\n')

    // Usuarios de prueba
    const usuarios = [
      { id: '7194d681-0047-47da-8d2f-45634b2605a1', nombre: 'Inma Corcuera' },
      { id: '60798ede-09d3-49b9-ad1e-712201d2169c', nombre: 'David' },
    ]

    // Agregar algunos usuarios más
    const { data: activeUsers } = await supabase
      .from('user_streaks')
      .select('user_id')
      .order('current_streak', { ascending: false })
      .limit(5)

    if (activeUsers) {
      for (const user of activeUsers) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', user.user_id)
          .single()

        if (profile && !usuarios.find(u => u.id === user.user_id)) {
          usuarios.push({ id: user.user_id, nombre: profile.full_name || 'Usuario' })
        }
      }
    }

    for (const usuario of usuarios) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`📊 ${usuario.nombre}`)
      console.log('='.repeat(60))

      const { data: tests } = await supabase
        .from('tests')
        .select('title, test_type, tema_number, created_at')
        .eq('user_id', usuario.id)
        .eq('is_completed', true)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!tests || tests.length === 0) {
        console.log('Sin tests completados\n')
        continue
      }

      console.log(`\nÚltimos ${tests.length} tests:`)

      // Contadores
      const patterns = {
        tema: 0,
        ley: 0,
        aleatorio: 0,
        rapido: 0,
        personalizado: 0,
        desconocido: 0
      }

      tests.forEach((test, idx) => {
        const title = test.title || 'SIN TÍTULO'
        console.log(`  ${idx + 1}. ${title}`)

        // Detectar patrón
        if (title.match(/Test Tema \d+/i)) {
          patterns.tema++
        } else if (title.match(/Ley \d+\/\d+|LO \d+\/\d+|RD \d+\/\d+|CE|TFUE|TUE/i)) {
          patterns.ley++
        } else if (title.match(/aleatorio|random/i)) {
          patterns.aleatorio++
        } else if (title.match(/rápido|quick/i)) {
          patterns.rapido++
        } else if (title.match(/personalizado|custom/i)) {
          patterns.personalizado++
        } else {
          patterns.desconocido++
        }
      })

      console.log('\n📈 Distribución por patrón:')
      Object.entries(patterns).forEach(([key, count]) => {
        if (count > 0) {
          const percentage = Math.round((count / tests.length) * 100)
          console.log(`  ${key}: ${count} (${percentage}%)`)
        }
      })

      // Clasificación
      const totalTests = tests.length
      const temaPercentage = Math.round((patterns.tema / totalTests) * 100)
      const leyPercentage = Math.round((patterns.ley / totalTests) * 100)

      console.log('\n🎯 MÉTODO DETECTADO:')
      if (temaPercentage > 50) {
        console.log(`  📚 ESTUDIA POR TEMAS (${temaPercentage}% de tests)`)
      } else if (leyPercentage > 30) {
        console.log(`  ⚖️ ESTUDIA POR LEYES (${leyPercentage}% de tests)`)
      } else {
        console.log(`  🎲 TESTS ALEATORIOS/VARIADOS`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('💡 CONCLUSIÓN:')
    console.log('='.repeat(60))
    console.log('\nAnalizando el campo "title" podemos detectar:')
    console.log('  - "Test Tema X" → Estudia por temas')
    console.log('  - Título con nombre de ley → Estudia por leyes')
    console.log('  - Otros → Tests aleatorios')
    console.log('\n✅ Este método es MÁS FIABLE que analizar porcentajes')
    console.log('')

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

analyzeTestTitles()
