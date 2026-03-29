// proxy.ts (Next.js 16+)
// Rate limiting para tests + headers anti-indexación + redirects aliases de leyes
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { resolveAlias } from './lib/lawSlugAliases'

// Rutas donde los slugs de leyes aparecen (redirect aliases → canonical)
const LAW_SLUG_PATTERNS = [
  /^\/leyes\/([^/]+)(\/.*)?$/,
  /^\/teoria\/([^/]+)(\/.*)?$/,
]

// 🔒 Rate limiter en memoria para usuarios autenticados en tests
interface RateLimitRecord {
  count: number
  windowStart: number
}

const rateLimitMap = new Map<string, RateLimitRecord>()

// Configuración de rate limiting
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 60 * 1000, // 1 hora
  maxRequests: 300, // Máximo 300 requests a tests por hora
  cleanupInterval: 5 * 60 * 1000 // Limpiar cache cada 5 minutos
}

// Limpieza periódica del cache (evitar memory leaks)
let lastCleanup = Date.now()
function cleanupRateLimitCache() {
  const now = Date.now()
  if (now - lastCleanup < RATE_LIMIT_CONFIG.cleanupInterval) return

  lastCleanup = now
  for (const [key, data] of rateLimitMap.entries()) {
    if (now - data.windowStart > RATE_LIMIT_CONFIG.windowMs) {
      rateLimitMap.delete(key)
    }
  }
}

// Verificar rate limit para un usuario
function checkRateLimit(sessionKey: string) {
  cleanupRateLimitCache()

  const now = Date.now()
  const record = rateLimitMap.get(sessionKey)

  if (!record || now - record.windowStart > RATE_LIMIT_CONFIG.windowMs) {
    // Nueva ventana
    rateLimitMap.set(sessionKey, { count: 1, windowStart: now })
    return { allowed: true, remaining: RATE_LIMIT_CONFIG.maxRequests - 1 }
  }

  record.count++

  if (record.count > RATE_LIMIT_CONFIG.maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: RATE_LIMIT_CONFIG.maxRequests - record.count }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ✅ NO interceptar rutas de autenticación ni estáticos
  if (pathname.startsWith('/auth') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/_next')) {
    return NextResponse.next()
  }

  // 🔀 REDIRECTS: Aliases de slugs de leyes → slug canónico (301)
  for (const pattern of LAW_SLUG_PATTERNS) {
    const match = pathname.match(pattern)
    if (!match) continue

    const slug = match[1]
    const rest = match[2] || ''
    const canonical = await resolveAlias(slug)

    if (canonical && canonical !== slug) {
      const prefix = pathname.startsWith('/leyes/') ? '/leyes/' : '/teoria/'
      const newUrl = request.nextUrl.clone()
      newUrl.pathname = `${prefix}${canonical}${rest}`
      return NextResponse.redirect(newUrl, 301)
    }
  }

  // Añadir pathname a headers
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  // 🔒 RATE LIMITING: Solo para rutas de TEST con usuario autenticado
  const isTestRoute = pathname.includes('/test/') ||
                      pathname.includes('/test-examen') ||
                      pathname.includes('/test-personalizado') ||
                      pathname.includes('/test-rapido')

  if (isTestRoute) {
    // Buscar cookie de sesión de Supabase
    const cookies = request.cookies
    const accessToken = cookies.get('sb-access-token')?.value ||
                       cookies.get('sb-refresh-token')?.value

    if (accessToken) {
      // Usuario autenticado - aplicar rate limiting
      // Usar hash simple del token como key (no el token completo por seguridad)
      const sessionKey = `rate:${accessToken.slice(0, 16)}`
      const { allowed, remaining } = checkRateLimit(sessionKey)

      if (!allowed) {
        console.warn(`🚫 Rate limit exceeded for session: ${sessionKey.slice(0, 20)}...`)

        return new Response(
          JSON.stringify({
            error: 'Demasiadas solicitudes',
            message: 'Has realizado muchas preguntas en poco tiempo. Espera un momento antes de continuar.',
            retryAfter: 3600
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '3600',
              'X-RateLimit-Limit': String(RATE_LIMIT_CONFIG.maxRequests),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600)
            }
          }
        )
      }

      // Añadir headers de rate limit info
      requestHeaders.set('X-RateLimit-Remaining', String(remaining))
    }
  }

  // Crear respuesta con headers actualizados
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // 🚨 HEADERS ANTI-INDEXACIÓN para páginas privadas
  const privateRoutes = [
    '/admin',
    '/perfil',
    '/login',
    '/register',
    '/mis-estadisticas',
    '/mis-impugnaciones',
    '/configuracion',
    '/notificaciones',
    '/privacidad',
    '/terminos',
    '/cookies',
    '/aviso-legal'
  ]

  const isPrivateRoute = privateRoutes.some(route => pathname.startsWith(route))

  if (isPrivateRoute) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
  }

  // Headers de seguridad generales
  response.headers.set('X-Content-Type-Options', 'nosniff')

  return response
}

export const config = {
  matcher: [
    '/((?!api/auth|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
