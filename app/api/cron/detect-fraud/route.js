// app/api/cron/detect-fraud/route.js
// Cron que detecta posibles fraudes: multi-cuentas, IPs compartidas, dispositivos duplicados
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createFraudAlert, hasActiveAlert } from '@/lib/api/fraud'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'manueltrader@gmail.com'

export async function GET(request) {
  try {
    // Verificar authorization header
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized request to detect-fraud cron')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔍 Iniciando detección de fraudes...')

    const newAlerts = []

    // ============================================
    // 1. DETECTAR MISMA IP CON MÚLTIPLES CUENTAS
    // ============================================
    const { data: sameIpGroups, error: ipError } = await supabase.rpc('detect_same_ip_fraud')

    if (!ipError && sameIpGroups?.length > 0) {
      for (const group of sameIpGroups) {
        if (group.user_count >= 2) {
          const alreadyAlerted = await hasActiveAlert(group.user_ids, 'same_ip')
          if (!alreadyAlerted) {
            const hasPremium = group.has_premium === true
            const result = await createFraudAlert({
              alertType: 'same_ip',
              severity: hasPremium ? 'high' : 'medium',
              userIds: group.user_ids,
              details: {
                ips: [group.ip_address],
                emails: group.emails,
                names: group.names,
                hasPremium,
                userCount: group.user_count,
              },
              matchCriteria: 'same_ip',
            })
            if (result.success) {
              newAlerts.push({ type: 'same_ip', ...group })
            }
          }
        }
      }
    }
    console.log(`📍 IPs: ${sameIpGroups?.length || 0} grupos encontrados`)

    // ============================================
    // 2. DETECTAR MISMO DISPOSITIVO
    // ============================================
    const { data: sameDeviceGroups, error: deviceError } = await supabase.rpc('detect_same_device_fraud')

    if (!deviceError && sameDeviceGroups?.length > 0) {
      for (const group of sameDeviceGroups) {
        if (group.user_count >= 2) {
          const alreadyAlerted = await hasActiveAlert(group.user_ids, 'same_device')
          if (!alreadyAlerted) {
            const hasPremium = group.has_premium === true
            const result = await createFraudAlert({
              alertType: 'same_device',
              severity: hasPremium ? 'high' : 'medium',
              userIds: group.user_ids,
              details: {
                devices: [group.device_fingerprint],
                emails: group.emails,
                names: group.names,
                hasPremium,
                userCount: group.user_count,
              },
              matchCriteria: 'same_device',
            })
            if (result.success) {
              newAlerts.push({ type: 'same_device', ...group })
            }
          }
        }
      }
    }
    console.log(`📱 Dispositivos: ${sameDeviceGroups?.length || 0} grupos encontrados`)

    // ============================================
    // 3. DETECTAR MULTI-CUENTAS (MISMO NOMBRE + DISPOSITIVO/IP)
    // ============================================
    const { data: multiAccountGroups, error: multiError } = await supabase.rpc('detect_multi_account_fraud')

    if (!multiError && multiAccountGroups?.length > 0) {
      for (const group of multiAccountGroups) {
        if (group.user_count >= 2) {
          const alreadyAlerted = await hasActiveAlert(group.user_ids, 'multi_account')
          if (!alreadyAlerted) {
            const hasPremium = group.has_premium === true
            const result = await createFraudAlert({
              alertType: 'multi_account',
              severity: hasPremium ? 'critical' : 'high',
              userIds: group.user_ids,
              details: {
                emails: group.emails,
                names: group.names,
                ips: group.ips,
                devices: group.devices,
                hasPremium,
                userCount: group.user_count,
              },
              matchCriteria: group.match_criteria || 'name+device',
            })
            if (result.success) {
              newAlerts.push({ type: 'multi_account', ...group })
            }
          }
        }
      }
    }
    console.log(`👥 Multi-cuentas: ${multiAccountGroups?.length || 0} grupos encontrados`)

    // ============================================
    // 4. DETECTAR PREMIUM SOSPECHOSOS (MÚLTIPLES UBICACIONES)
    // ============================================
    const { data: suspiciousPremium, error: premiumError } = await supabase.rpc('detect_suspicious_premium')

    if (!premiumError && suspiciousPremium?.length > 0) {
      for (const user of suspiciousPremium) {
        if (user.location_count >= 3) {
          const alreadyAlerted = await hasActiveAlert([user.user_id], 'suspicious_premium')
          if (!alreadyAlerted) {
            const result = await createFraudAlert({
              alertType: 'suspicious_premium',
              severity: user.location_count >= 5 ? 'critical' : 'high',
              userIds: [user.user_id],
              details: {
                email: user.email,
                name: user.name,
                locations: user.locations,
                locationCount: user.location_count,
                hasPremium: true,
              },
              matchCriteria: 'multiple_locations',
            })
            if (result.success) {
              newAlerts.push({ type: 'suspicious_premium', ...user })
            }
          }
        }
      }
    }
    console.log(`💳 Premium sospechosos: ${suspiciousPremium?.length || 0} encontrados`)

    // ============================================
    // ENVIAR EMAIL SI HAY NUEVAS ALERTAS
    // ============================================
    if (newAlerts.length > 0) {
      await sendFraudAlertEmail(newAlerts)
    }

    console.log(`✅ Detección completada. ${newAlerts.length} nuevas alertas creadas`)

    return NextResponse.json({
      success: true,
      message: `Detección completada`,
      newAlerts: newAlerts.length,
      details: {
        sameIp: sameIpGroups?.length || 0,
        sameDevice: sameDeviceGroups?.length || 0,
        multiAccount: multiAccountGroups?.length || 0,
        suspiciousPremium: suspiciousPremium?.length || 0,
      }
    })

  } catch (error) {
    console.error('❌ Error en detección de fraudes:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// ============================================
// ENVIAR EMAIL DE ALERTA
// ============================================
async function sendFraudAlertEmail(alerts) {
  const alertsByType = {}
  alerts.forEach(a => {
    if (!alertsByType[a.type]) alertsByType[a.type] = []
    alertsByType[a.type].push(a)
  })

  const typeLabels = {
    same_ip: '🌐 Misma IP',
    same_device: '📱 Mismo Dispositivo',
    multi_account: '👥 Multi-cuentas',
    suspicious_premium: '💳 Premium Sospechoso',
  }

  const alertSections = Object.entries(alertsByType).map(([type, typeAlerts]) => `
    <div style="margin-bottom: 20px;">
      <h3 style="color: #dc2626; margin-bottom: 10px;">${typeLabels[type] || type} (${typeAlerts.length})</h3>
      ${typeAlerts.map(alert => `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
          <p style="margin: 0 0 5px 0;"><strong>Emails:</strong> ${(alert.emails || [alert.email]).join(', ')}</p>
          ${alert.names ? `<p style="margin: 0 0 5px 0;"><strong>Nombres:</strong> ${alert.names.join(', ')}</p>` : ''}
          ${alert.ips ? `<p style="margin: 0 0 5px 0;"><strong>IPs:</strong> ${alert.ips.join(', ')}</p>` : ''}
          ${alert.ip_address ? `<p style="margin: 0 0 5px 0;"><strong>IP:</strong> ${alert.ip_address}</p>` : ''}
          ${alert.locations ? `<p style="margin: 0 0 5px 0;"><strong>Ubicaciones:</strong> ${alert.locations.join(', ')}</p>` : ''}
          ${alert.hasPremium || alert.has_premium ? '<span style="background: #fbbf24; color: #78350f; padding: 2px 8px; border-radius: 4px; font-size: 12px;">⭐ PREMIUM</span>' : ''}
        </div>
      `).join('')}
    </div>
  `).join('')

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Alertas de Fraude</title></head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

          <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); margin: -20px -20px 20px -20px; padding: 25px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">🚨 Alertas de Fraude</h1>
            <p style="color: #fecaca; margin: 10px 0 0 0;">${alerts.length} nuevas alertas detectadas</p>
          </div>

          ${alertSections}

          <div style="text-align: center; margin-top: 25px;">
            <a href="https://www.vence.es/admin/fraudes"
               style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              🔍 Ver Panel de Fraudes
            </a>
          </div>

          <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">
            <p style="margin: 0;">Vence Pro - Sistema de detección automática de fraudes</p>
          </div>

        </div>
      </body>
    </html>
  `

  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'info@vence.es',
      to: ADMIN_EMAIL,
      subject: `🚨 ${alerts.length} alertas de fraude detectadas`,
      html
    })
    console.log('📧 Email de alertas de fraude enviado')
  } catch (err) {
    console.error('❌ Error enviando email de fraude:', err)
  }
}
