/**
 * GUARDARRAÍL — una ruta que AUTENTICA tiene que ser DINÁMICA.
 *
 * ## De dónde sale (T-482, 05/08/2026): una guarda desplegada que no protegía
 *
 * `/api/tests/[testId]/review` se cerró con `requireUsuarioPropio` y se desplegó. Medido
 * después CONTRA PRODUCCIÓN, con el arreglo ya vivo:
 *
 *   · `GET /api/tests/<uuid>/review`            → **200 con el examen entero**
 *   · `GET /api/tests/<uuid>/review?cb=12345`   → **401**
 *
 * No era CloudFront (`x-cache: Miss from cloudfront`: contestaba el origen). Era **Next
 * sirviendo el handler GET desde su propia caché**, así que la petición no llegaba nunca al
 * código que autentica. La guarda estaba puesta, desplegada… y era decorativa.
 *
 * Lo delató el CONTRASTE entre los dos gemelos en la misma prueba: `/api/psychometric/review`
 * daba 401 y su hermano 200. La única diferencia entre los dos ficheros era una línea:
 * `export const dynamic = 'force-dynamic'`.
 *
 * ## Por qué ninguna otra capa podía verlo
 *
 * El unit, la integración y el guardarraíl C2 estaban los tres EN VERDE — y con razón: los tres
 * invocan el handler directamente, y ahí la guarda sí corre. El defecto vive en la capa que
 * decide **si el handler llega a ejecutarse**, que solo existe en el servidor desplegado. Es el
 * argumento entero a favor de verificar en vivo: «pasa los tests» y «protege» no son lo mismo.
 *
 * ## Por qué TRINQUETE y no prohibición
 *
 * Al estrenarlo hay 100 rutas GET que autentican sin declararlo. No todas son explotables —que
 * Next cachee de verdad depende del handler— pero ninguna está comprobada, y la lista congelada
 * impide que aparezca una nueva. Poner 100 en rojo acabaría en una allowlist de 100, que es
 * donde los guardarraíles dejan de proteger.
 *
 * Solo se miran los **GET**: un POST no se cachea.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const SKIP = /node_modules|\.next|\.open-next|\.backup|backup-|__tests__|\.test\./

function rutas(rel: string): string[] {
  let out: string[] = []
  let entradas: string[]
  try { entradas = readdirSync(join(ROOT, rel)) } catch { return [] }
  for (const e of entradas) {
    const hijo = `${rel}/${e}`
    if (SKIP.test(hijo)) continue
    if (statSync(join(ROOT, hijo)).isDirectory()) out = out.concat(rutas(hijo))
    else if (/^route\.(ts|js)$/.test(e)) out.push(hijo)
  }
  return out
}

const AUTENTICA = /\b(?:verifyAuth|getAuthenticatedUser|requireUsuarioPropio|requireAdmin)\s*\(/
const DECLARA_DINAMICA = /export\s+const\s+(?:dynamic|revalidate)\s*=/
const TIENE_GET = /export\s+(?:const|async\s+function)\s+GET\b/

const leer = (p: string) => readFileSync(join(ROOT, p), 'utf8')

/** Rutas GET que autentican y NO declaran nada. CONGELADO el 05/08/2026: solo puede ENCOGER. */
const CACHEABLES_PENDIENTES: string[] = [
  'app/api/admin/ads/route.ts',
  'app/api/admin/ai-config/route.ts',
  'app/api/admin/ai-config/usage/route.ts',
  'app/api/admin/ai-traces/[logId]/route.ts',
  'app/api/admin/ai-traces/route.ts',
  'app/api/admin/competidores/changes-count/route.ts',
  'app/api/admin/competidores/oposicion/route.ts',
  'app/api/admin/competidores/review/route.ts',
  'app/api/admin/competidores/route.ts',
  'app/api/admin/competidores/search/route.ts',
  'app/api/admin/conversions/user-journey/route.ts',
  'app/api/admin/conversions/views/route.ts',
  'app/api/admin/email-events/route.ts',
  'app/api/admin/embajadores/[userId]/panel/route.ts',
  'app/api/admin/engagement-stats/route.ts',
  'app/api/admin/feedback/route.ts',
  'app/api/admin/infra-stats/route.ts',
  'app/api/admin/lifecycle/queue/route.ts',
  'app/api/admin/oep-signals/pending-count/route.ts',
  'app/api/admin/oep-signals/route.ts',
  'app/api/admin/oposiciones/rollover-pending/route.ts',
  'app/api/admin/referrals/payout-requests/route.ts',
  'app/api/admin/referrals/payouts/route.ts',
  'app/api/admin/referrals/payouts-pending-count/route.ts',
  'app/api/admin/referrals/stats/route.ts',
  'app/api/admin/rewards/accumulated/route.ts',
  'app/api/admin/rewards/route.ts',
  'app/api/admin/users/subscriptions/route.ts',
  'app/api/debug-unsubscribe/route.ts',
  'app/api/dispute/route.ts',
  'app/api/disputes/mine/route.ts',
  'app/api/exams/official-attempts/route.ts',
  'app/api/referrals/badge/route.ts',
  'app/api/referrals/me/route.ts',
  'app/api/sessions/check-active/route.ts',
  'app/api/soporte/messages/route.ts',
  'app/api/soporte/route.ts',
  'app/api/test/save-answer/route.ts',
  'app/api/v2/account/deletion-request/route.ts',
  'app/api/v2/admin/disputes/route.ts',
  'app/api/v2/admin/email-logs/route.ts',
  'app/api/v2/admin/feedback/conversation-feedback-id/route.ts',
  'app/api/v2/admin/feedback/feedbacks-list/route.ts',
  'app/api/v2/admin/feedback/list/route.ts',
  'app/api/v2/admin/feedback/messages/route.ts',
  'app/api/v2/admin/feedback/open-count/route.ts',
  'app/api/v2/admin/feedback/user-conversations/route.ts',
  'app/api/v2/admin/feedback/waiting-conversations/route.ts',
  'app/api/v2/admin/fraud/blocked/route.ts',
  'app/api/v2/admin/fraud/bots/route.ts',
  'app/api/v2/admin/fraud/multi/route.ts',
  'app/api/v2/admin/fraud/pending-count/route.ts',
  'app/api/v2/admin/fraud/premium/route.ts',
  'app/api/v2/admin/fraud/scripts/route.ts',
  'app/api/v2/admin/fraud/signals/route.ts',
  'app/api/v2/admin/notification-events/route.ts',
  'app/api/v2/admin/notification-overview/route.ts',
  'app/api/v2/admin/notification-user-events/route.ts',
  'app/api/v2/admin/notification-users/route.ts',
  'app/api/v2/admin/pending-feedback-counts/route.ts',
  'app/api/v2/admin/upgrade-messages/impressions/route.ts',
  'app/api/v2/answer-and-save/route.ts',
  'app/api/v2/avatar/rotation/route.ts',
  'app/api/v2/banner/open-inscriptions/route.ts',
  'app/api/v2/custom-oposiciones/popular/route.ts',
  'app/api/v2/daily-goal/status/route.ts',
  'app/api/v2/daily-question/status/route.ts',
  'app/api/v2/disputes/notifications/route.ts',
  'app/api/v2/laws/[lawId]/articles/[articleNumber]/route.ts',
  'app/api/v2/laws/[lawId]/articles/route.ts',
  'app/api/v2/laws/search/route.ts',
  'app/api/v2/medals/badge/route.ts',
  'app/api/v2/motivational/recent-tests/route.ts',
  'app/api/v2/motivational-message/route.ts',
  'app/api/v2/notifications/system/route.ts',
  'app/api/v2/official-exams/failed-questions/route.ts',
  'app/api/v2/official-exams/pending/route.ts',
  'app/api/v2/official-exams/resume/route.ts',
  'app/api/v2/official-exams/review/route.ts',
  'app/api/v2/onboarding/status/route.ts',
  'app/api/v2/oposicion/target/route.ts',
  'app/api/v2/oposicion-personalizada/[id]/route.ts',
  'app/api/v2/oposicion-personalizada/route.ts',
  'app/api/v2/oposiciones-compatibles/progress/route.ts',
  'app/api/v2/psychometric/difficulty/route.ts',
  'app/api/v2/psychometric/first-attempt/route.ts',
  'app/api/v2/psychometric/sessions/route.ts',
  'app/api/v2/psychometric/weak-areas/route.ts',
  'app/api/v2/psychometric-evolution/history/route.ts',
  'app/api/v2/question-evolution/history/route.ts',
  'app/api/v2/question-favorites/route.ts',
  'app/api/v2/share-stats/route.ts',
  'app/api/v2/streak/route.ts',
  'app/api/v2/studied-topics/route.ts',
  'app/api/v2/test-questions/saved-orders/route.ts',
  'app/api/v2/tests/route.ts',
  'app/api/v2/topic-progress/theme-stats/route.ts',
  'app/api/v2/topic-progress/weak-articles/route.ts',
  'app/api/v2/upgrade-message/route.ts',
  'app/api/v2/user-public-profile/route.ts',
]

