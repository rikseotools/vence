// debug_rls_permissions.js - Debug RLS and permissions
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔍 DEBUGGING RLS Y PERMISOS')
console.log('URL:', supabaseUrl)
console.log('Anon Key starts with:', supabaseAnonKey?.substring(0, 10) + '...')
console.log('Service Key starts with:', supabaseServiceKey?.substring(0, 10) + '...')

// Create both clients
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

async function debugPermissions() {
  try {
    console.log('\n🔍 === VERIFICANDO PERMISOS CON ANON KEY ===')
    
    // Test with anon key (what the JavaScript app uses)
    const { data: anonData, error: anonError } = await supabaseAnon
      .from('email_events')
      .select('*')
      .gte('created_at', '2025-10-10T00:00:00.000Z')
      .lte('created_at', '2025-10-10T23:59:59.999Z')
      
    console.log('ANON KEY Query result:', { 
      count: anonData?.length, 
      error: anonError?.message,
      firstEvent: anonData?.[0]
    })
    
    console.log('\n🔍 === VERIFICANDO PERMISOS CON SERVICE KEY ===')
    
    // Test with service key (what SQL console likely uses)
    const { data: serviceData, error: serviceError } = await supabaseService
      .from('email_events')
      .select('*')
      .gte('created_at', '2025-10-10T00:00:00.000Z')
      .lte('created_at', '2025-10-10T23:59:59.999Z')
      
    console.log('SERVICE KEY Query result:', { 
      count: serviceData?.length, 
      error: serviceError?.message,
      firstEvent: serviceData?.[0]
    })
    
    console.log('\n🔍 === COMPARACIÓN ===')
    console.log(`Anon key returned: ${anonData?.length || 0} events`)
    console.log(`Service key returned: ${serviceData?.length || 0} events`)
    
    if (serviceData?.length > 0) {
      console.log('\n📊 === BREAKDOWN BY EVENT TYPE (SERVICE) ===')
      const eventTypes = serviceData.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1
        return acc
      }, {})
      console.log('Event types:', eventTypes)
    }
    
    // Check RLS policies
    console.log('\n🔍 === VERIFICANDO POLÍTICAS RLS ===')
    const { data: policies, error: policiesError } = await supabaseService
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'email_events')
      
    console.log('RLS Policies:', { 
      count: policies?.length, 
      error: policiesError?.message,
      policies: policies?.map(p => ({
        name: p.policyname,
        cmd: p.cmd,
        roles: p.roles
      }))
    })
    
  } catch (error) {
    console.error('❌ Error en debug:', error)
  }
}

debugPermissions()