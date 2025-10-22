import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function checkCategories() {
  try {
    const supabase = getSupabase()
    
    console.log('🔍 Checking categories...')
    const { data: categories } = await supabase
      .from('psychometric_categories')
      .select('*')
    
    console.log('📊 Categories found:', categories)
    
    console.log('🔍 Checking sections...')
    const { data: sections } = await supabase
      .from('psychometric_sections')
      .select('*')
    
    console.log('📊 Sections found:', sections)
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkCategories()