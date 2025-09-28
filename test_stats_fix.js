// Script to test the statistics fix
// Run this in browser console after logging in to verify the fix works

async function testStatisticsFix() {
  console.log('🔍 === TESTING STATISTICS FIX ===')
  
  // Get Supabase client from window context
  const supabase = window._supabase || window.supabase
  if (!supabase) {
    console.log('❌ Supabase client not found')
    return
  }

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.log('❌ No authenticated user found:', userError)
    return
  }

  console.log('👤 Testing for user:', user.id)

  try {
    // Test the OLD query (without is_completed filter)
    console.log('🔍 Testing OLD query (without is_completed filter)...')
    const { data: oldResults, error: oldError } = await supabase
      .from('test_questions')
      .select(`
        tema_number,
        is_correct,
        created_at,
        tests!inner(user_id)
      `)
      .eq('tests.user_id', user.id)
      .limit(100)

    console.log('📊 Old query results:', oldResults?.length || 0, 'records')
    if (oldError) console.log('❌ Old query error:', oldError)

    // Test the NEW query (with is_completed filter)
    console.log('🔍 Testing NEW query (with is_completed filter)...')
    const { data: newResults, error: newError } = await supabase
      .from('test_questions')
      .select(`
        tema_number,
        is_correct,
        created_at,
        tests!inner(user_id, is_completed)
      `)
      .eq('tests.user_id', user.id)
      .eq('tests.is_completed', true)
      .limit(100)

    console.log('📊 New query results:', newResults?.length || 0, 'records')
    if (newError) console.log('❌ New query error:', newError)

    // Compare results
    const difference = (oldResults?.length || 0) - (newResults?.length || 0)
    if (difference > 0) {
      console.log(`✅ Fix working! Filtered out ${difference} incomplete test records`)
    } else if (difference === 0) {
      console.log('ℹ️ No difference found - user has no incomplete tests')
    } else {
      console.log('⚠️ Unexpected result - new query has more records than old query')
    }

    // Process stats with the new query to test the full pipeline
    if (newResults && newResults.length > 0) {
      console.log('🔍 Testing statistics processing...')
      
      const themeStats = {}
      newResults.forEach(response => {
        const theme = response.tema_number
        if (!theme) return

        if (!themeStats[theme]) {
          themeStats[theme] = { 
            total: 0, 
            correct: 0, 
            lastStudy: null 
          }
        }
        
        themeStats[theme].total++
        if (response.is_correct) {
          themeStats[theme].correct++
        }
        
        const studyDate = new Date(response.created_at)
        if (!themeStats[theme].lastStudy || studyDate > themeStats[theme].lastStudy) {
          themeStats[theme].lastStudy = studyDate
        }
      })

      // Calculate percentages
      Object.keys(themeStats).forEach(theme => {
        const stats = themeStats[theme]
        stats.accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
        stats.lastStudyFormatted = stats.lastStudy ? stats.lastStudy.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short'
        }) : 'Nunca'
      })

      console.log('📈 Processed theme statistics:')
      Object.entries(themeStats).forEach(([theme, stats]) => {
        console.log(`  Tema ${theme}: ${stats.accuracy}% (${stats.correct}/${stats.total}) - Último: ${stats.lastStudyFormatted}`)
      })

      if (Object.keys(themeStats).length > 0) {
        console.log('✅ Statistics processing successful!')
      } else {
        console.log('⚠️ No theme statistics generated')
      }
    }

  } catch (error) {
    console.error('💥 Error during testing:', error)
  }
}

// Run the test
testStatisticsFix()

console.log('Test loaded. Results will appear above.')