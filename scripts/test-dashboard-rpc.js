// Test script to verify the dashboard RPC function
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testDashboardStats() {
  console.log('🔍 Testing get_dashboard_stats RPC function...\n')

  try {
    // Call the RPC function
    const { data: dashboardStats, error: rpcError } = await supabase
      .rpc('get_dashboard_stats')

    if (rpcError) {
      console.error('❌ Error calling RPC:', rpcError)
      return
    }

    if (!dashboardStats || dashboardStats.length === 0) {
      console.error('❌ No data returned from RPC')
      return
    }

    const stats = dashboardStats[0]
    console.log('✅ Dashboard Statistics:')
    console.log('━'.repeat(40))
    console.log(`Total Users: ${stats.total_users}`)
    console.log(`Users with Tests: ${stats.users_with_tests}`)
    console.log(`Engagement Rate: ${stats.engagement_percentage}%`)
    console.log('━'.repeat(40))

    // Verify the engagement calculation
    if (stats.total_users > 0) {
      const calculatedEngagement = Math.round((stats.users_with_tests / stats.total_users) * 100)
      console.log(`\n📊 Verification:`)
      console.log(`Calculated: ${calculatedEngagement}%`)
      console.log(`Returned: ${stats.engagement_percentage}%`)
      console.log(`Match: ${calculatedEngagement === stats.engagement_percentage ? '✅' : '❌'}`)
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err)
  }
}

testDashboardStats()