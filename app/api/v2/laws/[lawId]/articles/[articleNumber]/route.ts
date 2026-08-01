// app/api/v2/laws/[lawId]/articles/[articleNumber]/route.ts — el TEXTO de un artículo. (T-327)
//
// Para que quien arma su temario pueda leer el artículo antes de decidir si entra. Sin esto la
// elección es a ciegas: un número no dice de qué trata, y meter artículos que no vienen a cuento
// es justo lo que hace inútil un temario propio.
//
// Existe `/api/teoria/[law]/[articleNumber]`, que hace esto por SLUG de ley. Aquí se indexa por
// `lawId` porque es lo que la pantalla tiene a mano (viene del buscador), y resolver el slug solo
// para volver a resolver la ley sería un viaje de ida y vuelta por nada. Devuelve lo justo: el
// texto, no el objeto entero con exámenes oficiales y relaciones que aquel arrastra.

import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getReadDb } from '@/db/client'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ lawId: string; articleNumber: string }> },
): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/laws/[lawId]/articles/[articleNumber]')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const { lawId, articleNumber } = await params
  if (!UUID.test(lawId)) {
    return NextResponse.json({ success: false, error: 'law_id_invalido' }, { status: 400 })
  }
  const numero = decodeURIComponent(articleNumber ?? '').trim()
  if (!numero) {
    return NextResponse.json({ success: false, error: 'articulo_invalido' }, { status: 400 })
  }

  const filas = (await getReadDb().execute(sql`
    SELECT article_number, title, content
      FROM articles
     WHERE law_id = ${lawId}::uuid AND article_number = ${numero} AND is_active = true
     LIMIT 1
  `)) as unknown as Array<{ article_number: string; title: string | null; content: string | null }>

  const a = filas[0]
  if (!a) {
    // 404 y no 200-con-null: «no existe» y «existe pero está vacío» son cosas distintas y la
    // pantalla tiene que poder decirlas distinto.
    return NextResponse.json({ success: false, error: 'no_encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    articleNumber: a.article_number,
    title: a.title,
    content: a.content ?? '',
  })
}

export const GET = withErrorLogging('/api/v2/laws/[lawId]/articles/[articleNumber]', _GET)
