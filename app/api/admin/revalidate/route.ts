// app/api/admin/revalidate/route.ts
// Dispatch genérico de invalidación de cache por tag.
//
// IMPORTANTE — cross-runtime coherence (Bloque 3):
// Algunos tags tienen un counterpart en el backend NestJS/Fargate
// que cachea con keys versionadas en Upstash (ver
// `CacheVersioningService`). Para esos tags NO basta con `revalidateTag()`
// de Next.js — hay que ADEMÁS incrementar el contador
// `cache_version:${tag}` en Upstash para que el backend vea el nuevo
// version. Los invalidadores específicos en `lib/cache/<tag>.ts`
// encapsulan ambos planos (Vercel + backend) y son la fuente única.
//
// Patrón: TAG_INVALIDATORS mapea tags con counterpart cross-runtime a
// su función específica. Tags sin entrada usan el dispatch genérico
// `revalidateTag()` solo (no tienen backend canary, no necesitan INCR).

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { invalidateTestConfigCache } from '@/lib/cache/test-config'

const VALID_TAGS = [
  'temario',
  'teoria',
  'laws',
  'landing',
  'test-counts',
  'medals',
  'profile',
  'questions',
  'user-theme-stats',
  'test-config',   // Fase 4a — sections / articles / essential-articles. CANARY backend activo (commit 93fedcf5)
  'hot-articles',  // Fase 4b — hot-articles/check
  'law-stats',     // Fase 4c — questions/law-stats
  'verify-stats',  // Fase 4d — verify-articles/stats-by-law
] as const

type ValidTag = (typeof VALID_TAGS)[number]

/**
 * Tags con counterpart cross-runtime en backend NestJS — usan invalidador
 * específico de `lib/cache/<tag>.ts` que cubre AMBOS planos:
 *   1. revalidateTag() de Next.js (cache unstable_cache local)
 *   2. INCR cache_version:${tag} en Upstash (cache versionado del backend)
 *
 * Tags NO incluidos aquí solo viven en Next.js — `revalidateTag()` basta.
 *
 * Añadir entrada cada vez que un nuevo endpoint cache versionado en
 * backend pasa a canary activo.
 */
const TAG_INVALIDATORS: Partial<Record<ValidTag, () => void | Promise<void>>> = {
  'test-config': invalidateTestConfigCache,
}

async function _POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tag } = await request.json()

  if (!VALID_TAGS.includes(tag as ValidTag)) {
    return NextResponse.json(
      { error: `Tag no válido. Válidos: ${VALID_TAGS.join(', ')}` },
      { status: 400 }
    )
  }

  // Dispatch: si el tag tiene invalidador específico cross-runtime, usarlo.
  // Si no, fallback al revalidateTag genérico (solo Vercel).
  const specificInvalidator = TAG_INVALIDATORS[tag as ValidTag]
  let crossRuntime = false
  if (specificInvalidator) {
    await specificInvalidator()
    crossRuntime = true
  } else {
    revalidateTag(tag, 'max')
  }

  return NextResponse.json({
    success: true,
    revalidated: tag,
    crossRuntime, // true = invalidó también backend canary, false = solo Vercel
    timestamp: new Date().toISOString(),
  })
}

export const POST = withErrorLogging('/api/admin/revalidate', _POST)
