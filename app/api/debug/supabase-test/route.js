import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    console.log('🧪 Testing Supabase connection...')
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase environment variables',
        supabaseUrl: !!supabaseUrl,
        supabaseKey: !!supabaseKey
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Test basic connection
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        supabaseUrl,
        timestamp: new Date().toISOString()
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Supabase connection working',
      supabaseUrl,
      timestamp: new Date().toISOString(),
      recordCount: data?.length || 0
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}