// app/api/setup-email-preferences/route.js - Setup automático de tabla
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({
        error: 'Missing Supabase credentials'
      }, { status: 500 })
    }

    const results = {
      timestamp: new Date().toISOString(),
      table_creation: null,
      policies_creation: null,
      test_insert: null
    }

    // 1. Crear tabla email_preferences
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS email_preferences (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL,
          unsubscribed_all BOOLEAN DEFAULT false,
          unsubscribed_motivational BOOLEAN DEFAULT false,
          unsubscribed_achievements BOOLEAN DEFAULT false,
          unsubscribed_reminders BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id ON email_preferences(user_id);
    `

    const tableResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: createTableSQL })
    })

    results.table_creation = {
      status: tableResponse.ok ? '✅ Table created' : '❌ Failed to create table',
      status_code: tableResponse.status,
      response: tableResponse.ok ? 'Success' : await tableResponse.text()
    }

    // 2. Habilitar RLS y crear políticas
    const rlsSQL = `
      ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Users can manage own email preferences" ON email_preferences;
      CREATE POLICY "Users can manage own email preferences" 
          ON email_preferences FOR ALL 
          USING (true);
    `

    const rlsResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: rlsSQL })
    })

    results.policies_creation = {
      status: rlsResponse.ok ? '✅ RLS configured' : '❌ Failed to configure RLS',
      status_code: rlsResponse.status,
      response: rlsResponse.ok ? 'Success' : await rlsResponse.text()
    }

    // 3. Test insert
    const testUserId = 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256'
    const testInsertResponse = await fetch(`${SUPABASE_URL}/rest/v1/email_preferences`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: testUserId,
        unsubscribed_all: true,
        unsubscribed_motivational: true,
        unsubscribed_achievements: true,
        unsubscribed_reminders: true,
        updated_at: new Date().toISOString()
      })
    })

    results.test_insert = {
      status: testInsertResponse.ok ? '✅ Test insert successful' : '❌ Test insert failed',
      status_code: testInsertResponse.status,
      response: testInsertResponse.ok ? 'Success' : await testInsertResponse.text()
    }

    return NextResponse.json(results, { status: 200 })

  } catch (error) {
    return NextResponse.json({
      error: 'Setup failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}