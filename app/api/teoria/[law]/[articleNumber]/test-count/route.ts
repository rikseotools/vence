// app/api/teoria/[law]/[articleNumber]/test-count/route.ts
//
// Devuelve cuántas preguntas SERVIRÍA el test de este artículo para la oposición
// del usuario (path law-only /leyes/[law]?selected_articles=N). Fuente del CTA
// "Hacer test de este artículo" del lector de teoría.
//
// SSOT: delega en countLawArticleServedQuestions, que reusa el MISMO núcleo que
// sirve el test → el conteo NUNCA se desincroniza de lo que el usuario recibe
// (sin dead-ends). La oposición la aporta el cliente (positionType), igual que
// LawTestPageWrapper; default coherente con ese wrapper.
import { NextRequest, NextResponse } from 'next/server'
import { getShortNameBySlug } from '@/lib/api/laws'
import { countLawArticleServedQuestions } from '@/lib/api/filtered-questions'
import { ALL_POSITION_TYPES } from '@/lib/config/oposiciones'
import { versionedCache } from '@/lib/cache/versionedCache'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

const DEFAULT_POSITION_TYPE = 'auxiliar_administrativo_estado'
const VALID_POSITIONS = new Set(ALL_POSITION_TYPES)

// Normaliza el positionType (query param del cliente). Si no es una oposición
// registrada → default. Evita que junk arbitrario llegue a buildOfficialExamFilter
// (que loguearía un warn por request → log-spam) y acota la cardinalidad de caché.
export function normalizePositionType(raw: string | null | undefined): string {
  return raw && VALID_POSITIONS.has(raw) ? raw : DEFAULT_POSITION_TYPE
}

// Caché de seguridad (cross-instancia por versión + TTL 5min): el endpoint es
// público y lo golpea cada vista de artículo. La clave incluye (shortName, art,
// positionType). Invalidable al instante con bumpCacheVersion('teoria').
const cachedCount = versionedCache(countLawArticleServedQuestions, {
  tag: 'teoria',
  keyParts: ['article-test-count'],
  revalidate: 300,
})

async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ law: string; articleNumber: string }> },
) {
  const { law: lawSlug, articleNumber: articleParam } = await params

  const raw = articleParam.startsWith('articulo-')
    ? articleParam.replace('articulo-', '')
    : articleParam
  const articleNumber = parseInt(raw, 10)
  if (!Number.isInteger(articleNumber) || articleNumber <= 0) {
    return NextResponse.json({ count: 0 })
  }

  const positionType = normalizePositionType(request.nextUrl.searchParams.get('positionType'))

  const lawShortName = await getShortNameBySlug(lawSlug)
  if (!lawShortName) return NextResponse.json({ count: 0 })

  const count = await cachedCount(lawShortName, articleNumber, positionType)
  return NextResponse.json({ count })
}

export const GET = withErrorLogging('/api/teoria/[law]/[articleNumber]/test-count', _GET)
