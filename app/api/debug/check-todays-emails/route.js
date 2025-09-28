// app/api/debug/check-todays-emails/route.js - Verificar emails de hoy
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET() {
  try {
    // Obtener todos los eventos de email de hoy
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    const { data: todaysEmails, error } = await supabase
      .from('email_events')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
    
    if (error) throw error

    // Agrupar por tipo de evento
    const byEventType = todaysEmails.reduce((acc, email) => {
      acc[email.event_type] = (acc[email.event_type] || 0) + 1
      return acc
    }, {})

    // Agrupar por template
    const byTemplate = todaysEmails.reduce((acc, email) => {
      acc[email.template_id || 'unknown'] = (acc[email.template_id || 'unknown'] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      date: today,
      totalEmails: todaysEmails.length,
      byEventType,
      byTemplate,
      recentEmails: todaysEmails.slice(0, 10) // Los 10 más recientes
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}