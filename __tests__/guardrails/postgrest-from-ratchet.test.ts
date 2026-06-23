import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// RATCHET Fase C1 (docs/roadmap/auth-agnostico-jwks-y-rls.md / desacople-postgrest-rls.md).
// Cuenta los `supabase.from('tabla')` (PostgREST) en código de CLIENTE
// (app excl. /api, components, contexts, hooks). PostgREST no existe en RDS/Neon,
// así que esto debe llegar a 0. Este test es un trinquete: el recuento SOLO puede
// BAJAR. Si sube (alguien añade un .from de cliente nuevo), falla. Al migrar cada
// uno a un endpoint Drizzle, se baja el BASELINE.
//
// Nota: Drizzle usa `.from(tabla)` con un OBJETO (sin comillas) → no lo cuenta;
// el patrón `.from('` / `.from("` captura solo las llamadas PostgREST con nombre
// de tabla string.
//
// Se trinquetea TAMBIÉN `supabase.rpc(` de cliente: las funciones plpgsql siguen
// existiendo en RDS/Neon, pero el transporte PostgREST `.rpc()` no → hay que
// llamarlas vía endpoint Drizzle (getAdminDb().execute(sql`SELECT fn(...)`)).
// Mismo trinquete: el recuento de `.rpc(` SOLO puede BAJAR.

const ROOT = join(__dirname, '..', '..')
const SCAN_DIRS = ['app', 'components', 'contexts', 'hooks']
const EXT = /\.(ts|tsx|js)$/
const SKIP = /node_modules|\.next|\.open-next|\.backup|backup-|__tests__|\/api\/|\.test\./
const FROM = /\.from\(['"]/g
const RPC = /\.rpc\(/g

// Baseline: SOLO bajar al migrar a endpoints/Drizzle.
//   2026-06-20: 128 sitios / 43 ficheros (inicial).
//   C1#1: app/oposiciones/page.tsx (oposiciones, server→Drizzle) → 127 / 42.
//   C1#2: app/oposiciones/[filtro]/page.tsx (2 queries oposiciones) → 125 / 41.
//   C1#3: app/cursos/[slug]/page.tsx (3 queries video_courses/lessons) → 122 / 40.
//   C1#4: app/page.tsx (5 queries; getTopLaws N+1→1 JOIN; oposiciones) → 117 / 39.
//   C1#5: components/QuestionEvolution.tsx (test_questions, user-scoped→endpoint) → 116 / 38.
//   C1#6: components/PsychometricQuestionEvolution.tsx (psychometric_test_answers) → 115 / 37.
//   C1#7: hooks/useDailyGoal.ts (4 COUNT test_questions/psychometric → endpoint) → 111 / 36.
//   C1#8: contexts/OposicionContext.tsx (2 SELECT user_profiles target → endpoint) → 109 / 35.
//   C1#9: hooks/useNewMedalsBadge.ts (SELECT+UPDATE user_medals → endpoint GET/POST) → 107 / 34.
//   C1#10: app/pregunta/[id]/page.tsx (INSERT shared_question_responses → endpoint auth-opcional) → 106 / 33.
//   C1#11: hooks/useTestCompletion.ts (handleTestCompletion DEAD CODE borrado; INSERT tests no portable) → 105 / 32.
//   C1#12: hooks/useOnboarding.ts (4 .from user_profiles → GET status + POST skip atómico; complete UPDATE redundante eliminado) → 101 / 31.
//   C1#13: app/perfil/page.tsx (4 .from → GET/POST account/deletion-request idempotente + createInitialProfile delega en ensure-profile) → 97 / 30.
//   C1#14: components/OnboardingModal.tsx (2 .from user_profiles + 2 .rpc custom-oposiciones → status/save-field + custom-oposiciones GET/POST) → from 95/29, rpc 19→17.
//   C1#15: hooks/useDisputeNotifications.ts (5 .from question_disputes/psychometric → GET notifications + POST mark-all-read + POST appeal) → 90 / 28.
//   C1#16: components/OposicionDetector.tsx (4 .from user_profiles → reusa GET status + POST oposicion/assign UPSERT-as-UPDATE) → 86 / 27.
//   C1#17: components/AvatarChanger.tsx (3 .from public_user_profiles update/upsert → POST avatar/public-profile UPDATE-only) → 83 / 26.
const BASELINE_SITES = 83
const BASELINE_FILES = 26
// Trinquete .rpc( de cliente (baseline al añadirlo: 17, tras migrar los 2 de OnboardingModal).
const BASELINE_RPC = 17

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

describe('RATCHET: PostgREST (supabase.from / supabase.rpc) de cliente solo puede decrecer', () => {
  const files = SCAN_DIRS.flatMap(walk)
  let sites = 0
  let withFrom = 0
  let rpcSites = 0
  for (const f of files) {
    const txt = readFileSync(join(ROOT, f), 'utf8')
    const m = txt.match(FROM)
    if (m && m.length > 0) {
      sites += m.length
      withFrom += 1
    }
    const r = txt.match(RPC)
    if (r && r.length > 0) rpcSites += r.length
  }

  it(`nº de sitios .from('…') de cliente no supera el baseline (${BASELINE_SITES})`, () => {
    expect(sites).toBeLessThanOrEqual(BASELINE_SITES)
  })

  it(`nº de ficheros con .from('…') de cliente no supera el baseline (${BASELINE_FILES})`, () => {
    expect(withFrom).toBeLessThanOrEqual(BASELINE_FILES)
  })

  it(`nº de sitios .rpc(…) de cliente no supera el baseline (${BASELINE_RPC})`, () => {
    expect(rpcSites).toBeLessThanOrEqual(BASELINE_RPC)
  })
})
