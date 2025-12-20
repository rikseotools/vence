// app/api/debug-unsubscribe/route.js - Debug endpoint
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email') || 'ilovetestpro@gmail.com'
    
    const debug = {
      timestamp: new Date().toISOString(),
      email: email,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing',
        SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing',
        ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
        UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET ? '✅ Set' : '❌ Missing (using default)'
      },
      token_generation: null,
      supabase_connection: null,
      user_lookup: null
    }

    // Test token generation
    try {
      const secret = process.env.UNSUBSCRIBE_SECRET || 'ilovetest-unsubscribe-2025'
      const token = crypto
        .createHmac('sha256', secret)
        .update(email)
        .digest('hex')
        .substring(0, 16)
      
      debug.token_generation = {
        status: '✅ Success',
        token: token,
        secret_length: secret.length
      }
    } catch (error) {
      debug.token_generation = {
        status: '❌ Error',
        error: error.message
      }
    }

    // Test Supabase connection
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        })
        
        debug.supabase_connection = {
          status: response.ok ? '✅ Connected' : '❌ Connection failed',
          status_code: response.status,
          url: SUPABASE_URL.substring(0, 30) + '...'
        }

        // Test user lookup
        if (response.ok) {
          const userResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}&select=id,email`, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          })
          
          const users = await userResponse.json()
          debug.user_lookup = {
            status: userResponse.ok ? '✅ Query successful' : '❌ Query failed',
            status_code: userResponse.status,
            user_found: users?.length > 0 ? '✅ User exists' : '❌ User not found',
            users_count: users?.length || 0,
            response_preview: JSON.stringify(users).substring(0, 200)
          }
        }
      } catch (error) {
        debug.supabase_connection = {
          status: '❌ Connection error',
          error: error.message
        }
      }
    } else {
      debug.supabase_connection = {
        status: '❌ Missing credentials',
        missing: !SUPABASE_URL ? 'SUPABASE_URL' : 'SUPABASE_KEY'
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