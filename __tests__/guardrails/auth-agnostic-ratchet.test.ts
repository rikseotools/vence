import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// GUARDRAIL anti-regresión (Fase A, docs/roadmap/auth-agnostico-jwks-y-rls.md).
// Blinda el trabajo A1+A3: el cliente debe usar el puerto `lib/auth` (no
// `supabase.auth.*` directo) y el admin-check va por allowlist de email (no la
// RPC is_*_admin / auth.uid(), no portable a RDS/Neon). Este test falla si
// alguien (incluida otra sesión) reintroduce el acoplamiento. Es un RATCHET:
// la allowlist solo debe ENCOGER (al cerrar el funnel C2 y la Fase B), nunca crecer.

const ROOT = join(__dirname, '..', '..')
const SCAN_DIRS = ['app', 'components', 'contexts', 'hooks', 'lib', 'utils']
const EXT = /\.(ts|tsx|js)$/
const SKIP = /node_modules|\.next|\.open-next|\.backup|backup-/

function walk(rel: string): string[] {
  let out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(join(ROOT, rel))
  } catch {
    return []
  }
  for (const e of entries) {
    const childRel = `${rel}/${e}`
    if (SKIP.test(childRel)) continue
    const st = statSync(join(ROOT, childRel))
    if (st.isDirectory()) out = out.concat(walk(childRel))
    else if (EXT.test(e)) out.push(childRel)
  }
  return out
}

const ALL_FILES = SCAN_DIRS.flatMap(walk)
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

// Ficheros que LEGÍTIMAMENTE referencian supabase.auth.* (a fecha 2026-06-20):
// infra del puerto / verificación server-side, comentarios, y el funnel de
// login C2 (signInWithOAuth) + callback, ambos diferidos a Fase B/C2.
// Esta lista solo debe ENCOGER. Si aparece un fichero nuevo aquí, el test falla
// → o lo migras al puerto, o (si es legítimo) lo añades conscientemente.
const AUTH_ALLOWLIST = new Set<string>([
  'lib/api/auth/verifyAuth.ts',
  'lib/api/auth/verifyJwtLocal.ts',
  'lib/security/adminApiGuard.ts',
  'lib/api/admin-delete-user/queries.ts',
  'lib/api/authHeaders.ts',
  'app/api/send-support-email/route.ts',
  // Funnel de login C2 (diferido) + callback (Fase B):
  'app/login/page.js',
  'app/landing/premium-ads-1/page.js',
  'app/landing/premium-ads-2/page.js',
  'app/landing/premium-edu/page.js',
  'app/premium/page.tsx',
  'app/auth/callback/page.tsx',
])

describe('GUARDRAIL: auth de cliente agnóstico (Fase A)', () => {
  it('ningún fichero NUEVO usa supabase.auth.* fuera de la allowlist', () => {
    const offenders = ALL_FILES.filter(
      (f) => /supabase\.auth\./.test(read(f)) && !AUTH_ALLOWLIST.has(f),
    )
    expect(offenders).toEqual([])
  })

  it('la allowlist no tiene entradas obsoletas (solo debe encoger)', () => {
    const stale = [...AUTH_ALLOWLIST].filter(
      (f) => !ALL_FILES.includes(f) || !/supabase\.auth\./.test(read(f)),
    )
    expect(stale).toEqual([])
  })

  it('NO quedan llamadas .rpc("is_current_user_admin"/"is_user_admin") (auth.uid no portable)', () => {
    const re = /\.rpc\(\s*['"]is_(?:current_user_admin|user_admin)['"]/
    const offenders = ALL_FILES.filter((f) => re.test(read(f)))
    expect(offenders).toEqual([])
  })

  it('el puerto agnóstico lib/auth existe y exporta `auth`', () => {
    expect(read('lib/auth/client.ts')).toMatch(/export const auth/)
  })
})
