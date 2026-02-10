// app/api/cron/daily-registration-summary/route.js
// Cron que se ejecuta a las 21:00 y envía resumen de registros del día
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const getResend = () => new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'manueltrader@gmail.com'

export async function GET(request) {
  try {
    // Verificar authorization header
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized request to daily-registration-summary cron')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Obtener fecha de hoy (zona horaria Madrid)
    const now = new Date()
    const madridTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
    const todayStart = new Date(madridTime)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(madridTime)
    todayEnd.setHours(23, 59, 59, 999)

    console.log('📅 Buscando registros del día:', todayStart.toISOString(), 'a', todayEnd.toISOString())

    // Obtener usuarios registrados hoy
    const { data: newUsers, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, registration_source, created_at')
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error obteniendo usuarios:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    const totalUsers = newUsers?.length || 0
    console.log(`📊 Usuarios registrados hoy: ${totalUsers}`)

    // Si no hay usuarios, no enviar email
    if (totalUsers === 0) {
      console.log('✅ Sin nuevos registros hoy - no se envía email')
      return NextResponse.json({
        success: true,
        message: 'Sin nuevos registros hoy',
        count: 0
      })
    }

    // Agrupar por fuente de registro
    const bySource = {}
    newUsers.forEach(user => {
      const source = user.registration_source || 'organic'
      bySource[source] = (bySource[source] || 0) + 1
    })

    // Generar HTML del email
    const usersList = newUsers.map(user => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 8px; font-size: 14px;">${user.email}</td>
        <td style="padding: 10px 8px; font-size: 14px;">${user.full_name || '-'}</td>
        <td style="padding: 10px 8px; font-size: 14px;">${user.registration_source || 'organic'}</td>
        <td style="padding: 10px 8px; font-size: 14px; color: #6b7280;">
          ${new Date(user.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </td>
      </tr>
    `).join('')

    const sourcesList = Object.entries(bySource)
      .map(([source, count]) => `<span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 12px; margin: 4px; display: inline-block;">${source}: ${count}</span>`)
      .join('')

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Resumen Diario de Registros</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 700px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

            <div style="text-align: center; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); margin: -20px -20px 20px -20px; padding: 30px 20px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">📊 Resumen Diario de Registros</h1>
              <p style="color: #bfdbfe; margin: 10px 0 0 0; font-size: 16px;">
                ${madridTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 25px; border-radius: 12px; margin-bottom: 20px; text-align: center; border: 2px solid #10b981;">
              <div style="font-size: 56px; font-weight: bold; color: #059669;">${totalUsers}</div>
              <div style="color: #065f46; font-size: 16px; margin-top: 5px;">nuevos usuarios registrados</div>
            </div>

            <div style="text-align: center; margin-bottom: 20px;">
              ${sourcesList}
            </div>

            <div style="background: #f8fafc; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #e2e8f0;">
                    <th style="padding: 12px 8px; text-align: left; font-size: 13px; color: #475569;">Email</th>
                    <th style="padding: 12px 8px; text-align: left; font-size: 13px; color: #475569;">Nombre</th>
                    <th style="padding: 12px 8px; text-align: left; font-size: 13px; color: #475569;">Fuente</th>
                    <th style="padding: 12px 8px; text-align: left; font-size: 13px; color: #475569;">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  ${usersList}
                </tbody>
              </table>
            </div>

            <div style="text-align: center; margin-top: 20px;">
              <a href="https://www.vence.es/admin/conversiones"
                 style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                📊 Ver Panel de Conversiones
              </a>
            </div>

            <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              <p style="margin: 0;">Vence Pro - Resumen automático diario (21:00)</p>
            </div>

          </div>
        </body>
      </html>
    `

    // Enviar email
    await getResend().emails.send({
      from: process.env.FROM_EMAIL || 'info@vence.es',
      to: ADMIN_EMAIL,
      subject: `📊 ${totalUsers} nuevos usuarios hoy - ${madridTime.toLocaleDateString('es-ES')}`,
      html: html
    })

    console.log('✅ Email de resumen diario enviado')

    return NextResponse.json({
      success: true,
      message: `Resumen enviado: ${totalUsers} usuarios`,
      count: totalUsers,
      bySource
    })

  } catch (error) {
    console.error('❌ Error inesperado:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
