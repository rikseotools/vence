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
// El LÍMITE de seguridad es la RUTA (app/api/**): es donde se autentica. Los
// módulos lib/ son implementación invocada por rutas (reciben userId por param,
// nunca autentican) → no son el boundary y no se escanean aquí.
const SCAN_DIRS = ['app/api']
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

// Identificadores que representan INEQUÍVOCAMENTE el id del TOKEN. OJO: `userId`
// y `user.id` A SECAS NO van aquí — en endpoints públicos `userId` suele venir del
// query param (ese fue el agujero de theme-stats: público + ?userId=... → fuga
// cross-user, y C2 lo dejaba pasar tratándolo como token). Solo nombres que
// nombran el auth + alias resueltos (const uid = auth.userId).
const BASE_TOKEN_REFS = ['auth.userId', 'auth.user.id', 'tokenUserId', 'authUserId']

function tokenRefsForFile(src: string): string[] {
  const refs = new Set(BASE_TOKEN_REFS)
  // alias: const/let X = auth.userId | auth.user.id
  const aliasRe = /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*auth\.(?:userId|user\.id)\b/g
  // destructuring: const { userId } = auth | const { userId } = await verifyAuth(...)
  const destrRe = /(?:const|let|var)\s*\{[^}]*\buserId\b[^}]*\}\s*=\s*(?:await\s+)?(?:auth\b|verifyAuth)/g
  let m: RegExpExecArray | null
  while ((m = aliasRe.exec(src))) refs.add(m[1])
  if (destrRe.test(src)) refs.add('userId')
  return [...refs]
}

