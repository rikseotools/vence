// app/api/version/route.ts — Devuelve la versión del deploy actual
// Usado por el cliente para detectar si tiene código viejo y forzar recarga
import { NextResponse } from 'next/server'

// En Fargate el workflow inyecta GIT_COMMIT_SHA/NEXT_PUBLIC_GIT_COMMIT_SHA.
// VERCEL_GIT_COMMIT_SHA queda como fallback legacy.
const BUILD_VERSION = process.env.GIT_COMMIT_SHA?.slice(0, 8)
  || process.env.NEXT_PUBLIC_GIT_COMMIT_SHA?.slice(0, 8)
  || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
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

// Touch 2026-05-19 17:25 UTC — forzar redeploy tras Vercel atascado en 4ee9ed74
