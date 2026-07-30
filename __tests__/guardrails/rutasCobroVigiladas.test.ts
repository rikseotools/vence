// __tests__/guardrails/rutasCobroVigiladas.test.ts
//
// GUARDARRAÍL: toda ruta de API que acabe hablando con Stripe tiene que estar dentro de lo
// que vigila la alerta de fallos de cobro. Un endpoint que mueve dinero **no puede nacer mudo**.
//
// POR QUÉ (T-341, 31/07/2026). La regla `RULE_STRIPE_CHECKOUT_FAILED` avisa cuando hay 5xx
// en un camino de pago, y hasta hoy miraba solo `endpoint LIKE '/api/stripe/%'`. Pero el
// cobro dejó de vivir únicamente ahí: `POST /api/v2/premium/recuperar-precio` crea price,
// enlace de pago y oferta, y su primera versión devolvía **500 en el primer clic de
// cualquier afectado** (un `ON CONFLICT` que no casaba con el índice parcial). Ese fallo
// quedaba **fuera del radar de la alerta**: lo cazó una prueba manual contra datos reales.
//
// Es el mismo razonamiento que `senal_error_sin_vigilancia` aplica a las señales sueltas:
// que la vigilancia no dependa de que alguien se acuerde de ampliar un LIKE.
//
// Cómo decide qué es "camino de cobro": no por el nombre de la carpeta —`/api/v2/premium`
// no lleva «stripe» en ninguna parte— sino **siguiendo los imports** desde cada `route.ts`
// hasta ver si alguno alcanza `lib/stripe`. Así cuenta lo que de verdad toca la pasarela,
// aunque lo haga a través de dos módulos de dominio.
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, dirname, resolve } from 'path'

const RAIZ = process.cwd()
const API = join(RAIZ, 'app/api')

/**
 * Los patrones LIKE que vigila la alerta. Se leen del FICHERO del backend, no se copian:
 * una copia aquí envejecería por su cuenta y el guardarraíl daría verde sobre una regla
 * que ya no mira eso (que es exactamente el fallo que este test viene a impedir).
 */
function patronesVigilados(): string[] {
  const src = readFileSync(join(RAIZ, 'backend/src/alerts/alert-rules.ts'), 'utf8')
  const i = src.indexOf('export const PATRONES_RUTA_COBRO')
  if (i < 0) throw new Error('No encuentro PATRONES_RUTA_COBRO en backend/src/alerts/alert-rules.ts')
  const abre = src.indexOf('[', i)
  const cierra = src.indexOf(']', abre)
  return [...src.slice(abre, cierra).matchAll(/'([^']+)'/g)].map((m) => m[1])
}

/** `/api/stripe/%` → ¿cubre esta ruta? El único comodín que usa Postgres aquí es `%`. */
function cubre(patron: string, ruta: string): boolean {
  const re = new RegExp('^' + patron.split('%').map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$')
  return re.test(ruta)
}

function ficheros(dir: string, salida: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) ficheros(p, salida)
    else if (e === 'route.ts' || e === 'route.js') salida.push(p)
  }
  return salida
}

