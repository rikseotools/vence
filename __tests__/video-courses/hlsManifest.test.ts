/**
 * HLS (fase 2): token-capability + reescritura de manifiestos.
 * Verifica que los segmentos se reescriben a URLs presignadas de koigrid y que el tk
 * autoriza/expira correctamente (protección premium sin filtrar los .ts).
 */
process.env.SUPABASE_JWT_SECRET = 'test-secret-hls'
process.env.KOIGRID_VIDEO_BUCKET = 'vence-videos'
process.env.KOIGRID_VIDEO_ACCESS_KEY = 'AKIATEST'
process.env.KOIGRID_VIDEO_SECRET_KEY = 'secretkeytest'
process.env.KOIGRID_VIDEO_ENDPOINT = 'https://s3.koigrid.com'

import {
  hlsBaseKeyFor,
  signHlsToken,
  verifyHlsToken,
  rewriteMaster,
  rewriteVariant,
} from '@/lib/api/video-courses/hlsManifest'

describe('HLS hlsBaseKeyFor', () => {
  it('deriva la base de las keys HLS quitando .mp4 y prefijando hls/', () => {
    expect(hlsBaseKeyFor('word-365/bloque-01.mp4')).toBe('hls/word-365/bloque-01')
    expect(hlsBaseKeyFor('access-365/bloque-05.MP4')).toBe('hls/access-365/bloque-05')
  })
})

describe('HLS token-capability', () => {
  it('roundtrip: firma y verifica devolviendo el videoPath', () => {
    const tk = signHlsToken('word-365/bloque-01.mp4', 3600)
    expect(verifyHlsToken(tk)).toBe('word-365/bloque-01.mp4')
  })
  it('rechaza firma manipulada', () => {
    const tk = signHlsToken('word-365/bloque-01.mp4', 3600)
    expect(verifyHlsToken(tk.slice(0, -2) + 'XX')).toBeNull()
  })
  it('rechaza payload manipulado (otra ruta)', () => {
    const tk = signHlsToken('word-365/bloque-01.mp4', 3600)
    const forged = Buffer.from(JSON.stringify({ v: 'otro/hack.mp4', e: 9999999999 }))
      .toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    expect(verifyHlsToken(forged + '.' + tk.split('.')[1])).toBeNull()
  })
  it('rechaza token expirado', () => {
    expect(verifyHlsToken(signHlsToken('x.mp4', -10))).toBeNull()
  })
  it('rechaza basura / vacío', () => {
    expect(verifyHlsToken('no-es-token')).toBeNull()
    expect(verifyHlsToken('')).toBeNull()
    expect(verifyHlsToken(null)).toBeNull()
  })
})

describe('HLS rewriteMaster', () => {
  it('apunta cada variante a la ruta de la app arrastrando el tk', () => {
    const master = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=3300000,RESOLUTION=1920x1080',
      '1080p/index.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720',
      '720p/index.m3u8',
    ].join('\n')
    const out = rewriteMaster(master, '/api/cursos/hls/LID', 'TK123')
    expect(out).toContain('/api/cursos/hls/LID/1080p/index.m3u8?tk=TK123')
    expect(out).toContain('/api/cursos/hls/LID/720p/index.m3u8?tk=TK123')
    expect(out).toContain('#EXT-X-STREAM-INF') // comentarios intactos
  })
})

describe('HLS rewriteVariant', () => {
  it('reescribe cada segmento .ts a una URL presignada de koigrid, dejando las directivas', () => {
    const variant = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXTINF:6.000,',
      'seg_0000.ts',
      '#EXTINF:6.000,',
      'seg_0001.ts',
      '#EXT-X-ENDLIST',
    ].join('\n')
    const out = rewriteVariant(variant, 'hls/word-365/bloque-01', '720p')
    expect(out).not.toBeNull()
    const lines = out!.split('\n')
    // los .ts pasan a URLs absolutas presignadas de koigrid
    const segLines = lines.filter((l) => l.startsWith('http'))
    expect(segLines).toHaveLength(2)
    for (const l of segLines) {
      expect(l).toContain('s3.koigrid.com/vence-videos/hls/word-365/bloque-01/720p/seg_')
      expect(l).toContain('X-Amz-Signature=')
      expect(l).toContain('X-Amz-Expires=')
    }
    // directivas intactas
    expect(out).toContain('#EXTINF:6.000,')
    expect(out).toContain('#EXT-X-ENDLIST')
  })
})
