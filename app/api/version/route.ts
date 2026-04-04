// app/api/version/route.ts — Devuelve la versión del deploy actual
// Usado por el cliente para detectar si tiene código viejo y forzar recarga
import { NextResponse } from 'next/server'

// VERCEL_GIT_COMMIT_SHA se setea automáticamente en Vercel
// En desarrollo, usamos un timestamp del build
const BUILD_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
  || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
  || 'dev'

export function GET() {
  return NextResponse.json(
    { version: BUILD_VERSION },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  )
}
