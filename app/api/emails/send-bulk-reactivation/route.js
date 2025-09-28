// app/api/emails/send-bulk-reactivation/route.js - Envío masivo a usuarios inactivos
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    console.log('📧 Iniciando envío masivo de emails de reactivación...')

    // Obtener usuarios inactivos (que no están activos como estudiantes)
    const { data: inactiveUsers, error: usersError } = await supabase
      .from('admin_users_with_roles')
      .select('user_id, email, full_name, is_active_student')
      .eq('is_active_student', false)

    if (usersError) {
      throw new Error(`Error obteniendo usuarios: ${usersError.message}`)
    }

    if (!inactiveUsers || inactiveUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay usuarios inactivos para enviar emails',
        sent: 0,
        skipped: 0,
        errors: 0
      })
    }

    console.log(`📊 Encontrados ${inactiveUsers.length} usuarios inactivos`)

    let sent = 0
    let skipped = 0
    let errors = 0
    const results = []

    // Enviar emails uno por uno con delay para no saturar
    for (const user of inactiveUsers) {
      try {
        console.log(`📧 Enviando a: ${user.email}`)

        // Llamar al endpoint individual de reactivación
        const response = await fetch('http://localhost:3002/api/emails/send-reactivation-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.user_id
          })
        })

        const result = await response.json()

        if (result.success) {
          sent++
          results.push({
            email: user.email,
            status: 'sent',
            emailId: result.emailId
          })
          
          // Registrar en BD para métricas
          try {
            await supabase.from('email_events').insert({
              user_id: user.user_id,
              event_type: 'sent',
              email_type: 'reactivation',
              email_address: user.email,
              subject: '🚀 ¡Hemos mejorado mucho! Nuevos 16 temas completos - ILoveTest',
              template_id: 'reactivation_v1',
              email_content_preview: 'Email de reactivación con nuevas funcionalidades y motivación',
              created_at: new Date().toISOString()
            })
          } catch (dbError) {
            console.warn('⚠️ Error registrando en BD:', dbError)
          }
          
          console.log(`✅ Enviado a ${user.email}`)
        } else {
          if (result.reason && (result.reason.includes('desactivó') || result.reason.includes('unsubscribed'))) {
            skipped++
            results.push({
              email: user.email,
              status: 'skipped',
              reason: result.reason
            })
            console.log(`⚠️ Saltado ${user.email}: ${result.reason}`)
          } else {
            errors++
            results.push({
              email: user.email,
              status: 'error',
              error: result.error || 'Error desconocido'
            })
            console.log(`❌ Error enviando a ${user.email}: ${result.error}`)
          }
        }

        // Delay de 500ms entre emails para no saturar
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        errors++
        results.push({
          email: user.email,
          status: 'error',
          error: error.message
        })
        console.error(`❌ Error enviando a ${user.email}:`, error)
      }
    }

    // Registrar la campaña masiva
    try {
      await supabase.from('email_events').insert({
        user_id: null, // Campaña masiva
        event_type: 'campaign_completed',
        email_type: 'reactivation_bulk',
        email_address: 'bulk_campaign',
        subject: `Campaña masiva reactivación - ${sent} enviados`,
        template_id: 'reactivation_bulk_v1',
        email_content_preview: `Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`,
        created_at: new Date().toISOString()
      })
    } catch (err) {
      console.warn('⚠️ Error logging bulk campaign:', err)
    }

    console.log(`🎉 Campaña completada: ${sent} enviados, ${skipped} saltados, ${errors} errores`)

    return NextResponse.json({
      success: true,
      message: `Campaña de reactivación completada`,
      totalUsers: inactiveUsers.length,
      sent,
      skipped,
      errors,
      results
    })

  } catch (error) {
    console.error('❌ Error en envío masivo:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}