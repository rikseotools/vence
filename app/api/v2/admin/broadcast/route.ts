// app/api/v2/admin/broadcast/route.ts
// Envío masivo de EMAIL a usuarios filtrados por oposición/región.
// Uso: POST con { oposicion, subject, message, channels: ['email'] }
//
// 2026-05-03: eliminada parte push notifications (decision producto:
// usuarios prefieren emails, push muy invasivo). Schema mantiene
// `channels` como array por compatibilidad histórica de callers, pero
// solo acepta 'email'.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { and, or, eq, ilike } from 'drizzle-orm'
import { sendEmailV2 } from '@/lib/api/emails'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { getDb } from '@/db/client'
import { userProfiles, emailPreferences } from '@/db/schema'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'rikseotools@gmail.com').split(',')

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
  channels: z.array(z.enum(['email'])).min(1, 'Al menos un canal'),
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
  // 1. Auth + admin check (wrapper Fase 0.7 — soporta off/shadow/on)
  const auth = await verifyAuth(request, '/api/v2/admin/broadcast')
  if (!auth.success) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (!ADMIN_EMAILS.includes(auth.email || '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // BD agnóstica (Drizzle/Postgres → getDb/DATABASE_URL). Solo se usan id+email
  // aguas abajo; display_name/plan_type del select antiguo no se usaban.
  const db = getDb()

  // 2. Validar request
  const body = await request.json()
  const parsed = BroadcastRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { oposicion, region, subject, message, channels, testMode } = parsed.data

  // OR de ciudades de una región (ilike), equivalente al `.or('ciudad.ilike...')`.
  const cityOr = (r: string) => {
    const cities = REGION_CITIES[r]
    return cities && cities.length > 0
      ? or(...cities.map(c => ilike(userProfiles.ciudad, `%${c}%`)))
      : undefined
  }

  // 3. Buscar usuarios según filtros
  const filters = []
  if (oposicion) filters.push(eq(userProfiles.targetOposicion, oposicion.replace(/-/g, '_')))
  if (region && !oposicion) {
    const o = cityOr(region)
    if (o) filters.push(o)
  }

  // GUARDARRAÍL (F4): si NO se produjo ningún filtro (p.ej. región desconocida sin
  // oposición), NO seleccionar TODOS los usuarios — en un endpoint de email masivo
  // eso enviaría a toda la base. El Zod .refine exige oposicion||region, pero una
  // región no reconocida (fuera de REGION_CITIES) pasaba el refine y vaciaba el
  // filtro → where(undefined) = todos. Aquí se corta a 0.
  if (filters.length === 0) {
    return NextResponse.json({
      success: true,
      sent: { email: 0 },
      total: 0,
      message: `Sin destinatarios: filtro vacío (oposición=${oposicion || 'ninguna'}, región=${region || 'ninguna'} no reconocida)`,
    })
  }

  let allUsers: Array<{ id: string; email: string | null }> = []
  try {
    allUsers = await db
      .select({ id: userProfiles.id, email: userProfiles.email })
      .from(userProfiles)
      .where(and(...filters))
  } catch (e) {
    console.error('Error buscando usuarios:', e)
    return NextResponse.json({ error: 'Error buscando usuarios' }, { status: 500 })
  }

  // Si se pidió región Y oposición, combinar con los usuarios de la región (dedup)
  if (region && oposicion) {
    const o = cityOr(region)
    if (o) {
      const regionUsers = await db
        .select({ id: userProfiles.id, email: userProfiles.email })
        .from(userProfiles)
        .where(o)
      const existingIds = new Set(allUsers.map(u => u.id))
      for (const u of regionUsers) {
        if (!existingIds.has(u.id)) allUsers.push(u)
      }
    }
  }

  if (allUsers.length === 0) {
    return NextResponse.json({
      success: true,
      sent: { email: 0 },
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

  const results = { email: { sent: 0, failed: 0 } }

  // 4. Enviar emails
  if (channels.includes('email')) {
    for (const targetUser of targetUsers) {
      try {
        // Verificar preferencias de email (Drizzle/RDS)
        const [prefs] = await db
          .select({ unsubscribedAll: emailPreferences.unsubscribedAll })
          .from(emailPreferences)
          .where(eq(emailPreferences.userId, targetUser.id))
          .limit(1)

        if (prefs?.unsubscribedAll) {
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

  // (push notifications eliminadas 2026-05-03 — solo email)

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
