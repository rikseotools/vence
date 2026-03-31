// app/api/teoria/articles/route.ts
// GET: Lista de artículos de una ley
import { NextRequest, NextResponse } from 'next/server'
import { fetchLawArticles } from '@/lib/teoriaFetchers'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const law = searchParams.get('law')

  if (!law) {
    return NextResponse.json({ error: 'Parámetro law requerido' }, { status: 400 })
  }

  const data = await fetchLawArticles(law)
  return NextResponse.json(data)
}

export const GET = withErrorLogging('/api/teoria/articles', _GET)
