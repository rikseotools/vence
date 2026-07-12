// lib/cache/adminPanelMemo.ts
// Memo in-memory POST-auth para paneles admin de MONITOREO (salud, infra, SLOs,
// observabilidad, canary). Estos paneles auto-refrescan cada ~60s por admin y
// agregan sobre observable_events (millones de filas) → sin cache saturan el
// primario RDS (ver docs/runbooks/contencion-rds-paneles-admin.md). El memo
// sirve el payload ya computado durante un TTL corto → 1 cómputo por Fargate-task
// por TTL, no N_admins × refresh.
//
// SEGURIDAD (CRÍTICO): llamar SIEMPRE después de verificar admin. El memo guarda
// SOLO datos post-autorización; nunca lo consultes antes del gate de auth.
//
// El memo es por-proceso (vive lo que vive el task Fargate) y no serializa
// (guarda el objeto JS tal cual) → sin los sustos de Date/Error de unstable_cache.
export interface AdminPanelMemo<T = Record<string, unknown>> {
  /** payload memoizado si sigue fresco (< TTL), o null si miss/expirado */
  get(key: string): T | null
  /** guarda el payload ya computado bajo `key` (p.ej. el `window`) */
  set(key: string, payload: T): void
}

export function createAdminPanelMemo<T = Record<string, unknown>>(ttlMs: number): AdminPanelMemo<T> {
  const store = new Map<string, { at: number; payload: T }>()
  return {
    get(key: string): T | null {
      const e = store.get(key)
      return e && Date.now() - e.at < ttlMs ? e.payload : null
    },
    set(key: string, payload: T): void {
      store.set(key, { at: Date.now(), payload })
    },
  }
}
