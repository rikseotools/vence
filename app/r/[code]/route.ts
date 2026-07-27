// app/r/[code]/route.ts — enlace de referido: vence.es/r/<code>
//
// Captura la atribución de forma RESILIENTE (Anexo A.2 del roadmap): setea una cookie funcional
// `vence_ref` (30-90d) Y propaga `?ref=` por la URL de destino (respaldo cookie-less). NO atribuye
// aquí (eso pasa al registrarse o vía el endpoint autenticado para el free existente) — esta ruta
// es una navegación de navegador sin token. Redirige a la HOME (ver el porqué junto a `dest`).
//
import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { resolveActiveReferralCode } from '@/lib/referrals/queries'
import { emitReferralEvent } from '@/lib/referrals/observability'
import { isSyntheticRequest } from '@/lib/api/syntheticRequest'

const REF_COOKIE = 'vence_ref'
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 60 // 60 días
// El redirect DEBE ir al dominio público. `request.url` detrás del ALB/CloudFront es el host interno
// del contenedor (0.0.0.0:3000) → un Location con ese host rompe el enlace para el usuario. Usamos el
// site público (build-arg NEXT_PUBLIC_SITE_URL, inlineado; fallback seguro). Cazado por el canary 10/07.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es'

async function _GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const valid = code ? await resolveActiveReferralCode(code) : null
  // El resolvedor canoniza (quita la basura que WhatsApp pega al enlace, ver lib/referrals/code.ts).
  // A partir de aquí SIEMPRE el canónico: si la cookie o el ?ref llevaran el crudo, la basura
  // seguiría viajando por el flujo y volvería a romper la atribución más adelante.
  const canonical = valid?.code ?? code

  // Observabilidad: click en el enlace (userId = embajador dueño del código).
  // Los canaries (header x-vence-canary) NO cuentan: inflarían el embudo con clicks sintéticos.
  // `sanitized` marca los clicks que ANTES se perdían: es la métrica de cuánto salva este fix.
  if (!isSyntheticRequest(request)) {
    emitReferralEvent('referral_link_click', {
      userId: valid?.ownerUserId ?? null,
      endpoint: '/r/[code]',
      severity: valid ? 'info' : 'warn',
      metadata: { code: canonical, valid: !!valid, sanitized: !!valid?.sanitized, ...(valid?.sanitized ? { rawCode: code.slice(0, 120) } : {}) },
    })
  }

  // Destino: la HOME (producto), no /embajadores.
  //
  // POR QUÉ (27/07/2026, con evidencia de usuario): hasta hoy el enlace aterrizaba en la página del
  // PROGRAMA DE REFERIDOS, así que lo primero que veía un desconocido al que acababan de recomendar
  // Vence era "4 formas de ganar recompensas · Recomienda Vence 10 € · Trae opositores activos 2 €".
  // Un opositor de un grupo de WhatsApp pinchó el enlace de una embajadora, hizo captura de esa
  // pantalla y respondió al grupo con una sola palabra: "Creepy" — y ella tuvo que salir a
  // defendernos. El dato acompaña al testimonio: 65 clicks en su enlace → 0 registros; en todo el
  // sistema, 216 clicks → 5 referidos (2,3%). La página de "gana dinero trayendo gente" es para
  // quien YA es cliente, no para la primera impresión de alguien que viene a ver un temario.
  //
  // La atribución NO depende del destino: viaja en la cookie `vence_ref` y la reclama
  // `components/ReferralAttributionOnLogin` (montado en el layout raíz) al autenticarse en CUALQUIER
  // página. El `?ref=` se conserva como respaldo cookie-less y como señal de analítica.
  const dest = new URL(valid ? `/?ref=${encodeURIComponent(canonical)}` : '/', SITE)
  const res = NextResponse.redirect(dest, { status: 302 })

  if (valid) {
    res.cookies.set(REF_COOKIE, canonical, {
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
