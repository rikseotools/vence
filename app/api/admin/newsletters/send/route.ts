// app/api/admin/newsletters/send/route.ts - Sistema de envío de newsletters
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  safeParseSendRequest,
  getNewsletterAudience,
  replaceNewsletterVariables,
  type SendNewsletterRequest,
  type EligibleUser
} from '@/lib/api/newsletters'
import { renderTemplate, getEmailTemplate, getActiveOposiciones } from '@/lib/api/newsletters'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

interface SendError {
  email: string
  error: string
}

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📧 [Newsletter/Send] Iniciando envío de newsletter...')

    // Validar input con Zod
    const parsed = safeParseSendRequest(body)

    if (!parsed.success) {
      console.error('❌ [Newsletter/Send] Validación fallida:', parsed.error.message)
      return NextResponse.json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: parsed.error.errors
      }, { status: 400 })
    }

    const {
      subject: rawSubject,
      htmlContent: rawHtmlContent,
      audienceType,
      selectedUserIds,
      fromName,
      fromEmail,
      testMode,
      templateId: rawTemplateId,
      templateSlug,
      templateVariables,
    } = parsed.data as typeof parsed.data & { templateSlug?: string; templateVariables?: Record<string, unknown> }

    // Si se proporciona templateSlug, resolver plantilla desde BD
    let subject = rawSubject
    let htmlContent = rawHtmlContent
    let templateId = rawTemplateId

    // Templates raw para renderizar por usuario (solo con templateSlug)
    let rawSubjectTemplate = ''
    let rawHtmlTemplate = ''
    let baseVars: Record<string, unknown> = {}
    let oposicionNames: Record<string, string> = {}

    if (templateSlug) {
      const tpl = await getEmailTemplate(templateSlug)
      if (!tpl) {
        return NextResponse.json({ error: `Plantilla "${templateSlug}" no encontrada` }, { status: 404 })
      }

      const previewData = tpl.previewData as Record<string, unknown> || {}
      baseVars = { ...previewData, ...(templateVariables || {}) }

      // Guardar templates raw para personalizar por usuario en el loop
      rawSubjectTemplate = tpl.subjectTemplate
      rawHtmlTemplate = tpl.htmlTemplate

      // Pre-render para subject/htmlContent por defecto (fallback)
      subject = renderTemplate(tpl.subjectTemplate, baseVars)
      htmlContent = renderTemplate(tpl.htmlTemplate, baseVars)
      templateId = templateSlug

      // Cargar nombres completos de oposiciones para personalizar {{oposicionActual}}
      const oposiciones = await getActiveOposiciones()
      for (const o of oposiciones) {
        oposicionNames[o.key] = o.fullName
      }

      console.log(`📧 [Newsletter/Send] Usando plantilla BD: ${templateSlug} (personalización por usuario activa)`)
    }

    // Obtener usuarios según el tipo de audiencia
    let users: EligibleUser[] = []

    if (selectedUserIds?.length) {
      // Envío a usuarios específicos - obtener de DB
      console.log(`👥 [Newsletter/Send] Enviando a ${selectedUserIds.length} usuarios específicos`)

      const { data } = await getSupabase()
        .from('user_profiles')
        .select('id, email, full_name, target_oposicion')
        .in('id', selectedUserIds)
        .not('email', 'is', null)

      users = (data || []).map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        targetOposicion: u.target_oposicion
      }))
    } else if (audienceType) {
      // Envío por audiencia - usa Drizzle (respeta unsubscribedAll)
      console.log(`👥 [Newsletter/Send] Obteniendo audiencia tipo: ${audienceType}`)
      users = await getNewsletterAudience(audienceType)
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

    console.log(`📊 [Newsletter/Send] Enviando newsletter a ${users.length} usuarios (audiencia: ${audienceType || 'specific'})`)

    // Si es modo test, solo enviar a los primeros 3 usuarios
    if (testMode) {
      users = users.slice(0, 3)
      console.log(`🧪 [Newsletter/Send] Modo test activado - enviando solo a ${users.length} usuarios`)
    }

    let sent = 0
    let failed = 0
    const errors: SendError[] = []

    // Generar UN SOLO campaign_id para todo el envío masivo
    const campaignId = `${templateId || 'newsletter'}_${Date.now()}`
    console.log(`📧 [Newsletter/Send] Campaign ID: ${campaignId}`)

    // Enviar emails con rate limiting
    for (let i = 0; i < users.length; i++) {
      const user = users[i]

      try {
        // Rate limiting: máximo 1 email por segundo
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Personalizar HTML con variables del usuario
        let personalizedSubject = subject
        let personalizedHtml: string

        if (rawHtmlTemplate) {
          // Plantilla BD: renderizar con variables por usuario
          const userVars = {
            ...baseVars,
            userName: user.fullName?.split(' ')[0] || 'Opositor/a',
            oposicionActual: oposicionNames[user.targetOposicion || ''] || user.targetOposicion || 'tu oposicion',
          }
          personalizedSubject = renderTemplate(rawSubjectTemplate, userVars)
          personalizedHtml = renderTemplate(rawHtmlTemplate, userVars)
        } else {
          personalizedHtml = htmlContent
        }

        // Reemplazar variables legacy {nombre}, {oposicion}, {email}
        personalizedHtml = replaceNewsletterVariables(personalizedHtml, {
          nombre: user.fullName,
          oposicion: user.targetOposicion,
          email: user.email
        })

        // Añadir tracking pixel para detectar aperturas (solo en modo real)
        if (!testMode) {
          const trackingPixel = `<img src="https://www.vence.es/api/email-tracking/open?user_id=${user.id}&email_id=${campaignId}&type=newsletter&template_id=${templateId || 'newsletter'}&campaign_id=${campaignId}" width="1" height="1" style="display:none;" alt="">`
          personalizedHtml = personalizedHtml.replace('</body>', `${trackingPixel}</body>`)
        }

        // Añadir tracking a enlaces (solo en modo real)
        if (!testMode) {
          personalizedHtml = personalizedHtml.replace(
            /href="(https?:\/\/(?:www\.)?vence\.es[^"]*)"/g,
            `href="https://www.vence.es/api/email-tracking/click?user_id=${user.id}&type=newsletter&action=newsletter_link&template_id=${templateId || 'newsletter'}&campaign_id=${campaignId}&redirect=$1"`
          )
        }

        // Generar token de desuscripción obligatorio
        const { generateUnsubscribeToken } = await import('@/lib/emails/emailService.server')
        const unsubscribeToken = await generateUnsubscribeToken(user.id, user.email, 'newsletter')

        const unsubscribeLink = unsubscribeToken
          ? `https://www.vence.es/unsubscribe?token=${unsubscribeToken}`
          : `https://www.vence.es/perfil?tab=emails`

        const unsubscribeFooter = `
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
            <p style="margin: 0;">
              Si no quieres recibir más newsletters, puedes
              <a href="${unsubscribeLink}" style="color: #666; text-decoration: underline;">darte de baja aquí</a>.
            </p>
            <p style="margin: 5px 0 0 0;">
              Vence.es - ${user.email} - Newsletter
            </p>
          </div>
        `

        // Insertar footer antes del </body>
        personalizedHtml = personalizedHtml.replace('</body>', `${unsubscribeFooter}</body>`)

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
              subject: personalizedSubject,
              html: personalizedHtml
            })
          })

          const result = await response.json()

          if (response.ok) {
            sent++
            success = true

            // Registrar en analytics si no es modo test
            if (!testMode) {
              try {
                await getSupabase().from('email_events').insert({
                  user_id: user.id,
                  event_type: 'sent',
                  email_type: 'newsletter',
                  email_address: user.email,
                  subject: personalizedSubject,
                  template_id: templateId || 'newsletter',
                  campaign_id: campaignId,
                  email_content_preview: personalizedHtml
                })
              } catch (eventErr) {
                console.error(`❌ [Newsletter/Send] Error guardando evento para ${user.email}:`, eventErr)
              }
            }
          } else if (response.status === 429) {
            // Rate limit - esperar más tiempo y reintentar
            retries++
            console.log(`⏳ [Newsletter/Send] Rate limit para ${user.email}, retry ${retries}/${maxRetries}`)

            if (retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 3000))
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
          error: error instanceof Error ? error.message : 'Error desconocido'
        })
      }
    }

    console.log(`✅ [Newsletter/Send] Newsletter completada: ${sent} enviados, ${failed} fallos`)

    return NextResponse.json({
      success: true,
      message: 'Newsletter enviada exitosamente',
      total: users.length,
      sent,
      failed,
      audienceType,
      testMode,
      errors: errors.slice(0, 10) // Solo mostrar los primeros 10 errores
    })

  } catch (error) {
    console.error('❌ [Newsletter/Send] Error enviando newsletter:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const POST = withErrorLogging('/api/admin/newsletters/send', _POST)
