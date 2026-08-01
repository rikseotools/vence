// app/api/v2/laws/[lawId]/articles/route.ts — artículos de UNA ley, por su id. (T-327)
//
// ── POR QUÉ NO SE REUSA `/api/v2/test-config/articles` ──────────────────────────────────────
//
// Se miró primero, y no encaja por una razón de fondo, no de comodidad: aquel endpoint exige
// `positionType`, y lo valida contra un **enum cerrado de oposiciones del catálogo**. Aquí la
// oposición **todavía no existe** —se está creando ahora mismo— y cuando exista tampoco estará
// en ese enum, porque es personalizada. Pasarle una oposición cualquiera solo para satisfacer al
// validador sería una mentira que rompería en cuanto alguien apriete esa comprobación, y además
// la exigencia vive en el BACKEND, así que relajarla obligaría a cambiar dos superficies en
// paridad para un caso que no es el suyo.
//
// Lo que sí se reutiliza es lo que importa: **la misma semántica** que allí. Se resuelve la ley,
// se listan sus artículos activos y se cuenta cuántas preguntas activas cuelgan de cada uno,
// porque la pantalla necesita poder desactivar los que servirían 0 preguntas.

import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getReadDb } from '@/db/client'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ lawId: string }> },
): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/laws/[lawId]/articles')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const { lawId } = await params
  // Se comprueba la forma ANTES de llegar a Postgres: un id inválido daría un 500 con un error
  // de casteo, que se lee como «está roto» en vez de «has pedido algo que no existe».
  if (!UUID.test(lawId)) {
    return NextResponse.json({ success: false, error: 'law_id_invalido' }, { status: 400 })
  }

  const db = getReadDb()
  const filas = (await db.execute(sql`
    SELECT a.article_number,
           a.title,
           count(q.id) FILTER (WHERE q.is_active = true)::int AS question_count
      FROM articles a
      LEFT JOIN questions q ON q.primary_article_id = a.id
     WHERE a.law_id = ${lawId}::uuid AND a.is_active = true
     GROUP BY a.article_number, a.title
     -- Orden natural, y en DOS niveles porque uno solo no basta:
     --  1) los artículos NUMÉRICOS primero. Sin esto, quitarle las letras a «DA1» la deja en «1»
     --     y las disposiciones se cuelan entre el art. 1 y el 2 (medido en la CE el 01/08:
     --     0 · 1 · DA1 · DT1 · 2 …). Quien busca el artículo 2 no lo encuentra donde debe estar.
     --  2) dentro de cada grupo, por su número: el 2 antes que el 10. Ordenar como texto pondría
     --     el 10 antes que el 2.
     ORDER BY (a.article_number ~ '^[0-9]+$') DESC,
              NULLIF(regexp_replace(a.article_number, '[^0-9]', '', 'g'), '')::int NULLS LAST,
              a.article_number
  `)) as unknown as Array<{ article_number: string; title: string | null; question_count: number }>

  return NextResponse.json({
    success: true,
    lawId,
    articles: filas.map((f) => ({
      article_number: f.article_number,
      title: f.title,
      question_count: Number(f.question_count ?? 0),
    })),
  })
}

export const GET = withErrorLogging('/api/v2/laws/[lawId]/articles', _GET)
