// app/api/revalidate/route.ts
// API para invalidar cache de Next.js
import { revalidateTag, revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    const tag = searchParams.get('tag')
    const path = searchParams.get('path')

    // Verificar secret (usar variable de entorno en producción)
    const expectedSecret = process.env.REVALIDATE_SECRET || 'vence-revalidate-2024'
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    if (tag) {
      // @ts-expect-error - Next.js 16 type definition issue
      revalidateTag(tag)
      return NextResponse.json({
        revalidated: true,
        type: 'tag',
        tag,
        timestamp: new Date().toISOString()
      })
    }

    if (path) {
      revalidatePath(path)
      return NextResponse.json({
        revalidated: true,
        type: 'path',
        path,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({ error: 'Missing tag or path parameter' }, { status: 400 })
  } catch (error) {
    console.error('Revalidation error:', error)
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 })
  }
}

// También permitir GET para facilitar uso manual
export async function GET(request: NextRequest) {
  return POST(request)
}
