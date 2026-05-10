// app/api/admin/infra-stats/route.ts - Estadísticas de infraestructura BD y carga
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]

function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

async function _GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const db = getDb()
    const today = new Date().toISOString().split('T')[0]
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Queries en paralelo
    const [
      connResult,
      connByStateResult,
      connByAppResult,
      sessionsResult,
      usageResult,
      errorsResult,
      peakResult,
      canaryStatsResult,
    ] = await Promise.all([
      // 1. Max connections + total
      db.execute(sql`
        SELECT
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
          (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) as total_connections
      `),

      // 2. Connections by state
      db.execute(sql`
        SELECT state, count(*)::int as count
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY state
        ORDER BY count DESC
      `),

      // 3. Connections by application
      db.execute(sql`
        SELECT
          COALESCE(application_name, '(none)') as app,
          state,
          count(*)::int as count
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY application_name, state
        ORDER BY count DESC
        LIMIT 15
      `),

      // 4. Sessions today
      supabase.from('user_sessions')
        .select('id', { count: 'exact' })
        .gte('session_start', `${today}T00:00:00`),

      // 5. Users and questions today
      supabase.from('daily_question_usage')
        .select('user_id, questions_answered')
        .eq('usage_date', today),

      // 6. Recent connection errors
      supabase.from('validation_error_logs')
        .select('endpoint, error_message, created_at')
        .or('error_message.ilike.%timeout%,error_message.ilike.%too many%,error_message.ilike.%connect%')
        .order('created_at', { ascending: false })
        .limit(10),

      // 7. Peak concurrent sessions today
      supabase.from('user_sessions')
        .select('session_start, session_end')
        .gte('session_start', `${today}T00:00:00`)
        .not('session_end', 'is', null)
        .order('session_start'),

      // 8. Canary stats — 5xx por endpoint (1h y 24h)
      // Comparativa visual: endpoints en canary self-hosted pooler vs los que siguen
      // contra Supavisor regional. Si la hipótesis del canary funciona, los del
      // pooler propio deberían tener 0 (o muy pocos) 5xx mientras los otros sí
      // sufren los blips intermitentes del Supavisor.
      db.execute(sql`
        SELECT endpoint,
               count(*) FILTER (WHERE created_at >= ${oneHourAgo}::timestamptz)::int AS errors_1h,
               count(*) FILTER (WHERE created_at >= ${twentyFourHoursAgo}::timestamptz)::int AS errors_24h
        FROM public.validation_error_logs
        WHERE http_status >= 500
          AND created_at >= ${twentyFourHoursAgo}::timestamptz
        GROUP BY endpoint
        ORDER BY errors_24h DESC
      `),
    ])

    // Parse results
    const connRows = Array.isArray(connResult) ? connResult : (connResult as any).rows || []
    const maxConnections = connRows[0]?.max_connections ?? 0
    const totalConnections = connRows[0]?.total_connections ?? 0

    const stateRows = Array.isArray(connByStateResult) ? connByStateResult : (connByStateResult as any).rows || []
    const connectionsByState = stateRows.map((r: any) => ({
      state: r.state || 'null',
      count: r.count,
    }))

    const appRows = Array.isArray(connByAppResult) ? connByAppResult : (connByAppResult as any).rows || []
    const connectionsByApp = appRows.map((r: any) => ({
      app: (r.app || '(none)').substring(0, 40),
      state: r.state || 'null',
      count: r.count,
    }))

    const sessionsToday = sessionsResult.count ?? 0
    const usersToday = usageResult.data?.length ?? 0
    const questionsToday = usageResult.data?.reduce((sum: number, a: any) => sum + (a.questions_answered || 0), 0) ?? 0

    const recentErrors = (errorsResult.data || []).map((e: any) => ({
      endpoint: e.endpoint,
      message: e.error_message?.substring(0, 100),
      date: e.created_at,
    }))

    // Calculate peak concurrent sessions
    let peakConcurrent = 0
    if (peakResult.data?.length) {
      const events: { time: number; delta: number }[] = []
      for (const s of peakResult.data) {
        events.push({ time: new Date(s.session_start).getTime(), delta: 1 })
        if (s.session_end) events.push({ time: new Date(s.session_end).getTime(), delta: -1 })
      }
      events.sort((a, b) => a.time - b.time)
      let current = 0
      for (const e of events) {
        current += e.delta
        if (current > peakConcurrent) peakConcurrent = current
      }
    }

    // Canary endpoints: lista de endpoints migrados al self-hosted pooler.
    // Cualquier endpoint NO listado aquí va contra Supavisor (path histórico).
    // Mantener sincronizado con docs/roadmap/self-hosted-pooler.md.
    const CANARY_ENDPOINTS = new Set([
      '/api/ranking',
      '/api/medals',
      '/api/questions/law-stats',
      '/api/v2/topic-progress/theme-stats',
      '/api/notifications/problematic-articles',
      '/api/v2/topic-progress/weak-articles',
      '/api/topics/[numero]',  // route con param dinámico — nuestro logger usa el path canonical
      '/api/questions/filtered',  // GET ?action=count migrado, POST aún no
    ])

    const canaryRows = Array.isArray(canaryStatsResult)
      ? canaryStatsResult
      : (canaryStatsResult as any).rows || []
    const canaryStats = canaryRows.map((r: any) => ({
      endpoint: r.endpoint,
      errors1h: r.errors_1h ?? 0,
      errors24h: r.errors_24h ?? 0,
      inCanary: CANARY_ENDPOINTS.has(r.endpoint),
    }))

    // Resumen agregado: total 5xx canary vs total 5xx non-canary últimas 24h
    const canarySummary = canaryStats.reduce(
      (acc: { canaryErrors24h: number; canaryErrors1h: number; nonCanaryErrors24h: number; nonCanaryErrors1h: number }, r: any) => {
        if (r.inCanary) {
          acc.canaryErrors24h += r.errors24h
          acc.canaryErrors1h += r.errors1h
        } else {
          acc.nonCanaryErrors24h += r.errors24h
          acc.nonCanaryErrors1h += r.errors1h
        }
        return acc
      },
      { canaryErrors24h: 0, canaryErrors1h: 0, nonCanaryErrors24h: 0, nonCanaryErrors1h: 0 },
    )

    return NextResponse.json({
      database: {
        maxConnections,
        totalConnections,
        usagePercent: Math.round((totalConnections / maxConnections) * 100),
        connectionsByState,
        connectionsByApp,
      },
      traffic: {
        sessionsToday,
        usersToday,
        questionsToday,
        peakConcurrent,
      },
      errors: recentErrors,
      canary: {
        endpointsInPooler: Array.from(CANARY_ENDPOINTS).sort(),
        statsByEndpoint: canaryStats,
        summary: canarySummary,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error in infra-stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/admin/infra-stats', _GET)