const EN_RIESGO = rutas('app/api').filter((r) => {
  const src = leer(r)
  return AUTENTICA.test(src) && TIENE_GET.test(src) && !DECLARA_DINAMICA.test(src)
})

describe('una ruta que autentica no puede servirse de la caché', () => {
  it('el escaneo ve algo (si esto falla, el detector se ha quedado ciego)', () => {
    expect(rutas('app/api').length).toBeGreaterThan(300)
  })

  it('ninguna ruta NUEVA autentica sin declararse dinámica', () => {
    const nuevas = EN_RIESGO.filter((r) => !CACHEABLES_PENDIENTES.includes(r))
    if (nuevas.length > 0) {
      throw new Error(
        `❌ ${nuevas.length} ruta(s) GET autentican pero pueden servirse de la caché de Next:\n` +
        nuevas.map((r) => `  • ${r}`).join('\n') +
        `\n\nEs el defecto de T-482: la guarda está puesta y aun así el servidor contesta 200 ` +
        `sin ejecutarla.\nAñade \`export const dynamic = 'force-dynamic'\` (lo hacen ya 96 rutas). ` +
        `La lista CACHEABLES_PENDIENTES está congelada y solo encoge.`
      )
    }
  })

  it('la línea base solo encoge (sin entradas muertas)', () => {
    expect(CACHEABLES_PENDIENTES.filter((r) => !EN_RIESGO.includes(r))).toEqual([])
  })

  it('los endpoints del repaso de T-482 son dinámicos', () => {
    for (const r of ['app/api/tests/[testId]/review/route.ts', 'app/api/psychometric/review/route.ts']) {
      expect(leer(r)).toMatch(/export const dynamic = 'force-dynamic'/)
    }
  })
})

describe('meta: la detección funciona', () => {
  it('reconoce la declaración y su ausencia', () => {
    expect(DECLARA_DINAMICA.test("export const dynamic = 'force-dynamic'")).toBe(true)
    expect(DECLARA_DINAMICA.test('export const revalidate = 0')).toBe(true)
    expect(DECLARA_DINAMICA.test('const dynamic = 1')).toBe(false)
  })
  it('distingue GET de POST (un POST no se cachea)', () => {
    expect(TIENE_GET.test('export async function GET(req) {}')).toBe(true)
    expect(TIENE_GET.test('export const GET = withErrorLogging("/x", _GET)')).toBe(true)
    expect(TIENE_GET.test('export async function POST(req) {}')).toBe(false)
  })
})
