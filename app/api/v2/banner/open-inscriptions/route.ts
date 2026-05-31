// app/api/v2/banner/open-inscriptions/route.ts
//
// Devuelve oposiciones con inscripción ABIERTA hoy (fecha Madrid) y,
// para usuarios autenticados, también la lista de slugs ya dismisseados
// (vía POST /dismiss). El cliente combina ambas con su localStorage para
// elegir cuál mostrar (la más urgente que no esté dismisseada).
//
// Filosofía:
//   • Source-of-truth = fechas (inscription_start, inscription_deadline).
//     NO usamos estado_proceso porque se desincroniza (visto 2026-05-27
//     en Guardia Civil: deadline pasó pero estado seguía 'inscripcion_abierta').
//   • Server NO filtra por dismiss → cliente decide. Razón: combinar
//     dismisses servidor + localStorage en un solo sitio (cliente) es
//     más simple y testeable.
//   • Anónimos: NO necesitan auth — la lista de open inscriptions es
//     información pública (ya visible en cada landing). Solo el dismiss
//     necesita auth.
//
// Roadmap: docs/roadmap/banner-inscripcion-abierta.md

import { NextRequest, NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getServiceClient } from '@/lib/api/shared/auth'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

export const maxDuration = 10

type OpenInscription = {
  slug: string
  nombre: string
  short_name: string | null
  subgrupo: string | null
  plazas_libres: number | null
  inscription_start: string
  inscription_deadline: string
  exam_date: string | null
  boe_reference: string | null
  programa_url: string | null
  color_primario: string | null
}

// Hoy en Europa/Madrid como 'YYYY-MM-DD' (no usar new Date().toISOString
// porque eso da UTC; en madrugada UTC podría devolver "ayer" en Madrid).
function todayMadrid(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
}

async function _GET(request: NextRequest) {
  const supabase = getServiceClient()
  const today = todayMadrid()

  // Listado público de oposiciones con inscripción abierta hoy.
  // is_active=true → solo oposiciones publicadas.
  const { data: openRaw, error: openErr } = await supabase
    .from('oposiciones')
    .select('slug, nombre, short_name, subgrupo, plazas_libres, inscription_start, inscription_deadline, exam_date, boe_reference, programa_url, color_primario')
    .eq('is_active', true)
    .lte('inscription_start', today)
    .gte('inscription_deadline', today)
    .order('inscription_deadline', { ascending: true })

  if (openErr) {
    console.error('❌ [API/banner/open-inscriptions] query open error:', openErr)
    return NextResponse.json({ open: [], dismissed: [], targetOposicion: null }, { status: 200 })
  }

  const open = (openRaw ?? []) as OpenInscription[]

  // Auth opcional. Si hay sesión, traemos dismisses persistidos +
  // target_oposicion para que el cliente excluya el target. Si no,
  // devolvemos solo la lista pública (cliente filtra con localStorage).
  const auth = await verifyAuth(request, '/api/v2/banner/open-inscriptions')

  if (!auth.success) {
    return NextResponse.json(
      { open, dismissed: [], targetOposicion: null },
      // Cache navegador 5 min — la lista cambia muy poco (deadlines son
      // de varios días). Aún así private para no compartir entre users.
      { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' } }
    )
  }

  // Dismisses persistentes + target_oposicion del user.
  const [{ data: dismissedRows }, { data: profileRow }] = await Promise.all([
    supabase
      .from('user_inscription_banner_dismissals')
      .select('oposicion_slug, boe_reference_at_dismiss')
      .eq('user_id', auth.userId),
    supabase
      .from('user_profiles')
      .select('target_oposicion')
      .eq('id', auth.userId)
      .maybeSingle(),
  ])

  // Un dismiss es válido SOLO si la convocatoria sigue siendo la misma
  // (mismo boe_reference). Si la oposición tiene nueva convocatoria,
  // el dismiss antiguo queda invalidado y el banner vuelve a aparecer
  // — comportamiento intencional: nueva BOE = información nueva.
  const openBySlug = new Map(open.map((o) => [o.slug, o]))
  const dismissed = (dismissedRows ?? [])
    .filter((d) => {
      const opo = openBySlug.get(d.oposicion_slug)
      if (!opo) return true // si no está en open, no afecta
      return (d.boe_reference_at_dismiss ?? null) === (opo.boe_reference ?? null)
    })
    .map((d) => d.oposicion_slug)

  // user_profiles.target_oposicion guarda positionType con underscores
  // (auxiliar_administrativo_estado), mientras que oposiciones.slug usa
  // guiones (auxiliar-administrativo-estado). Normalizamos a guiones
  // para que la comparación cliente `o.slug !== target` funcione.
  const targetOposicion = profileRow?.target_oposicion?.replace(/_/g, '-') ?? null

  return NextResponse.json(
    {
      open,
      dismissed,
      targetOposicion,
    },
    { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' } }
  )
}

export const GET = withErrorLogging('/api/v2/banner/open-inscriptions', _GET)
