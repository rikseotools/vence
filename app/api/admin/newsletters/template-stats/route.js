import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Verificar autenticación de admin
async function verifyAdminAuth(supabase, userId) {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan_type, email')
      .eq('id', userId)
      .single()

    return profile?.plan_type === 'admin' || 
           profile?.email === 'ilovetestpro@gmail.com' ||
           profile?.email === 'rikseotools@gmail.com'
  } catch (error) {
    console.error('Error verificando admin:', error)
    return false
  }
}

export async function GET(request) {
  try {
    console.log('🔍 Template-stats API iniciada')
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔍 Consultando email_events reales...')
    
    // Obtener estadísticas reales de la base de datos
    const { data: statsData, error: statsError } = await supabase
      .from('email_events')
      .select(`
        template_id,
        email_type,
        event_type,
        created_at,
        subject,
        user_id
      `)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 90 días

    if (statsError) {
      console.error('❌ Error obteniendo estadísticas:', statsError)
      return NextResponse.json({ error: 'Error interno del servidor', details: statsError }, { status: 500 })
    }

    console.log(`✅ Datos obtenidos: ${statsData?.length || 0} eventos`)

    // Procesar estadísticas por plantilla
    const templateStats = {}

    statsData.forEach(event => {
      const templateId = event.template_id || event.email_type
      
      if (!templateStats[templateId]) {
        templateStats[templateId] = {
          templateId,
          emailType: event.email_type,
          lastSubject: event.subject,
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          totalComplained: 0,
          totalUnsubscribed: 0,
          openRate: 0,
          clickRate: 0,
          bounceRate: 0,
          complaintRate: 0,
          lastSent: null,
          uniqueOpeners: new Set(),
          uniqueClickers: new Set()
        }
      }

      const stat = templateStats[templateId]

      // Contar eventos
      switch (event.event_type) {
        case 'sent':
          stat.totalSent++
          if (!stat.lastSent || new Date(event.created_at) > new Date(stat.lastSent)) {
            stat.lastSent = event.created_at
            stat.lastSubject = event.subject
          }
          break
        case 'delivered':
          stat.totalDelivered++
          break
        case 'opened':
          stat.totalOpened++
          stat.uniqueOpeners.add(event.user_id)
          break
        case 'clicked':
          stat.totalClicked++
          stat.uniqueClickers.add(event.user_id)
          break
        case 'bounced':
          stat.totalBounced++
          break
        case 'complained':
          stat.totalComplained++
          break
        case 'unsubscribed':
          stat.totalUnsubscribed++
          break
      }
    })

    // Calcular tasas y limpiar Sets
    Object.values(templateStats).forEach(stat => {
      stat.openRate = stat.totalSent > 0 ? (stat.uniqueOpeners.size / stat.totalSent * 100) : 0
      stat.clickRate = stat.totalOpened > 0 ? (stat.uniqueClickers.size / stat.totalOpened * 100) : 0
      stat.bounceRate = stat.totalSent > 0 ? (stat.totalBounced / stat.totalSent * 100) : 0
      stat.complaintRate = stat.totalSent > 0 ? (stat.totalComplained / stat.totalSent * 100) : 0
      
      // Convertir Sets a números para el JSON
      stat.uniqueOpeners = stat.uniqueOpeners.size
      stat.uniqueClickers = stat.uniqueClickers.size
    })

    console.log(`✅ Templates procesados: ${Object.keys(templateStats).length}`)

    return NextResponse.json({
      success: true,
      templateStats
    })

  } catch (error) {
    console.error('Error en template-stats API:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}