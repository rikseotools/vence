import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// ============================================================================
// GUARDRAIL C2 (docs/roadmap/auth-agnostico-jwks-y-rls.md) — AUTORIZACIÓN EN APP
// ============================================================================
// Reemplaza a RLS: toda query Drizzle (getAdminDb/getDb → sql``) contra una tabla
// USER-SCOPED debe acotarse al usuario del TOKEN (verifyAuth → ${auth.userId}/etc.)
// o ser un endpoint admin (requireAdmin, que legítimamente lee cross-user).
//
// Como getAdminDb() BYPASSEA RLS (service-role), olvidar `WHERE user_id` = FUGA
// cross-user. Este test escanea cada bloque sql`` y falla si toca una tabla
// user-scoped sin acotar al token ni ser admin. Defensa estática; la conductual
// es C3 (tests de aislamiento).
//
// La allowlist de excepciones solo debe ENCOGER. Añadir una entrada exige razón.

const ROOT = join(__dirname, '..', '..')
const SCAN_DIRS = ['app/api', 'lib']
const EXT = /\.(ts|tsx|js)$/
const SKIP = /node_modules|\.next|\.open-next|\.backup|backup-|__tests__|\.test\./

// Las 43 tablas con pgPolicy(auth.uid()) en db/schema.ts (fila = de un usuario).
const USER_SCOPED_TABLES = new Set([
  'conversion_events', 'user_profiles', 'user_progress', 'user_recommendations',
  'test_configurations', 'user_roles', 'test_questions', 'user_test_sessions',
  'user_learning_analytics', 'user_sessions', 'user_subscriptions', 'email_preferences',
  'user_difficulty_metrics', 'pwa_sessions', 'pwa_events', 'user_streaks',
  'user_notification_settings', 'user_medals', 'user_notification_metrics', 'custom_oposiciones',
  'email_events', 'notification_events', 'user_psychometric_preferences', 'tests',
  'psychometric_test_sessions', 'psychometric_test_answers', 'spelling_test_sessions',
  'spelling_test_answers', 'user_theme_performance_cache', 'psychometric_user_question_history',
  'user_message_interactions', 'share_events', 'daily_question_usage', 'fraud_watch_list',
  'fraud_confirmations', 'psychometric_question_disputes', 'user_interactions',
  'user_avatar_settings', 'plan_type_audit_log', 'psychometric_first_attempts',
  'law_question_first_attempts', 'user_acquisition', 'user_oposiciones_seguidas',
])

// Identificadores que representan el id verificado del TOKEN. Además de los
// canónicos, se resuelven los alias locales (const uid = auth.userId).
const BASE_TOKEN_REFS = ['auth.userId', 'auth.user.id', 'userId', 'user.id', 'tokenUserId', 'authUserId']

// Devuelve el set de identificadores del token para un fichero (canónicos + alias).
function tokenRefsForFile(src: string): string[] {
  const refs = new Set(BASE_TOKEN_REFS)
  const aliasRe = /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*auth\.(?:userId|user\.id)\b/g
  let m: RegExpExecArray | null
  while ((m = aliasRe.exec(src))) refs.add(m[1])
  return [...refs]
}

