import { NextRequest, NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import {
  hlsBaseKeyFor,
  fetchKoigridText,
  rewriteMaster,
  rewriteVariant,
  verifyHlsToken,
  HLS_QUALITIES,
} from '@/lib/api/video-courses/hlsManifest'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cursos/hls/<lessonId>/master.m3u8?tk=<token>
 * GET /api/cursos/hls/<lessonId>/<quality>/index.m3u8?tk=<token>
 *
 * Sirve los manifiestos HLS (fase 2) autorizados por el token-capability `tk` (emitido
 * por /api/cursos/video-url tras el gate premium), reescribiendo los segmentos a URLs
 * presignadas de koigrid. Los .ts NO pasan por aquí (van directos de koigrid al player).
 * Stateless (el tk lleva el videoPath firmado) → sin BD. Compatible con HLS nativo de iOS.
 */
async function _GET(
  request: NextRequest,
  context: { params: Promise<{ lessonId: string; seg: string[] }> },
) {
  const { lessonId, seg } = await context.params
  const tk = request.nextUrl.searchParams.get('tk')

  const videoPath = verifyHlsToken(tk)
  if (!videoPath) {
    return NextResponse.json({ error: 'Token HLS inválido o expirado' }, { status: 403 })
  }

  const baseKey = hlsBaseKeyFor(videoPath)
  const m3u8Headers = {
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Cache-Control': 'private, no-store',
  }

  // master.m3u8
  if (seg.length === 1 && seg[0] === 'master.m3u8') {
    const master = await fetchKoigridText(`${baseKey}/master.m3u8`)
    if (master === null) {
      return NextResponse.json({ error: 'HLS no disponible' }, { status: 404 })
    }
    const body = rewriteMaster(master, `/api/cursos/hls/${lessonId}`, tk!)
    return new NextResponse(body, { status: 200, headers: m3u8Headers })
  }

  // <quality>/index.m3u8
  if (seg.length === 2 && seg[1] === 'index.m3u8' && (HLS_QUALITIES as readonly string[]).includes(seg[0])) {
    const variant = await fetchKoigridText(`${baseKey}/${seg[0]}/index.m3u8`)
    if (variant === null) {
      return NextResponse.json({ error: 'HLS no disponible' }, { status: 404 })
    }
    const body = rewriteVariant(variant, baseKey, seg[0])
    if (body === null) {
      return NextResponse.json({ error: 'HLS no disponible' }, { status: 404 })
    }
    return new NextResponse(body, { status: 200, headers: m3u8Headers })
  }

  return NextResponse.json({ error: 'Ruta HLS inválida' }, { status: 400 })
}

export const GET = withErrorLogging('/api/cursos/hls/[lessonId]/[...seg]', _GET)
