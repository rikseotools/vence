// app/api/email-tracking/open/route.js - Pixel tracking para aperturas
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
    const type = searchParams.get('type') || 'motivation'
    const templateId = searchParams.get('template_id')
    const campaignId = searchParams.get('campaign_id') // ✅ Capturar campaign_id del tracking pixel

    console.log('📧 Email abierto:', { emailId, userId, type, templateId, campaignId })

    // 🛡️ DEDUPLICACIÓN: Evitar registros duplicados en corto tiempo
    if (userId) {
      // Verificar si ya se registró una apertura en los últimos 5 minutos
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      
      const { data: recentOpens } = await getSupabase()
        .from('email_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'opened')
        .eq('email_type', type)
        .gte('created_at', fiveMinutesAgo)
        .limit(1)

      if (recentOpens && recentOpens.length > 0) {
        console.log('⏸️ Apertura duplicada ignorada - cooldown de 5 minutos activo')
      } else {
        // Obtener información del usuario para el tracking
        const { data: userProfile } = await getSupabase()
          .from('user_profiles')
          .select('email')
          .eq('id', userId)
          .single()

        await getSupabase().from('email_events').insert({
          user_id: userId,
          event_type: 'opened',
          email_type: type, // ✅ FIX: Usar el tipo real del email
          email_address: userProfile?.email || 'unknown@tracking.vence.es',
          subject: `${type} Email - Opened`,
          template_id: templateId || type,
          campaign_id: campaignId, // ✅ CRÍTICO: Guardar campaign_id para asociar opens con sends
          email_content_preview: `${type} email opened - tracking event`,
          created_at: new Date().toISOString()
        })
        
        console.log('✅ Evento de apertura registrado con deduplicación')
      }
    }

    // Devolver pixel transparente 1x1
    const pixelBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    )

    return new NextResponse(pixelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': pixelBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('❌ Error tracking email open:', error)
    
    // Siempre devolver pixel aunque haya error
    const pixelBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    )

    return new NextResponse(pixelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache'
      }
    })
  }
}