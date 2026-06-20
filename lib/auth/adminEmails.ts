// lib/auth/adminEmails.ts
// Allowlist de admins CLIENT-SAFE (cero imports de servidor). Fuente única de
// verdad usada por el gate de servidor (lib/api/shared/auth.requireAdmin) y por
// el gating de UI en el cliente (sustituye a la RPC is_current_user_admin, que
// dependía de auth.uid() y no es portable a RDS/Neon).
//
// Verificado 2026-06-20: el único admin por rol en BD (manueltrader@gmail.com)
// está en esta lista; no hay user_profiles.plan_type='admin'. La allowlist es
// superset del rol → alinear el cliente con el gate real del servidor.
export const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}
