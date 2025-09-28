// Debug endpoint para verificar el tracking
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  try {
    console.log('🔍 Debug endpoint iniciado')
    
    // Verificar variables de entorno
    console.log('Environment check:', {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 50) + '...'
    })
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY no encontrada')
      return NextResponse.json({ error: 'Missing Supabase service key' })
    }
    
    // Crear cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    console.log('✅ Cliente Supabase creado')
    
    // Primero, verificar estructura de la tabla
    console.log('🔍 Verificando estructura de email_events...')
    
    const { data: tableInfo, error: tableError } = await supabase
      .from('email_events')
      .select('*')
      .limit(1)
    
    if (tableError) {
      console.error('❌ Error accediendo a email_events:', tableError)
    } else {
      console.log('✅ Tabla email_events accesible. Sample:', tableInfo?.[0] ? Object.keys(tableInfo[0]) : 'empty table')
    }
    
    // Obtener un UUID real de usuario para testing
    const { data: realUser } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)
    
    const realUserId = realUser?.[0]?.id || '00000000-0000-0000-0000-000000000000'
    console.log('🔍 Usando user_id real:', realUserId)
    
    // Probar inserción de evento de CLICK (con tipos válidos)
    const testEvent = {
      user_id: realUserId,
      event_type: 'clicked',
      email_type: 'motivation', // Tipo válido según la página admin
      email_address: 'debug@test.com',
      subject: 'Test tracking - Click',
      template_id: 'comeback',
      email_content_preview: 'Debug email CLICK tracking',
      created_at: new Date().toISOString()
    }
    
    console.log('🧪 Insertando evento de prueba:', testEvent)
    
    const { data, error } = await supabase
      .from('email_events')
      .insert(testEvent)
      .select()
    
    if (error) {
      console.error('❌ Error insertando en email_events:', error)
      return NextResponse.json({ 
        error: 'Database error', 
        details: error,
        supabaseConnected: true
      })
    }
    
    console.log('✅ Evento insertado correctamente:', data)
    
    // Verificar que se puede leer (sin email_id)
    const { data: readData, error: readError } = await supabase
      .from('email_events')
      .select('*')
      .eq('user_id', realUserId)
      .limit(1)
    
    if (readError) {
      console.error('❌ Error leyendo email_events:', readError)
      return NextResponse.json({ 
        error: 'Read error', 
        details: readError,
        insertSuccess: true
      })
    }
    
    console.log('✅ Evento leído correctamente:', readData)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Tracking debug completado',
      insertedData: data,
      readData: readData,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Error en debug endpoint:', error)
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error.message 
    })
  }
}