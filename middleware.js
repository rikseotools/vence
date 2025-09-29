// middleware.js
import { NextResponse } from 'next/server'

export function middleware(request) {
  // NO interceptar rutas de autenticación
  if (request.nextUrl.pathname.startsWith('/auth') || 
      request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Ya no necesitamos redirección automática - solo español
  const pathname = request.nextUrl.pathname

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