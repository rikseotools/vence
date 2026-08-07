// app/api/admin/anti-scraping/levantar-marca/route.ts
//
// Retira la marca de "retar siempre" (`captcha:force:*`) de un usuario y/o dispositivo.
// Única vía para hacerlo: la marca vive en Redis y en producción eso es ElastiCache dentro de la
// VPC, así que solo se alcanza desde dentro. Criterio y detalle del porqué:
// `lib/security/challengePolicy/levantarMarca.ts`.
//
// Body: { userId?: string, deviceId?: string, motivo: string }  — al menos uno de los dos sujetos.

import { NextRequest } from 'next/server'
import { z } from 'zod/v3'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { emitFireAndForget } from '@/lib/observability/emit'
import {
  planearLevantado,
  levantarMarcas,
  MOTIVO_MINIMO,
} from '@/lib/security/challengePolicy/levantarMarca'

const bodySchema = z.object({
  userId: z.string().uuid('userId debe ser UUID').optional().nullable(),
  deviceId: z.string().min(1).max(128).optional().nullable(),
  motivo: z.string().min(MOTIVO_MINIMO, `El motivo debe explicar el caso (mínimo ${MOTIVO_MINIMO} caracteres)`),
})

async function _POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Body inválido' },
      { status: 400 },
    )
  }

  const plan = planearLevantado(parsed.data)
  if (!plan.valido) {
    return Response.json({ success: false, error: plan.error }, { status: 400 })
  }

  const { levantados, fallidos } = await levantarMarcas(plan.sujetos)

  // Queda registrado SIEMPRE, con quién y por qué: retirar una defensa sin rastro es
  // exactamente lo que nadie sabe explicar tres semanas después. `warn` a propósito — no es
  // una operación rutinaria.
  emitFireAndForget({
    source: 'vercel',
    severity: fallidos.length ? 'error' : 'warn',
    eventType: 'scraping_force_challenge_levantado',
    endpoint: '/api/admin/anti-scraping/levantar-marca',
    userId: parsed.data.userId ?? undefined,
    metadata: {
      motivo: parsed.data.motivo,
      porAdmin: admin.user?.email ?? null,
      deviceId: parsed.data.deviceId ?? null,
      levantados,
      fallidos,
    },
  })

  return Response.json({
    success: fallidos.length === 0,
    levantados,
    fallidos,
  })
}

export const POST = withErrorLogging('/api/admin/anti-scraping/levantar-marca', _POST)
