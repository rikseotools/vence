// middleware.ts - Redirects 301 para aliases de slugs de leyes
//
// Intercepta URLs como /leyes/ce, /leyes/trebep, /teoria/lopj
// y redirige al slug canónico (/leyes/constitucion-espanola, etc.)
// SEO: 301 (permanente) transfiere link juice al slug canónico.
// Escalable: los aliases se cargan de BD (tabla law_slug_aliases).

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveAlias } from './lib/lawSlugAliases'

// Rutas donde los slugs de leyes aparecen
const LAW_SLUG_PATTERNS = [
  /^\/leyes\/([^/]+)(\/.*)?$/,
  /^\/teoria\/([^/]+)(\/.*)?$/,
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  for (const pattern of LAW_SLUG_PATTERNS) {
    const match = pathname.match(pattern)
    if (!match) continue

    const slug = match[1]
    const rest = match[2] || ''

    // Consultar si es un alias
    const canonical = await resolveAlias(slug)
    if (canonical && canonical !== slug) {
      const prefix = pathname.startsWith('/leyes/') ? '/leyes/' : '/teoria/'
      const newUrl = request.nextUrl.clone()
      newUrl.pathname = `${prefix}${canonical}${rest}`

      // 301 Moved Permanently — SEO-friendly
      return NextResponse.redirect(newUrl, 301)
    }
  }

  return NextResponse.next()
}

// Solo ejecutar en rutas de leyes y teoría (no en API, static, etc.)
export const config = {
  matcher: ['/leyes/:path*', '/teoria/:path*'],
}
