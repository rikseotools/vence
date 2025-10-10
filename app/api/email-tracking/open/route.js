// app/api/email-tracking/open/route.js - Pixel tracking para aperturas
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
    const type = searchParams.get('type') || 'motivation'
    const templateId = searchParams.get('template_id')
    
    console.log('📧 Email abierto:', { emailId, userId, type, templateId })

    // Registrar evento de apertura con campos requeridos
    if (userId) {
      // Obtener información del usuario para el tracking
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', userId)
        .single()

      await supabase.from('email_events').insert({
        user_id: userId,
        event_type: 'opened',
        email_type: 'newsletter',
        email_address: userProfile?.email || 'unknown@tracking.vence.es',
        subject: type === 'newsletter' ? 'Newsletter Opened' : 'Email Tracking - Opened',
        template_id: templateId || 'newsletter',
        email_content_preview: `${type} email opened - tracking event`,
        created_at: new Date().toISOString()
      })
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