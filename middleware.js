// middleware.js
import { NextResponse } from 'next/server'

export function middleware(request) {
  // NO interceptar rutas de autenticación
  if (request.nextUrl.pathname.startsWith('/auth') || 
      request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Redirección automática a versión española
  const url = request.nextUrl.clone()
  const pathname = request.nextUrl.pathname
  
  // Solo procesar si no está ya en /es y no es una ruta estática
  if (!pathname.startsWith('/es') && 
      !pathname.startsWith('/_next') && 
      !pathname.startsWith('/api') && 
      pathname !== '/favicon.ico' &&
      !pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)) {
    
    // 1. Verificar idioma del navegador (Accept-Language header)
    const acceptLanguage = request.headers.get('accept-language') || ''
    const isSpanishBrowser = acceptLanguage.includes('es') || acceptLanguage.includes('es-ES')
    
    if (isSpanishBrowser) {
      url.pathname = `/es${pathname === '/' ? '' : pathname}`
      return NextResponse.redirect(url)
    }
    
    // 2. Verificar IP española (fallback)
    const country = request.geo?.country || request.headers.get('cf-ipcountry') || ''
    if (country === 'ES') {
      url.pathname = `/es${pathname === '/' ? '' : pathname}`
      return NextResponse.redirect(url)
    }
  }

  // Añadir pathname solo a rutas no-auth
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  
  // 🚨 HEADERS ANTI-INDEXACIÓN para páginas privadas
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  
  // Páginas que NUNCA deben indexarse
  const privateRoutes = [
    '/es/admin',
    '/es/perfil', 
    '/es/login',
    '/es/register',
    '/es/mis-estadisticas',
    '/es/mis-impugnaciones',
    '/es/configuracion',
    '/es/notificaciones',
    '/es/privacidad',
    '/es/terminos',
    '/es/cookies',
    '/es/aviso-legal'
  ]
  
  const isPrivateRoute = privateRoutes.some(route => pathname.startsWith(route))
  
  if (isPrivateRoute) {
    // Headers críticos anti-indexación
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
  }
  
  return response
}

export const config = {
  matcher: [
    '/((?!api/auth|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}