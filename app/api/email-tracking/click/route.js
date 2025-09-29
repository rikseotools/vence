// app/api/email-tracking/click/route.js - Tracking de clicks en botones
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get('email_id')
    const userId = searchParams.get('user_id')
    const action = searchParams.get('action') || 'unknown'
    const type = searchParams.get('type') || 'motivation'
    const redirect = searchParams.get('redirect')
    
    console.log('🖱️ Email click:', { emailId, userId, action, type, redirect })

    // Registrar evento de click con campos requeridos
    if (userId) {
      await supabase.from('email_events').insert({
        user_id: userId,
        event_type: 'clicked',
        email_type: type,
        email_address: 'tracking@ilovetest.pro', // Email placeholder para tracking
        subject: 'Email Tracking - Clicked',
        template_id: 'tracking_click',
        email_content_preview: `Email button clicked: ${action}`,
        created_at: new Date().toISOString()
      })
    }

    // Redirigir al destino final
    if (redirect) {
      return NextResponse.redirect(redirect, { status: 302 })
    }

    // Si no hay redirect, ir al dashboard por defecto
    return NextResponse.redirect('https://ilovetest.pro/auxiliar-administrativo-estado/test', { 
      status: 302 
    })

  } catch (error) {
    console.error('❌ Error tracking email click:', error)
    
    // Si hay error, redirigir a destino por defecto
    const fallbackUrl = searchParams.get('redirect') || 'https://ilovetest.pro/auxiliar-administrativo-estado/test'
    return NextResponse.redirect(fallbackUrl, { status: 302 })
  }
}