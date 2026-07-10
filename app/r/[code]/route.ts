// app/r/[code]/route.ts — enlace de referido: vence.es/r/<code>
//
// Captura la atribución de forma RESILIENTE (Anexo A.2 del roadmap): setea una cookie funcional
// `vence_ref` (30-90d) Y propaga `?ref=` por la URL de destino (para el caso de cookies rechazadas:
// el form de registro lo lee del querystring). NO atribuye aquí (eso pasa al registrarse o vía el
// endpoint autenticado para el free existente) — esta ruta es una navegación de navegador sin token.
//
import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { resolveActiveReferralCode } from '@/lib/referrals/queries'

const REF_COOKIE = 'vence_ref'
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 60 // 60 días

async function _GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const valid = code ? await resolveActiveReferralCode(code) : null

  // Destino: landing /embajadores con ?ref para atribución cookie-less. Código inválido → /embajadores sin ref.
  const dest = new URL(valid ? `/embajadores?ref=${encodeURIComponent(code)}` : '/embajadores', request.url)
  const res = NextResponse.redirect(dest, { status: 302 })

  if (valid) {
    res.cookies.set(REF_COOKIE, code, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: REF_COOKIE_MAX_AGE,
    })
  }
  return res
}

export const GET = withErrorLogging('/r/[code]', _GET)
// Export del handler crudo para tests (sin el wrapper).
export { _GET }
