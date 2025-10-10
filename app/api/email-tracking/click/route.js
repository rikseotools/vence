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
    const templateId = searchParams.get('template_id')
    const redirect = searchParams.get('redirect')
    
    console.log('🖱️ Email click:', { emailId, userId, action, type, templateId, redirect })

    // Registrar evento de click con campos requeridos
    if (userId) {
      // Obtener información del usuario para el tracking
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', userId)
        .single()

      await supabase.from('email_events').insert({
        user_id: userId,
        event_type: 'clicked',
        email_type: 'newsletter',
        email_address: userProfile?.email || 'unknown@tracking.vence.es',
        subject: type === 'newsletter' ? 'Newsletter Link Clicked' : 'Email Tracking - Clicked',
        template_id: templateId || 'newsletter',
        email_content_preview: `${type} email link clicked: ${action} -> ${redirect}`,
        created_at: new Date().toISOString()
      })
    }

    // Redirigir al destino final
    if (redirect) {
      return NextResponse.redirect(redirect, { status: 302 })
    }

    // Si no hay redirect, ir al dashboard por defecto
    return NextResponse.redirect('https://vence.es/auxiliar-administrativo-estado/test', { 
      status: 302 
    })

  } catch (error) {
    console.error('❌ Error tracking email click:', error)
    
    // Si hay error, redirigir a destino por defecto
    const fallbackUrl = searchParams.get('redirect') || 'https://vence.es/auxiliar-administrativo-estado/test'
    return NextResponse.redirect(fallbackUrl, { status: 302 })
  }
}