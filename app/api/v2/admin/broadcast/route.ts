// app/api/v2/admin/broadcast/route.ts
// Envío masivo de email + push a usuarios filtrados por oposición.
// Uso: POST con { oposicion, subject, message, channels: ['email', 'push'] }
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { sendEmailV2 } from '@/lib/api/emails'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'rikseotools@gmail.com').split(',')

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Ciudades por comunidad autónoma para filtro por región
const REGION_CITIES: Record<string, string[]> = {
  'castilla-y-leon': ['Valladolid', 'León', 'Burgos', 'Salamanca', 'Zamora', 'Palencia', 'Ávila', 'Segovia', 'Soria'],
  'madrid': ['Madrid', 'Alcalá', 'Getafe', 'Leganés', 'Móstoles', 'Fuenlabrada', 'Alcorcón', 'Torrejón', 'Parla', 'Alcobendas', 'Pozuelo', 'Majadahonda', 'Las Rozas', 'San Sebastián de los Reyes', 'Rivas', 'Coslada', 'Aranjuez', 'Arganda', 'Colmenar'],
  'andalucia': ['Sevilla', 'Málaga', 'Córdoba', 'Granada', 'Almería', 'Huelva', 'Cádiz', 'Jaén'],
  'valencia': ['Valencia', 'Alicante', 'Castellón', 'Elche', 'Torrent', 'Gandía'],
  'galicia': ['Coruña', 'Vigo', 'Ourense', 'Pontevedra', 'Lugo', 'Santiago', 'Ferrol'],
}

const BroadcastRequestSchema = z.object({
  oposicion: z.string().optional(),
  region: z.string().optional(),
  subject: z.string().min(1, 'Asunto requerido'),
  message: z.string().min(1, 'Mensaje requerido'),
  channels: z.array(z.enum(['email', 'push'])).min(1, 'Al menos un canal'),
  testMode: z.boolean().default(false),
  oposicionDatos: z.object({
    plazas: z.string().optional(),
    temas: z.string().optional(),
    preguntas: z.string().optional(),
    features: z.array(z.string()).optional(),
  }).optional(),
}).refine(data => data.oposicion || data.region, {
  message: 'Se requiere oposicion o region (o ambos)',
})

async function _POST(request: NextRequest) {
  const supabase = getServiceClient()

  // 1. Verificar admin
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user || !ADMIN_EMAILS.includes(user.email || '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // 2. Validar request
  const body = await request.json()
  const parsed = BroadcastRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { oposicion, region, subject, message, channels, testMode } = parsed.data

  // 3. Buscar usuarios según filtros
  let query = supabase
    .from('user_profiles')
    .select('id, email, display_name, plan_type, target_oposicion, ciudad')

  // Filtro por oposición
  if (oposicion) {
    const targetOposicion = oposicion.replace(/-/g, '_')
    query = query.eq('target_oposicion', targetOposicion)
  }

  // Filtro por región (usuarios que viven en esa comunidad autónoma)
  if (region && !oposicion) {
    const cities = REGION_CITIES[region]
    if (cities && cities.length > 0) {
      // Buscar usuarios cuya ciudad contenga alguna de las ciudades de la región
      const cityFilters = cities.map(c => `ciudad.ilike.%${c}%`).join(',')
      query = query.or(cityFilters)
    }
  }

  const { data: users, error: usersError } = await query

  if (usersError) {
    return NextResponse.json({ error: 'Error buscando usuarios' }, { status: 500 })
  }

  // Si se pidió región Y oposición, combinar: usuarios de la oposición + usuarios de la región
  let allUsers = users || []
  if (region && oposicion) {
    const cities = REGION_CITIES[region]
    if (cities && cities.length > 0) {
      const cityFilters = cities.map(c => `ciudad.ilike.%${c}%`).join(',')
      const { data: regionUsers } = await supabase
        .from('user_profiles')
        .select('id, email, display_name, plan_type, target_oposicion, ciudad')
        .or(cityFilters)

      // Merge y deduplicar
      const existingIds = new Set(allUsers.map(u => u.id))
      for (const u of regionUsers || []) {
        if (!existingIds.has(u.id)) {
          allUsers.push(u)
        }
      }
    }
  }

  if (allUsers.length === 0) {
    return NextResponse.json({
      success: true,
      sent: { email: 0, push: 0 },
      total: 0,
      message: `No hay usuarios con los filtros: oposición=${oposicion || 'todas'}, región=${region || 'todas'}`,
    })
  }

  const users_final = allUsers

  // En test mode, solo los primeros 3
  const targetUsers = testMode ? users_final.slice(0, 3) : users_final
  const label = oposicion || region || 'filtro'

  console.log(`📢 [BROADCAST] ${testMode ? '[TEST] ' : ''}Enviando a ${targetUsers.length} usuarios (${label})`)
  console.log(`   Canales: ${channels.join(', ')}`)

  const results = { email: { sent: 0, failed: 0 }, push: { sent: 0, failed: 0 } }

  // 4. Enviar emails
  if (channels.includes('email')) {
    for (const targetUser of targetUsers) {
      try {
        // Verificar preferencias de email
        const { data: prefs } = await supabase
          .from('email_preferences')
          .select('unsubscribed_all')
          .eq('user_id', targetUser.id)
          .maybeSingle()

        if (prefs?.unsubscribed_all) {
          console.log(`⏭️ ${targetUser.email} — email desuscrito`)
          continue
        }

        await sendEmailV2({
          userId: targetUser.id,
          emailType: 'nueva_oposicion',
          customData: {
            oposicionDatos: {
              nombreOposicion: subject,
              comunidad: (oposicion || region || '').replace(/-/g, ' '),
              slug: oposicion || '',
              ...((parsed.data as Record<string, unknown>).oposicionDatos as Record<string, unknown> || {}),
            },
          },
        })

        results.email.sent++
      } catch (error) {
        console.error(`❌ Email falló para ${targetUser.email}:`, (error as Error).message)
        results.email.failed++
      }

      // Rate limiting: 100ms entre emails
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // 5. Enviar push (delegar al endpoint existente)
  if (channels.includes('push')) {
    try {
      const pushResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || 'https://www.vence.es'}/api/admin/send-push-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification: {
            title: subject,
            body: message,
            data: { url: `/${oposicion}/test`, category: 'broadcast' },
          },
          targetType: oposicion,
        }),
      })

      const pushResult = await pushResponse.json()
      results.push.sent = pushResult.sent || 0
      results.push.failed = pushResult.failed || 0
    } catch (error) {
      console.error('❌ Push broadcast falló:', (error as Error).message)
    }
  }

  console.log(`📢 [BROADCAST] Completado:`, results)

  return NextResponse.json({
    success: true,
    sent: results,
    total: targetUsers.length,
    oposicion: oposicion || null,
    region: region || null,
    testMode,
    message: `${testMode ? '[TEST] ' : ''}Broadcast enviado a ${targetUsers.length} usuarios (${label})`,
  })
}

export const POST = withErrorLogging('/api/v2/admin/broadcast', _POST)