// ¿El bloque sql`` interpola alguno de los identificadores del token?
function blockScopedByToken(block: string, tokenRefs: string[]): boolean {
  return tokenRefs.some((ref) => {
    const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\$\\{\\s*${escaped}\\b`).test(block)
  })
}

// ----------------------------------------------------------------------------
// ALLOWLIST de excepciones revisadas (solo debe ENCOGER). Formato: ruta relativa.
// Cada entrada documenta POR QUÉ ese fichero toca una tabla user-scoped sin
// acotar por token ni requireAdmin.
// ----------------------------------------------------------------------------
const ALLOWLIST: Record<string, string> = {
  // Cron de integridad: escanea TODOS los exámenes para detectar anomalías; no hay
  // contexto de usuario (no es un endpoint user-facing).
  'app/api/cron/check-exam-integrity/route.ts': 'cron sin contexto de usuario (escanea todos los exámenes)',
  // Verifica ownership en JS (test.userId === auth.userId) ANTES de consultar
  // test_questions por testId. El scoping es por código, no detectable per-block.
  'app/api/v2/official-exams/complete/route.ts': 'verifica test.userId === token antes de query por testId',
  // CROSS-USER deliberado con gate que replica RLS (#19): perfil/avatar públicos;
  // tests SOLO si viewer===target o admin. Scoped por ${userId} (target), no token.
  'app/api/v2/user-public-profile/route.ts': 'gate de privacidad replica RLS (#19): tests solo self/admin',
  // Módulos de AGREGACIÓN admin: invocados desde rutas requireAdmin; agregan
  // cross-user por diseño (dashboards). El requireAdmin vive en la ruta, no aquí.
  'lib/api/admin-charts/queries.ts': 'agregación admin (ruta requireAdmin)',
  'lib/api/admin-conversion-stats/queries.ts': 'agregación admin (ruta requireAdmin)',
  'lib/api/admin-dashboard/queries.ts': 'agregación admin (ruta requireAdmin)',
  'lib/api/admin-engagement-stats/queries.ts': 'agregación admin (ruta requireAdmin)',
  // Ranking de medallas: GROUP BY user_id (leaderboard agregado), no expone filas
  // de un usuario a otro.
  'lib/api/medals/queries.ts': 'ranking agregado GROUP BY user_id (medallas)',
  // Scoped por el userId param que la ruta deriva del token (verifyAuth) antes de
  // llamar a estas funciones.
  'lib/api/official-exams/queries.ts': 'scoped por userId param derivado del token en la ruta',
  // Servicio de email server-side: acota por el userId del DESTINATARIO (no hay token).
  'lib/emails/emailService.server.ts': 'email server-side, acota por userId del destinatario',
}

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

// Extrae los cuerpos de cada template literal sql`...` (los bloques SQL no
// contienen backticks literales, así que cerramos en el siguiente backtick).
function extractSqlBlocks(src: string): string[] {
  const blocks: string[] = []
  const re = /\bsql`/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length
    const end = src.indexOf('`', start)
    if (end === -1) break
    blocks.push(src.slice(start, end))
    re.lastIndex = end + 1
  }
  return blocks
}

// Tablas user-scoped referenciadas tras FROM/JOIN/UPDATE/INTO en el bloque.
function userScopedTablesIn(block: string): string[] {
  const found = new Set<string>()
  const re = /\b(?:from|join|update|into)\s+([a-z_][a-z0-9_]*)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(block))) {
    const tbl = m[1].toLowerCase()
    if (USER_SCOPED_TABLES.has(tbl)) found.add(tbl)
  }
  return [...found]
}

const ALL_FILES = SCAN_DIRS.flatMap(walk)
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

describe('Guardrail C2 — toda query a tabla user-scoped se acota al token (o es admin)', () => {
  const violations: string[] = []
  const allowlistUsed = new Set<string>()

  for (const file of ALL_FILES) {
    const src = read(file)
    if (!src.includes('sql`')) continue

    const isAdmin = /requireAdmin\b/.test(src)
    const tokenRefs = tokenRefsForFile(src)
    const blocks = extractSqlBlocks(src)

    for (const block of blocks) {
      const tables = userScopedTablesIn(block)
      if (tables.length === 0) continue

      if (blockScopedByToken(block, tokenRefs)) continue
      if (isAdmin) continue
      if (ALLOWLIST[file]) { allowlistUsed.add(file); continue }

      violations.push(`${file} → bloque sql\`\` toca [${tables.join(', ')}] sin acotar al token ni requireAdmin`)
    }
  }

  it('no hay queries user-scoped sin acotar al usuario del token', () => {
    if (violations.length > 0) {
      throw new Error(
        `❌ C2: ${violations.length} query(s) a tablas user-scoped sin scoping por token (posible fuga cross-user):\n` +
        violations.map(v => `  • ${v}`).join('\n') +
        `\n\nArregla añadiendo \`WHERE user_id = \${auth.userId}::uuid\` (o requireAdmin si es admin), ` +
        `o añade el fichero a ALLOWLIST con una razón si es una excepción legítima.`
      )
    }
  })

  it('la allowlist no tiene entradas muertas (solo debe encoger)', () => {
    const dead = Object.keys(ALLOWLIST).filter(f => !allowlistUsed.has(f))
    expect(dead).toEqual([])
  })
})

// Self-test: el guardrail DEBE tener dientes (detectar lo que dice detectar).
describe('Guardrail C2 — meta: la detección funciona', () => {
  const refs = tokenRefsForFile('const uid = auth.userId')

  it('detecta tabla user-scoped en el bloque', () => {
    expect(userScopedTablesIn('SELECT * FROM tests t JOIN articles a ON ...')).toEqual(['tests'])
    expect(userScopedTablesIn('SELECT * FROM articles')).toEqual([]) // pública → no
  })

  it('marca como FUGA un bloque user-scoped sin token', () => {
    const block = 'SELECT * FROM psychometric_test_answers WHERE test_session_id = ${sid}'
    expect(blockScopedByToken(block, refs)).toBe(false)
  })

  it('ACEPTA un bloque acotado por el token (directo o alias)', () => {
    expect(blockScopedByToken('SELECT * FROM tests WHERE user_id = ${auth.userId}::uuid', refs)).toBe(true)
    expect(blockScopedByToken('UPDATE user_profiles SET x=1 WHERE id = ${uid}::uuid', refs)).toBe(true)
  })

  it('resuelve alias locales de auth.userId', () => {
    expect(tokenRefsForFile('const uid = auth.userId')).toContain('uid')
    expect(tokenRefsForFile('let myId = auth.user.id')).toContain('myId')
  })
})