// ¿El fichero AUTENTICA? (deriva el id del token vía verifyAuth). Si lo hace,
// confiamos en que acota correctamente (la prueba conductual por-endpoint es C3);
// un endpoint que NO autentica y toca una tabla user-scoped es el agujero a cazar.
//
// `getAuthenticatedUser` cuenta IGUAL, y no es una concesión: es una envoltura FINA de
// `verifyAuth` (`lib/api/shared/auth.ts:61` — llama a verifyAuth y devuelve 401 si falla), con 27
// llamantes. Sin reconocerla, el detector señala como «endpoint público» rutas que sí autentican
// —pasó el 01/08 con `/api/profile/target`— y un guardarraíl que da falsos positivos acaba en la
// lista de excepciones, que es donde deja de proteger. Se comprueba abajo que sigue siendo
// envoltura: si alguien la desacopla de verifyAuth, este test se pone rojo.
function fileAuthenticates(src: string): boolean {
  return /\b(?:verifyAuth|getAuthenticatedUser)\s*\(/.test(src)
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
// Solo RUTAS que tocan tablas user-scoped SIN verifyAuth ni requireAdmin y que son
// excepciones legítimas (no user-facing). Se rellena tras el primer triaje.
const ALLOWLIST: Record<string, string> = {
  // Cron de integridad: escanea TODOS los exámenes para detectar anomalías; no hay
  // contexto de usuario (no es un endpoint user-facing, lo dispara el scheduler).
  'app/api/cron/check-exam-integrity/route.ts': 'cron sin contexto de usuario (escanea todos los exámenes)',
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
    const authenticates = fileAuthenticates(src)
    const tokenRefs = tokenRefsForFile(src)
    const blocks = extractSqlBlocks(src)

    for (const block of blocks) {
      const tables = userScopedTablesIn(block)
      if (tables.length === 0) continue

      // OK si: el fichero autentica (verifyAuth → deriva id del token; el scoping
      // por-query lo verifica C3), o es admin (lee cross-user), o el bloque interpola
      // un id inequívoco del token, o es una excepción revisada.
      if (authenticates) continue
      if (isAdmin) continue
      if (blockScopedByToken(block, tokenRefs)) continue
      if (ALLOWLIST[file]) { allowlistUsed.add(file); continue }

      violations.push(`${file} → bloque sql\`\` toca [${tables.join(', ')}] SIN verifyAuth/requireAdmin (posible endpoint público con fuga cross-user)`)
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

  it('NO trata `userId` a secas como token (era el agujero de theme-stats)', () => {
    // userId puede venir del query param → NO debe contar como id del token.
    expect(blockScopedByToken('WHERE user_id = ${userId}', tokenRefsForFile('const userId = req.query.userId'))).toBe(false)
  })

  it('resuelve alias locales de auth.userId y destructuring de verifyAuth', () => {
    expect(tokenRefsForFile('const uid = auth.userId')).toContain('uid')
    expect(tokenRefsForFile('let myId = auth.user.id')).toContain('myId')
    expect(tokenRefsForFile('const { userId } = await verifyAuth(req)')).toContain('userId')
  })

  it('fileAuthenticates detecta verifyAuth (y su ausencia)', () => {
    expect(fileAuthenticates('const auth = await verifyAuth(request, "/x")')).toBe(true)
    expect(fileAuthenticates('const userId = searchParams.get("userId")')).toBe(false)
  })
})

/**
 * El detector acepta `getAuthenticatedUser` como autenticación. Esto lo mantiene honesto.
 *
 * Vale porque es una ENVOLTURA de `verifyAuth`. El día que alguien la desacople —y siga
 * llamándose igual— el detector estaría dando por autenticadas rutas que ya no lo están, en
 * silencio y en el sitio donde más caro sale. Aquí se comprueba que la envoltura sigue siéndolo.
 */
describe('la equivalencia en la que se apoya el detector', () => {
  it('`getAuthenticatedUser` sigue llamando a `verifyAuth`', () => {
    const src = readFileSync(join(process.cwd(), 'lib/api/shared/auth.ts'), 'utf8')
    const i = src.indexOf('export async function getAuthenticatedUser')
    expect(i).toBeGreaterThan(-1)
    // Dentro de su cuerpo (no en cualquier punto del fichero, que tiene más funciones).
    expect(src.slice(i, i + 400)).toMatch(/\bverifyAuth\s*\(/)
  })

  it('…y rechaza si la autenticación falla (no sigue adelante sin usuario)', () => {
    const src = readFileSync(join(process.cwd(), 'lib/api/shared/auth.ts'), 'utf8')
    const i = src.indexOf('export async function getAuthenticatedUser')
    expect(src.slice(i, i + 400)).toMatch(/if\s*\(\s*!auth\.success\s*\)/)
  })
})

// ============================================================================
// GUARDRAIL C2-BUILDER — la MISMA regla, pero mirando el query builder de Drizzle
// ============================================================================
// El escáner de arriba solo mira bloques `sql``` . Este repo, sin embargo, consulta sobre
// todo con el QUERY BUILDER (`db.select().from(tests)`, `db.insert(tests)`), que era una
// zona ciega COMPLETA: ninguna de esas consultas pasaba por ninguna comprobación.
//
// Lo que costó descubrirlo (T-482, 05/08/2026): tres endpoints del REPASO llevaban ahí
// desde que se escribieron.
//   · `GET /api/tests/[testId]/review` devolvía 200 SIN sesión con el examen de cualquiera
//     —enunciados, sus respuestas, sus tiempos— a quien tuviera el UUID, que viaja en la
//     URL del navegador.
//   · `GET /api/psychometric/review`, su gemelo, igual.
//   · `POST /api/tests/recover` ESCRIBÍA con el `userId` del cuerpo y sin token.
// Los tres tocan tablas que ya estaban en `USER_SCOPED_TABLES` (`tests`, `test_questions`,
// `psychometric_test_sessions`). El guardarraíl tenía la tabla en la lista y no los vio: no
// le faltaba criterio, le faltaba MIRAR donde se consulta de verdad.
//
// Se comprueba también un nivel de DELEGACIÓN (`route.ts` → `lib/api/<x>/queries.ts`),
// porque dos de los tres no consultaban en la ruta sino en su módulo de dominio — el
// límite de seguridad sigue siendo la ruta, que es donde se autentica.
//
// ## Por qué es un TRINQUETE y no una prohibición
//
// Al estrenarlo, 76 rutas caen en esta zona. Muchas son legítimas (un webhook con firma, un
// pixel de tracking, un cron), pero NINGUNA está triada. Ponerlas todas en rojo acabaría en
// una allowlist de 76 entradas, que es donde los guardarraíles dejan de proteger. Así que la
// lista se congela: **no puede aparecer una ruta nueva** —que es lo que impide un cuarto
// `/review`— y solo puede ENCOGER según se trien (ficha [T-565]).
//
// Mismo patrón que `TECHO_CRUDOS` en `llmInstrumentation.guardrail`.

// Export de Drizzle → nombre de tabla, leído de db/schema.ts (no una copia a mano).
function exportsUserScoped(): Map<string, string> {
  const schema = readFileSync(join(ROOT, 'db/schema.ts'), 'utf8')
  const out = new Map<string, string>()
  const re = /export const (\w+)\s*=\s*pgTable\(\s*["'`]([a-z0-9_]+)["'`]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(schema))) {
    if (USER_SCOPED_TABLES.has(m[2])) out.set(m[1], m[2])
  }
  return out
}

const EXPORT_A_TABLA = exportsUserScoped()

/** Tablas user-scoped tocadas con el builder: .from(X) / .insert(X) / .update(X) / .delete(X) */
function tablasPorBuilder(src: string): string[] {
  const found = new Set<string>()
  const re = /\.(?:from|insert|update|delete)\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const t = EXPORT_A_TABLA.get(m[1])
    if (t) found.add(t)
  }
  return [...found]
}

// `requireUsuarioPropio` cuenta como autenticar: envuelve a `verifyAuth` y además contrasta
// el id que afirma el cliente. Se comprueba abajo que sigue siendo esa envoltura.
function rutaAutentica(src: string): boolean {
  return /\b(?:verifyAuth|getAuthenticatedUser|requireUsuarioPropio|requireAdmin)\s*\(/.test(src)
}

// ----------------------------------------------------------------------------
// LÍNEA BASE CONGELADA (05/08/2026). Solo puede ENCOGER.
// Si al triar una ruta la haces autenticar, BÓRRALA de aquí: el test avisa de las muertas.
// ----------------------------------------------------------------------------
const ZONA_CIEGA_PENDIENTE: string[] = [
  'app/api/admin/ai-chat-logs/route.ts',
  'app/api/admin/feedback/status/route.ts',
  'app/api/admin/funnel-users/route.ts',
  'app/api/admin/graduated-limits/route.ts',
  'app/api/admin/newsletters/audience/route.ts',
  'app/api/admin/newsletters/history/route.ts',
  'app/api/admin/newsletters/preview/route.ts',
  'app/api/admin/newsletters/send/route.ts',
  'app/api/admin/newsletters/template-stats/route.ts',
  'app/api/admin/newsletters/users/route.ts',
  'app/api/admin/oposiciones-migrate/route.ts',
  'app/api/admin/oposiciones-stats/route.ts',
  'app/api/admin/pending-counts/route.ts',
  'app/api/admin/sales-prediction/route.ts',
  'app/api/admin/users-count/route.ts',
  'app/api/ai/chat-v2/route.ts',
  'app/api/answer/psychometric/route.ts',
  'app/api/answer/spelling/route.ts',
  'app/api/auth/store-registration-ip/route.ts',
  'app/api/auth/track-session-ip/route.ts',
  'app/api/cron/daily-registration-summary/route.js',
  'app/api/cron/renewal-reminders/route.ts',
  'app/api/cursos/[slug]/route.ts',
  'app/api/cursos/route.ts',
  'app/api/email-tracking/click/route.ts',
  'app/api/email-tracking/open/route.ts',
  'app/api/email/track-click/route.ts',
  'app/api/email/track-open/route.ts',
  'app/api/emails/send-medal-congratulation/route.ts',
  'app/api/exam/answer/route.ts',
  'app/api/exam/complete/route.js',
  'app/api/exam/discard/route.ts',
  'app/api/exam/pending/route.js',
  'app/api/exam/progress/route.js',
  'app/api/exam/resume/route.ts',
  'app/api/exam/validate/route.ts',
  'app/api/interactions/route.ts',
  'app/api/profile/avatar-settings/route.ts',
  'app/api/profile/email-preferences/route.ts',
  'app/api/psychometric-test-data/questions/route.ts',
  'app/api/psychometric-test-data/route.ts',
  'app/api/psychometric/complete/route.ts',
  'app/api/psychometric/completed-sessions/route.ts',
  'app/api/psychometric/create/route.ts',
  'app/api/psychometric/discard/route.ts',
  'app/api/psychometric/pending/route.ts',
  'app/api/psychometric/resume/route.ts',
  'app/api/questions/failed-by-topic/route.ts',
  'app/api/questions/filtered/route.ts',
  'app/api/questions/user-failed/route.ts',
  'app/api/random-test-data/check-availability/route.ts',
  'app/api/random-test-data/route.ts',
  'app/api/random-test-data/theme-details/route.ts',
  'app/api/random-test/availability/route.ts',
  'app/api/random-test/config/route.ts',
  'app/api/random-test/generate/route.ts',
  'app/api/random-test/user-stats/route.ts',
  'app/api/ranking/route.ts',
  'app/api/ranking/streaks/route.ts',
  'app/api/spelling/session/route.ts',
  'app/api/stats/route.ts',
  'app/api/stripe/webhook/route.ts',
  'app/api/teoria/[law]/[articleNumber]/test-count/route.ts',
  'app/api/teoria/search/route.ts',
  'app/api/topics/[numero]/route.ts',
  'app/api/user/question-history/route.ts',
  'app/api/v2/admin/conversion-stats/route.ts',
  'app/api/v2/admin/dashboard/route.ts',
  'app/api/v2/admin/unread-sales/route.ts',
  'app/api/v2/dispute/route.ts',
  'app/api/v2/official-exams/answer/route.ts',
  'app/api/v2/official-exams/questions/route.ts',
  'app/api/v2/official-exams/user-stats/route.ts',
  'app/api/v2/psychometric-stats/route.ts',
  'app/api/v2/user-stats/route.ts',
  'app/api/webhooks/resend-inbound/route.ts',
]

describe('Guardrail C2-builder — el query builder de Drizzle no es una zona franca', () => {
  const RUTAS = ALL_FILES.filter((f) => /route\.(ts|js)$/.test(f))
  const LIBS = walk('lib/api')
  const libSrc = new Map(LIBS.map((f) => [f, read(f)]))

  /** Tablas user-scoped que alcanza una ruta: las suyas + un nivel de delegación a lib/api. */
  function alcanceDe(ruta: string): string[] {
    const src = read(ruta)
    const tablas = new Set(tablasPorBuilder(src))
    const imp = /from\s+['"]([^'"]+)['"]/g
    let m: RegExpExecArray | null
    while ((m = imp.exec(src))) {
      const i = m[1].indexOf('lib/api/')
      if (i === -1) continue
      const sub = m[1].slice(i + 'lib/api/'.length).replace(/\/$/, '')
      if (!sub) continue
      for (const [lf, ls] of libSrc) {
        const base = lf.replace(/^lib\/api\//, '').replace(/\.ts$/, '').replace(/\/index$/, '')
        if (base === sub || base.startsWith(`${sub}/`)) tablasPorBuilder(ls).forEach((t) => tablas.add(t))
      }
    }
    return [...tablas]
  }

  const enZonaCiega = RUTAS.filter((r) => !rutaAutentica(read(r)) && alcanceDe(r).length > 0)

  it('el escaneo ve algo (si esto falla, el detector se ha quedado ciego)', () => {
    expect(RUTAS.length).toBeGreaterThan(300)
    expect(EXPORT_A_TABLA.size).toBeGreaterThan(30)
  })

  it('ninguna ruta NUEVA toca datos de usuario sin autenticar', () => {
    const nuevas = enZonaCiega.filter((r) => !ZONA_CIEGA_PENDIENTE.includes(r))
    if (nuevas.length > 0) {
      throw new Error(
        `❌ C2-builder: ${nuevas.length} ruta(s) consultan tablas user-scoped con el query ` +
        `builder SIN autenticar:\n` +
        nuevas.map((r) => `  • ${r} → [${alcanceDe(r).join(', ')}]`).join('\n') +
        `\n\nEsto es el agujero de T-482 otra vez: con el id del recurso, cualquiera lee (o ` +
        `escribe) los datos de otra persona.\nArréglalo con \`requireUsuarioPropio\` y ` +
        `comprobando el DUEÑO del recurso. Meterla en ZONA_CIEGA_PENDIENTE no es una opción: ` +
        `esa lista está congelada y solo encoge.`
      )
    }
  })

  it('la línea base solo encoge (no deja entradas muertas)', () => {
    const muertas = ZONA_CIEGA_PENDIENTE.filter((r) => !enZonaCiega.includes(r))
    expect(muertas).toEqual([])
  })

  it('los tres endpoints de T-482 ya NO están en la zona ciega', () => {
    // Trinquete explícito: si alguien revierte el arreglo, esto lo dice por su nombre.
    for (const r of [
      'app/api/tests/[testId]/review/route.ts',
      'app/api/psychometric/review/route.ts',
      'app/api/tests/recover/route.ts',
    ]) {
      expect(read(r)).toMatch(/requireUsuarioPropio\(/)
      expect(enZonaCiega).not.toContain(r)
    }
  })
})

describe('C2-builder — meta: la detección funciona', () => {
  it('reconoce el builder sobre una tabla user-scoped', () => {
    expect(tablasPorBuilder('await db.select().from(tests).where(x)')).toContain('tests')
    expect(tablasPorBuilder('await db.insert(testQuestions).values(v)')).toContain('test_questions')
  })

  it('NO marca tablas públicas', () => {
    expect(tablasPorBuilder('await db.select().from(questions)')).toEqual([])
    expect(tablasPorBuilder('await db.select().from(articles)')).toEqual([])
  })

  it('`requireUsuarioPropio` cuenta como autenticar, y sigue apoyándose en verifyAuth', () => {
    expect(rutaAutentica('const i = await requireUsuarioPropio(request, E)')).toBe(true)
    const src = readFileSync(join(ROOT, 'lib/api/shared/auth.ts'), 'utf8')
    const i = src.indexOf('export async function requireUsuarioPropio')
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i, i + 900)).toMatch(/\bverifyAuth\s*\(/)
  })

  it('una ruta sin autenticación NO se da por buena', () => {
    expect(rutaAutentica('const { testId } = await params')).toBe(false)
  })
})
