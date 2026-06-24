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
//   C1#18: components/ArticleModal.tsx (3 .from → reusa GET onboarding/status + POST /api/feedback existente -doble insert-) → 80 / 25.
//   C1#19: app/Header.tsx (2 .from: user_streaks user-scoped + feedback_conversations admin → GET /api/v2/streak + GET /api/v2/admin/feedback/open-count requireAdmin) → 78 / 24.
//   C1#20: lib/notifications/motivationalAnalyzer.ts (2 .from tests → GET /api/v2/motivational/recent-tests; analyzer ya no recibe supabase) + borrado bloque dispute COMENTADO en useIntelligentNotifications → 77 / 24. (lib/ no cuenta en el ratchet; baja por el comentado.)
//   C1#21: hooks/useDailyQuestionLimit.ts (2 .rpc → GET status + POST increment) + lib/services/conversionTracker (1 .rpc track_conversion_event → POST /api/v2/conversion-event, firmas sin supabase; callers premium/UpgradeLimitModal actualizados) → RPC 17→15.
//   C1#22: components/MotivationalMessage.js (1 .rpc get_personalized_message + 2 .from user_message_interactions → GET /api/v2/motivational-message + POST .../interaction) → 75/23, RPC 15→14.
//   C1#23: components/UserProfileModal.js (3 .from CROSS-USER → GET /api/v2/user-public-profile con gate de privacidad: tests solo self/admin) + comentario .rpc deflactado → 72/22, RPC 14→13.
//   C1#24: hooks/useAdminNotifications.ts (3 .from admin: 2 embeds feedback + COUNT rate-limit → GET /api/v2/admin/pending-feedback-counts requireAdmin, lógica needsAttention portada) → 69/21.
//   C1#25: app/admin/conversiones/page.tsx (3 .from admin: impressions embed + 2 UPDATE upgrade_messages → GET impressions + POST update, requireAdmin) → 66/20.
//   C1#26: 2 ortografia (spelling_questions, server-component → Drizzle getAdminDb in-place) + teoria/[law] (user_profiles target_oposicion → reusa GET onboarding/status) → 63/17.
//   C1#27: app/soporte (UPDATE notification_logs por conversación → POST /api/v2/notifications/mark-conversation-read) → 62/16.
//   C1#28: components/test/TestHubPage.tsx (topics, server-component → Drizzle in-place) + app/test-personalizado (3 .from content_sections/scope/articles → GET /api/v2/content-scope-config consolidado) → 58/14.
//   C1#29: SharePrompt (.rpc get_user_share_stats → GET /api/v2/share-stats) + premium-edu (.rpc create_google_ads_user → reusa ensure-profile) + admin/configuracion (.from email_logs → GET /api/v2/admin/email-logs) → from 57/13, rpc 13→11.
//   C1#30: components/TestLayout.tsx (.from test_questions dedup de guardado → GET /api/v2/test-questions/saved-orders, JOIN tests user_id del token) → 56/12.
//   C1#31: components/UpgradeLimitModal.tsx (4 .rpc A/B: get_random_upgrade_message + track shown/click/dismiss → GET /api/v2/upgrade-message + POST .../track; quita prop supabase de 4 renderers) → RPC 11→7.
//   C1#32: app/admin/notificaciones/overview/page.js (4 .from: notification_events/email_events/user_notification_metrics/user_profiles → GET /api/v2/admin/notification-overview requireAdmin, enrich server-side, agregación queda en cliente) → 52/11.
//   C1#33: app/admin/notificaciones/events/page.js (2 .from embed) + users/page.js (6 .from: lista+detalle) → GET /api/v2/admin/notification-events + notification-users + notification-user-events (requireAdmin; counts vía GROUP BY) → 44/9.
//   C1#34: app/admin/newsletters/page.tsx (1 .from user_profiles, createClient propio → POST /api/v2/admin/newsletters/resolve-users requireAdmin) → 43/8.
//   C1#35: app/admin/feedback/page.tsx (13 .from → 7 endpoints nuevos requireAdmin: feedbacks-list/messages/waiting-conversations/user-conversations/conversation-feedback-id/update-feedback/start-conversation + reuso mark-viewed/close). Fix: start-conversation usaba columnas inexistentes admin_id/started_by_admin → admin_user_id. supabase queda solo para Realtime + helper respondViaFeedbackEndpoint (no .from). → 30/7.
//   C1#36: app/admin/fraudes/page.tsx (14 .from → 5 endpoints requireAdmin /api/v2/admin/fraud/{premium,multi,bots,scripts,blocked}, lógica de detección portada verbatim). Fix: bots usaba test_questions.answered_at inexistente → created_at. → 16/6.
//   C1#37: hooks/useIntelligentNotifications.ts (8 .from NO-canary: achievements→reusa recent-tests, study-reminders dead-delete, system→notifications/system, avatar×2→avatar/rotation, avatar mark-read→avatar/rotation/mark-read, dispute→/api/dispute/mark-read, system mark-read→notifications/mark-read). Quedan 2 .from + 1 rpc en loadProblematicArticles (BLOQUEADO por canary FASE 4/5). → 8/6.
const BASELINE_SITES = 8
const BASELINE_FILES = 6
// Trinquete .rpc( de cliente (17 al añadirlo; -2 useDailyQuestionLimit; -1 MotivationalMessage;
// -1 comentario UserProfileModal; -1 SharePrompt; -1 premium-edu; -4 UpgradeLimitModal → 7).
const BASELINE_RPC = 7

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
