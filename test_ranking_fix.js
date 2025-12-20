// test_ranking_fix.js
// Test script to verify the medal system ranking fix
// Run in browser console when logged into the app

export async function testRankingFix() {
  console.log('🧪 === TESTING RANKING FIX ===')
  
  if (typeof window === 'undefined') {
    console.log('❌ Run this in browser console')
    return
  }

  try {
    // Get supabase client
    const supabaseClient = window.supabase || window._supabase
    if (!supabaseClient) {
      console.log('❌ Supabase client not found')
      return
    }

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.log('❌ No authenticated user:', userError)
      return
    }

    console.log('👤 Testing for user:', user.id)

    const now = new Date()
    console.log('🕒 Current time:', now.toISOString())

    // Test the FIXED "today" filtering
    console.log('\n🔧 Testing FIXED "today" filtering...')
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    
    console.log('📅 Today start:', today.toISOString())
    console.log('📅 Today end:', todayEnd.toISOString())

    const { data: todayResponses, error: todayError } = await supabaseClient
      .from('test_questions')
      .select(`
        tests!inner(user_id),
        is_correct,
        created_at
      `)
      .eq('tests.is_completed', true)
      .gte('created_at', today.toISOString())
      .lte('created_at', todayEnd.toISOString())

    if (todayError) {
      console.log('❌ Query error:', todayError)
      return
    }

    console.log('📊 Today responses found:', todayResponses?.length || 0)

    // Process data exactly like RankingModal does
    const userStats = {}
    todayResponses?.forEach(response => {
      const userId = response.tests.user_id
      if (!userStats[userId]) {
        userStats[userId] = {
          userId,
          totalQuestions: 0,
          correctAnswers: 0,
          accuracy: 0
        }
      }
      
      userStats[userId].totalQuestions++
      if (response.is_correct) {
        userStats[userId].correctAnswers++
      }
    })

    // Calculate ranking
    const ranking = Object.values(userStats)
      .filter(user => user.totalQuestions >= 5)
      .map(user => ({
        ...user,
        accuracy: Math.round((user.correctAnswers / user.totalQuestions) * 100)
      }))
      .sort((a, b) => {
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy
        return b.totalQuestions - a.totalQuestions
      })

    console.log('\n🏆 Today\'s ranking:')
    if (ranking.length === 0) {
      console.log('📭 No users in ranking (need minimum 5 questions)')
    } else {
      ranking.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'
        const isCurrentUser = user.userId === user.id ? ' (YOU)' : ''
        console.log(`${medal} #${index + 1}: User ${user.userId}${isCurrentUser} - ${user.accuracy}% (${user.correctAnswers}/${user.totalQuestions})`)
      })
    }

    // Check current user's position
    const currentUserRank = ranking.findIndex(u => u.userId === user.id) + 1
    if (currentUserRank > 0) {
      console.log(`\n👤 Your position: #${currentUserRank}`)
      const userStats = ranking[currentUserRank - 1]
      console.log(`📊 Your stats: ${userStats.accuracy}% (${userStats.correctAnswers}/${userStats.totalQuestions})`)
      
      // Check medal eligibility
      if (currentUserRank === 1 && ranking.length >= 1) {
        console.log('🥇 You should get FIRST_PLACE_TODAY medal!')
      } else if (currentUserRank >= 2 && currentUserRank <= 3 && ranking.length >= 2) {
        console.log('🏅 You should get TOP_3_TODAY medal!')
      }
    } else {
      console.log('\n👤 You are not in today\'s ranking')
      console.log('💡 Need at least 5 correct answers to appear')
    }

    // Compare with OLD (broken) filtering
    console.log('\n🔍 Comparing with OLD filtering method...')
    
    const { data: oldResponses } = await supabaseClient
      .from('test_questions')
      .select(`
        tests!inner(user_id),
        is_correct,
        created_at
      `)
      .eq('tests.is_completed', true)
      .gte('created_at', today.toISOString()) // OLD method - no upper bound

    console.log('📊 Old method responses:', oldResponses?.length || 0)
    console.log('📊 New method responses:', todayResponses?.length || 0)
    
    if ((oldResponses?.length || 0) !== (todayResponses?.length || 0)) {
      console.log('✅ Fix is working! Different results between old and new method.')
    } else {
      console.log('ℹ️ Same results - either no data boundary issues or no recent data')
    }

    // Test edge case: data from tomorrow (if any exists)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    const { data: futureResponses } = await supabaseClient
      .from('test_questions')
      .select('id, created_at')
      .gte('created_at', tomorrow.toISOString())
      .limit(1)

    if (futureResponses?.length > 0) {
      console.log('⚠️ Found future data that old method would incorrectly include')
    } else {
      console.log('✅ No future data found')
    }

  } catch (error) {
    console.log('❌ Test error:', error)
  }

  console.log('\n🧪 === TEST COMPLETE ===')
}

// Make available globally  
if (typeof window !== 'undefined') {
  window.testRankingFix = testRankingFix
  console.log('✅ testRankingFix() available in console')
}

export default testRankingFix