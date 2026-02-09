// app/api/email-tracking/click/route.js - Tracking de clicks en botones
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
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
    const campaignId = searchParams.get('campaign_id') // ✅ Capturar campaign_id
    const redirect = searchParams.get('redirect')

    console.log('🖱️ Email click:', { emailId, userId, action, type, templateId, campaignId, redirect })

    // 🛡️ DEDUPLICACIÓN: Evitar registros duplicados de clicks
    if (userId) {
      // Verificar si ya se registró un click similar en los últimos 2 minutos
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
      
      const { data: recentClicks } = await getSupabase()
        .from('email_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'clicked')
        .eq('email_type', type)
        .gte('created_at', twoMinutesAgo)
        .limit(1)

      if (recentClicks && recentClicks.length > 0) {
        console.log('⏸️ Click duplicado ignorado - cooldown de 2 minutos activo')
      } else {
        // Obtener información del usuario para el tracking
        const { data: userProfile } = await getSupabase()
          .from('user_profiles')
          .select('email')
          .eq('id', userId)
          .single()

        await getSupabase().from('email_events').insert({
          user_id: userId,
          event_type: 'clicked',
          email_type: type, // ✅ FIX: Usar el tipo real del email
          email_address: userProfile?.email || 'unknown@tracking.vence.es',
          subject: `${type} Email - Clicked`,
          template_id: templateId || type,
          campaign_id: campaignId, // ✅ CRÍTICO: Guardar campaign_id para asociar clicks con sends
          email_content_preview: `${type} email link clicked: ${action} -> ${redirect}`,
          created_at: new Date().toISOString()
        })
        
        console.log('✅ Evento de click registrado con deduplicación')
      }
    }

    // Redirigir al destino final
    if (redirect) {
      return NextResponse.redirect(redirect, { status: 302 })
    }

    // Si no hay redirect, ir al dashboard por defecto
    return NextResponse.redirect('https://www.vence.es/auxiliar-administrativo-estado/test', { 
      status: 302 
    })

  } catch (error) {
    console.error('❌ Error tracking email click:', error)
    
    // Si hay error, redirigir a destino por defecto
    const fallbackUrl = searchParams.get('redirect') || 'https://www.vence.es/auxiliar-administrativo-estado/test'
    return NextResponse.redirect(fallbackUrl, { status: 302 })
  }
}