/** Ruta HTTP a partir del fichero: app/api/v2/premium/x/route.ts → /api/v2/premium/x */
function rutaHttp(fichero: string): string {
  return '/' + fichero.slice(RAIZ.length + 1).replace(/\/route\.(ts|js)$/, '').replace(/^app\//, '')
}

const cache = new Map<string, string>()
function leer(f: string): string {
  if (!cache.has(f)) cache.set(f, readFileSync(f, 'utf8'))
  return cache.get(f)!
}

/** Resuelve un import `@/…` o relativo al fichero .ts/.tsx real, si existe. */
function resolver(desde: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(RAIZ, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(desde), spec) : null
  if (!base) return null
  for (const cand of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand
  }
  return null
}

/**
 * ¿Este fichero llega a Stripe siguiendo sus imports? Profundidad acotada: los caminos
 * reales del repo son `route → lib/api/<dominio> → lib/stripe`, o sea 2 saltos.
 */
function alcanzaStripe(fichero: string, visitados = new Set<string>(), profundidad = 0): boolean {
  if (profundidad > 3 || visitados.has(fichero)) return false
  visitados.add(fichero)
  const src = leer(fichero)
  if (/from\s+'@\/lib\/stripe'|from\s+'stripe'|from\s+'@\/lib\/stripe\//.test(src)) return true
  for (const m of src.matchAll(/from\s+'((?:@\/|\.)[^']+)'/g)) {
    const destino = resolver(fichero, m[1])
    if (destino && alcanzaStripe(destino, visitados, profundidad + 1)) return true
  }
  return false
}

/**
 * Exenciones, con motivo. Estas rutas tocan Stripe pero un 5xx suyo NO es un cliente que no
 * pudo pagar, así que meterlas en la alerta crítica sería ruido — y una alerta ruidosa se
 * acaba ignorando, que es la forma lenta de quedarse sin vigilancia.
 */
const EXENTAS: Record<string, string> = {
  '/api/stripe/webhook': 'lo cubren sus propias reglas (webhook_health, reconciliación); además ya cae bajo /api/stripe/%',
  '/api/health': 'sonda de salud; su 5xx lo cazan las reglas de disponibilidad, no las de cobro',
  '/api/cron/check-webhook-health': 'cron, no camino de usuario: su fallo lo vigilan las reglas de crons',
  '/api/admin/sales-prediction': 'panel de admin en solo lectura: nadie está pagando ahí',
  '/api/admin/stripe-fees-summary': 'panel de admin en solo lectura: nadie está pagando ahí',
  '/api/profile':
    'llega a Stripe solo para RECONCILIAR el plan (`reconcileUserPremium`), no para cobrar: ' +
    'su 5xx es «el perfil no carga», que ya cuentan las reglas de 5xx generales, y el desajuste ' +
    'plan↔suscripción tiene su propia regla de reconciliación',
  '/api/cron/renewal-reminders':
    'cron de recordatorios, no un camino de usuario: sus fallos los vigilan las reglas de crons ' +
    '(cron_overdue / cron_sin_exito), que además detectan que NO haya corrido — cosa que una ' +
    'regla de 5xx no puede ver',
}

describe('rutas de cobro vigiladas — ninguna nace muda', () => {
  const patrones = patronesVigilados()
  // Ojo con el `.filter(alcanzaStripe)` directo: le pasaría el índice como 2.º argumento.
  const rutasStripe = ficheros(API).filter((f) => alcanzaStripe(f)).map(rutaHttp).sort()

  it('la alerta declara al menos un patrón (si no, no vigila nada)', () => {
    expect(patrones.length).toBeGreaterThan(0)
  })

  it('toda ruta que llega a Stripe está vigilada o exenta con motivo', () => {
    const huerfanas = rutasStripe.filter((r) => !EXENTAS[r] && !patrones.some((p) => cubre(p, r)))
    expect(huerfanas).toEqual([])
  })

  it('el endpoint que devuelve el precio heredado está vigilado (el caso que lo destapó)', () => {
    const ruta = '/api/v2/premium/recuperar-precio'
    expect(rutasStripe).toContain(ruta)
    expect(patrones.some((p) => cubre(p, ruta))).toBe(true)
  })

  it('las exenciones son de rutas que existen (si no, es una excusa caducada)', () => {
    const todas = new Set(ficheros(API).map(rutaHttp))
    for (const ruta of Object.keys(EXENTAS)) expect(todas.has(ruta)).toBe(true)
  })

  it('los patrones no barren de más: /api/tests no es un camino de cobro', () => {
    expect(patrones.some((p) => cubre(p, '/api/tests/algo'))).toBe(false)
  })
})
