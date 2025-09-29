// app/api/admin/newsletters/send/route.js - Sistema de newsletters
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const body = await request.json()
    console.log('📧 Iniciando envío de newsletter...')
    
    const { 
      subject,
      htmlContent,
      audienceType,
      selectedUserIds, // Array de IDs de usuarios específicos
      fromName = 'Vence',
      fromEmail = 'noreply@vence.es',
      testMode = false
    } = body

    // Validar datos requeridos
    if (!subject || !htmlContent) {
      return NextResponse.json({
        success: false,
        error: 'Faltan datos requeridos: subject, htmlContent'
      }, { status: 400 })
    }

    if (!audienceType && !selectedUserIds?.length) {
      return NextResponse.json({
        success: false,
        error: 'Debe especificar audienceType o selectedUserIds'
      }, { status: 400 })
    }

    // Obtener usuarios según el tipo de audiencia
    let users = []
    
    if (selectedUserIds?.length) {
      // Envío a usuarios específicos
      console.log(`👥 Enviando a ${selectedUserIds.length} usuarios específicos`)
      
      const { data } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .in('id', selectedUserIds)
        .not('email', 'is', null)
      
      users = data || []
    } else {
      // Envío por audiencia
      switch (audienceType) {
      case 'all':
        const { data: allUsers } = await supabase
          .from('user_profiles')
          .select('id, email, full_name')
          .not('email', 'is', null)
        users = allUsers || []
        break

      case 'active':
        const { data: activeUsers } = await supabase
          .from('admin_users_with_roles')
          .select('user_id, email, full_name')
          .eq('is_active_student', true)
        users = activeUsers?.map(u => ({ id: u.user_id, email: u.email, full_name: u.full_name })) || []
        break

      case 'inactive':
        const { data: inactiveUsers } = await supabase
          .from('admin_users_with_roles')
          .select('user_id, email, full_name')
          .eq('is_active_student', false)
        users = inactiveUsers?.map(u => ({ id: u.user_id, email: u.email, full_name: u.full_name })) || []
        break

      case 'premium':
        const { data: premiumUsers } = await supabase
          .from('admin_users_with_roles')
          .select('user_id, email, full_name')
          .eq('subscription_status', 'active')
        users = premiumUsers?.map(u => ({ id: u.user_id, email: u.email, full_name: u.full_name })) || []
        break

      case 'free':
        const { data: freeUsers } = await supabase
          .from('admin_users_with_roles')  
          .select('user_id, email, full_name')
          .neq('subscription_status', 'active')
        users = freeUsers?.map(u => ({ id: u.user_id, email: u.email, full_name: u.full_name })) || []
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Tipo de audiencia no válido'
        }, { status: 400 })
      }
    }

    if (!users.length) {
      return NextResponse.json({
        success: true,
        message: 'No se encontraron usuarios para la audiencia seleccionada',
        sent: 0,
        failed: 0,
        total: 0
      })
    }

    console.log(`📊 Enviando newsletter a ${users.length} usuarios (audiencia: ${audienceType})`)

    // Si es modo test, solo enviar a los primeros 3 usuarios
    if (testMode) {
      users = users.slice(0, 3)
      console.log(`🧪 Modo test activado - enviando solo a ${users.length} usuarios`)
    }

    let sent = 0
    let failed = 0
    const errors = []

    // Enviar emails con rate limiting
    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      
      try {
        // Rate limiting: máximo 1 email por segundo (conservador para Resend)
        if (i > 0) {
          console.log('⏸️ Pausa de 1 segundo para rate limiting...')
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Personalizar HTML con nombre del usuario
        const personalizedHtml = htmlContent.replace(
          /\{user_name\}/g, 
          user.full_name || user.email.split('@')[0]
        )

        // Enviar con Resend con retry en caso de rate limiting
        let retries = 0
        const maxRetries = 3
        let success = false
        
        while (!success && retries < maxRetries) {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: `${fromName} <${fromEmail}>`,
              to: [user.email],
              subject: subject,
              html: personalizedHtml
            })
          })

          const result = await response.json()

          if (response.ok) {
            sent++
            success = true
            
            // Registrar en analytics si no es modo test
            if (!testMode) {
              await supabase.from('email_events').insert({
                user_id: user.id,
                email_id: result.id,
                event_type: 'sent',
                email_type: 'newsletter',
                email_address: user.email,
                subject: subject,
                template_id: 'newsletter',
                metadata: {
                  audience_type: audienceType,
                  from_name: fromName
                }
              })
            }
          } else if (response.status === 429) {
            // Rate limit - esperar más tiempo y reintentar
            retries++
            console.log(`⏳ Rate limit hit for ${user.email}, retry ${retries}/${maxRetries}`)
            
            if (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 3000)) // 3 segundos
            } else {
              failed++
              errors.push({
                email: user.email,
                error: `Rate limit excedido después de ${maxRetries} intentos`
              })
            }
          } else {
            // Otro error - no reintentar
            failed++
            errors.push({
              email: user.email,
              error: result.message || 'Error desconocido'
            })
            break
          }
        }

      } catch (error) {
        failed++
        errors.push({
          email: user.email,
          error: error.message
        })
      }
    }

    console.log(`✅ Newsletter completada: ${sent} enviados, ${failed} fallos`)

    return NextResponse.json({
      success: true,
      message: `Newsletter enviada exitosamente`,
      total: users.length,
      sent,
      failed,
      audienceType,
      testMode,
      errors: errors.slice(0, 10) // Solo mostrar los primeros 10 errores
    })

  } catch (error) {
    console.error('❌ Error enviando newsletter:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}