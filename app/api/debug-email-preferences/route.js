// app/api/debug-email-preferences/route.js - Debug tabla email_preferences
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email') || 'ilovetestpro@gmail.com'
    
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const debug = {
      timestamp: new Date().toISOString(),
      email: email,
      user_id: 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256', // Del debug anterior
      table_check: null,
      existing_preferences: null,
      insert_test: null
    }

    // 1. Verificar si la tabla email_preferences existe
    try {
      const tableResponse = await fetch(`${SUPABASE_URL}/rest/v1/email_preferences?select=*&limit=1`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      })
      
      debug.table_check = {
        status: tableResponse.ok ? '✅ Table exists' : '❌ Table missing',
        status_code: tableResponse.status,
        error: tableResponse.ok ? null : await tableResponse.text()
      }

      // 2. Buscar preferencias existentes del usuario
      if (tableResponse.ok) {
        const userPrefsResponse = await fetch(`${SUPABASE_URL}/rest/v1/email_preferences?user_id=eq.${debug.user_id}`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        })
        
        const userPrefs = await userPrefsResponse.json()
        debug.existing_preferences = {
          status: userPrefsResponse.ok ? '✅ Query successful' : '❌ Query failed',
          status_code: userPrefsResponse.status,
          preferences_found: userPrefs?.length > 0,
          data: userPrefs
        }

        // 3. Intentar insertar/actualizar preferencias
        const testData = {
          user_id: debug.user_id,
          unsubscribed_all: true,
          email_reactivacion: false,
          email_urgente: false,
          email_bienvenida_motivacional: false,
          email_bienvenida_inmediato: false,
          email_resumen_semanal: false,
          unsubscribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/email_preferences`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(testData)
        })

        debug.insert_test = {
          status: insertResponse.ok ? '✅ Insert/Update successful' : '❌ Insert/Update failed',
          status_code: insertResponse.status,
          response_body: insertResponse.ok ? 'Success' : await insertResponse.text(),
          test_data: testData
        }
      }

    } catch (error) {
      debug.table_check = {
        status: '❌ Error checking table',
        error: error.message
      }
    }

    return NextResponse.json(debug, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Debug endpoint failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}