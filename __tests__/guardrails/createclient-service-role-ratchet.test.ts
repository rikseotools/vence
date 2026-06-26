import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// ============================================================================
// GUARDRAIL — anti-reintroducción de `createClient(SERVICE_ROLE)` (la barrera
// que el roadmap de agnosticismo decía que faltaba)
// ============================================================================
// El incidente que disparó `docs/roadmap/agnosticismo-supabase.md` fue admin/feedback
// con 10× `createClient(url, SERVICE_ROLE)` colados "porque nada lo prohibía". Un
// cliente Supabase con la service-role key:
//   1. habla PostgREST → NO existe en Neon/RDS (bloquea el swap de BD), y
//   2. bypassa RLS sin acotar por usuario → riesgo de fuga si se usa mal.
// La vía agnóstica es `getAdminDb()`/`getReadDb()` (Drizzle, conexión directa).
//
// RATCHET: la ALLOWLIST de ficheros que aún lo usan legítimamente (infra de auth
// + server-side pendiente de barrido) SOLO debe ENCOGER. Si un fichero NUEVO
// introduce el patrón → este test falla: o lo migras a Drizzle, o (si es infra
// legítima) lo añades conscientemente aquí. Mismo espíritu que el ratchet `.from`
// de cliente y `auth-agnostic-ratchet`.

const ROOT = join(__dirname, '..', '..')
const SCAN_DIRS = ['app', 'lib', 'components', 'contexts', 'hooks']
const EXT = /\.(ts|tsx|js)$/
const SKIP = /node_modules|\.next|\.open-next|\.backup|backup-|__tests__|\.test\./

// Ficheros que a fecha 2026-06-26 crean legítimamente un cliente service-role.
// `lib/api/shared/auth.ts` es infra de verificación de tokens (se queda hasta Fase B);
// el resto es server-side pendiente del barrido de Fase C (admin/cron/storage).
// Esta lista SOLO debe ENCOGER.
const ALLOWLIST = new Set<string>([
  'app/api/admin/email-events/route.ts',
  'app/api/admin/newsletters/audience/route.ts',
  'app/api/ai/verify-answer/route.ts',
  'app/api/dispute/mark-read/route.ts',
  'app/api/v2/admin/broadcast/route.ts',
  'lib/api/shared/auth.ts',
  'lib/api/video-courses/queries.ts',
  'lib/armando/supabaseAdmin.ts',
])

function walk(rel: string): string[] {
  let out: string[] = []
  let entries: string[]
  try { entries = readdirSync(join(ROOT, rel)) } catch { return [] }
  for (const e of entries) {
    const childRel = `${rel}/${e}`
    if (SKIP.test(childRel)) continue
    const st = statSync(join(ROOT, childRel))
    if (st.isDirectory()) out = out.concat(walk(childRel))
    else if (EXT.test(e)) out.push(childRel)
  }
  return out
}

// Quita comentarios (línea y bloque): la regla es sobre CÓDIGO real. Un comentario
// "...en vez de createClient(SERVICE_ROLE)..." (lo que hace casi todo módulo migrado)
// NO debe contar — mismo gotcha que infla el ratchet `.from`.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

// Un fichero "ofende" si, en código real, crea un cliente Supabase Y maneja la
// service-role key (el patrón raíz `createClient(url, SERVICE_ROLE_KEY)`).
function usesServiceRoleClient(rawSrc: string): boolean {
  const code = stripComments(rawSrc)
  return /createClient\s*\(/.test(code) && /(SERVICE_ROLE|service_role)/.test(code)
}

const ALL_FILES = SCAN_DIRS.flatMap(walk)
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('GUARDRAIL: ningún fichero NUEVO usa createClient(SERVICE_ROLE) (barrera agnóstica)', () => {
  it('ningún fichero fuera de la allowlist crea un cliente service-role', () => {
    const offenders = ALL_FILES.filter((f) => !ALLOWLIST.has(f) && usesServiceRoleClient(read(f)))
    if (offenders.length > 0) {
      throw new Error(
        `❌ ${offenders.length} fichero(s) NUEVO(s) con createClient(SERVICE_ROLE):\n` +
        offenders.map((f) => `  • ${f}`).join('\n') +
        `\n\nUsa getAdminDb()/getReadDb() de '@/db/client' (Drizzle, portable a Neon/RDS). ` +
        `Si es infra de auth legítima, añádelo conscientemente a la ALLOWLIST.`
      )
    }
  })

  it('la allowlist no tiene entradas obsoletas (solo debe encoger)', () => {
    const stale = [...ALLOWLIST].filter((f) => !ALL_FILES.includes(f) || !usesServiceRoleClient(read(f)))
    expect(stale).toEqual([])
  })

  // Self-test: la detección tiene dientes y respeta el strip de comentarios.
  it('meta: detecta el patrón en código y NO en un comentario', () => {
    expect(usesServiceRoleClient("const c = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)")).toBe(true)
    expect(usesServiceRoleClient("// migrado: antes createClient(url, SERVICE_ROLE), ahora getAdminDb()")).toBe(false)
    expect(usesServiceRoleClient("/* createClient(url, service_role) */ const db = getAdminDb()")).toBe(false)
    expect(usesServiceRoleClient("const c = createClient(url, ANON_KEY) // sin service role")).toBe(false)
  })
})
