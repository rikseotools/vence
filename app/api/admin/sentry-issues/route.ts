// app/api/admin/sentry-issues/route.ts
// API para obtener issues sin resolver de Sentry (solo admins)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN
const SENTRY_ORG = 'vence-x2'

export async function GET(request: Request) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]

    // Crear cliente con el token del usuario (no service role)
    // Esto permite que auth.uid() funcione en las RPC
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    // Verificar que el usuario está autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar si es admin usando RPC (misma función que usa Header.js)
    // Ahora funciona porque el cliente tiene el contexto del usuario
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_current_user_admin')

    if (adminError) {
      console.error('Error verificando admin:', adminError)
    }

    if (!isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Consultar Sentry
    if (!SENTRY_AUTH_TOKEN) {
      return NextResponse.json({
        success: true,
        count: 0,
        issues: [],
        message: 'Sentry no configurado'
      })
    }

    const response = await fetch(
      `https://sentry.io/api/0/organizations/${SENTRY_ORG}/issues/?statsPeriod=24h&query=is:unresolved`,
      {
        headers: {
          'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`
        }
      }
    )

    if (!response.ok) {
      console.error('Error Sentry API:', response.status)
      return NextResponse.json({
        success: true,
        count: 0,
        issues: [],
        message: 'Error consultando Sentry'
      })
    }

    const issues = await response.json()

    // Filtrar y simplificar datos
    const simplifiedIssues = issues.slice(0, 10).map((issue: any) => ({
      id: issue.id,
      title: issue.title,
      culprit: issue.culprit,
      count: issue.count,
      level: issue.level,
      lastSeen: issue.lastSeen,
      permalink: issue.permalink
    }))

    return NextResponse.json({
      success: true,
      count: issues.length,
      issues: simplifiedIssues
    })

  } catch (error) {
    console.error('Error en API sentry-issues:', error)
    return NextResponse.json({
      success: false,
      count: 0,
      issues: [],
      error: 'Error interno'
    }, { status: 500 })
  }
}
