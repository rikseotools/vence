// lib/api/rollout/problematic-articles-logs.ts
// Logging fire-and-forget para el rollout de artículos problemáticos.
// Ver docs/maintenance/despliegue-articulos-problematicos.md

import { createClient } from '@supabase/supabase-js'

export type RolloutLogPath = 'new' | 'old'

export type LogRolloutEventInput = {
  userId: string | null
  positionType?: string | null
  path: RolloutLogPath
  articlesCount: number
  lawNames?: string[]
  durationMs?: number
}

/**
 * Registra un evento del rollout. Ejecuta en background (fire-and-forget)
 * para no bloquear la respuesta. Cualquier error se loguea pero no propaga.
 */
export function logRolloutEvent(input: LogRolloutEventInput): void {
  const run = async () => {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await supabase.from('problematic_articles_rollout_logs').insert({
        user_id: input.userId,
        position_type: input.positionType ?? null,
        path: input.path,
        articles_count: input.articlesCount,
        law_names: (input.lawNames ?? []).slice(0, 5),
        duration_ms: input.durationMs ?? null,
      })
    } catch (e) {
      console.warn('⚠️ [rollout-log] Insert falló:', (e as Error).message)
    }
  }
  void run()
}
