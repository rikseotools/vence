// lib/auth/lifecycleFlag.ts
// Flag de rollout (Fase A2 de docs/roadmap/auth-agnostico-jwks-y-rls.md):
// si true, las RPCs de ciclo de vida (crear perfil / check acceso / activar
// premium) van por endpoints Drizzle agnósticos en vez de supabase.rpc().
// Mismas funciones SQL, transporte portable a RDS/Neon.
// Build-time (NEXT_PUBLIC) → flip = redeploy. Default false (path legacy).
export const LIFECYCLE_VIA_API = process.env.NEXT_PUBLIC_AUTH_LIFECYCLE_VIA_API === 'true'
