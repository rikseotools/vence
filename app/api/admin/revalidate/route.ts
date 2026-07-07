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
// encapsulan ambos planos (web/ECS + backend) y son la fuente única.
//
// Patrón: TAG_INVALIDATORS mapea tags con counterpart cross-runtime a
// su función específica. Tags sin entrada usan el dispatch genérico
// `revalidateTag()` solo (no tienen backend canary, no necesitan INCR).

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { invalidateTestConfigCache } from '@/lib/cache/test-config'
import { bumpCacheVersion } from '@/lib/cache/versionStore'

const VALID_TAGS = [
  'temario',
  'teoria',
  'laws',
  'landing',
  'oposiciones-catalog', // catálogo/selector de oposiciones (SSOT convocatoria vigente)
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

  // Plano CROSS-INSTANCIA (agnóstico, Postgres): bump del contador de versión del
  // tag. Es lo que hace que TODAS las instancias ECS invaliden el unstable_cache
  // versionado (lib/cache/versionedCache), no solo la que atiende esta petición.
  // `revalidateTag` de Next.js standalone es per-instancia y por sí solo no basta.
  let cacheVersion: number | null = null
  try {
    cacheVersion = await bumpCacheVersion(tag)
  } catch (err) {
    // No romper la revalidación por un blip del store de versiones; se registra.
    console.warn(`[revalidate] bumpCacheVersion("${tag}") failed:`, err instanceof Error ? err.message : err)
  }

  // Dispatch legacy: si el tag tiene invalidador específico cross-runtime
  // (backend NestJS canary), usarlo; si no, revalidateTag genérico (per-instancia,
  // best-effort — el bump de arriba es el mecanismo fiable cross-instancia).
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
    cacheVersion,   // nueva versión del tag en Postgres (invalidación cross-instancia)
    crossRuntime,   // true = invalidó también backend canary
    timestamp: new Date().toISOString(),
  })
}

export const POST = withErrorLogging('/api/admin/revalidate', _POST)
