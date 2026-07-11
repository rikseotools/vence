// __tests__/lib/withErrorLoggingCredentials.test.ts
// requestHadCredentials: distingue el 401 anónimo (benigno, contrato del endpoint)
// del 401 con credenciales rechazadas (señal de regresión de auth). Raíz del flood
// de `/api/auth/token` (~340k/día tras el cutover a RDS del 04/07) que infló
// validation_error_logs a ~1 GB y tumbó su propio panel admin (GROUP BY a 112s → 500).
import { requestHadCredentials } from '@/lib/api/withErrorLogging'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')

function req(headers: Record<string, string>): Request {
  return new Request('https://www.vence.es/api/auth/token', { headers })
}

describe('requestHadCredentials', () => {
  it('anónimo (sin auth header ni cookie de sesión) → false', () => {
    expect(requestHadCredentials(req({}))).toBe(false)
    expect(requestHadCredentials(req({ 'user-agent': 'bot' }))).toBe(false)
  })

  it('cookies no-auth (analytics, consent) NO cuentan como credenciales → false', () => {
    expect(requestHadCredentials(req({ cookie: '_ga=GA1.2.3; cookie_consent=yes' }))).toBe(false)
  })

  it('Authorization Bearer (RS256/HS256) → true', () => {
    expect(requestHadCredentials(req({ authorization: 'Bearer eyJhbGci...' }))).toBe(true)
  })

  it('cookie de sesión Auth.js (dev y prod __Secure) → true', () => {
    expect(requestHadCredentials(req({ cookie: 'authjs.session-token=abc' }))).toBe(true)
    expect(requestHadCredentials(req({ cookie: '__Secure-authjs.session-token=abc' }))).toBe(true)
  })

  it('cookie legacy Supabase (sb-<ref>-auth-token) → true', () => {
    expect(requestHadCredentials(req({ cookie: 'sb-abcdef-auth-token=xyz' }))).toBe(true)
  })

  it('defensivo: request sin headers no rompe → false', () => {
    expect(requestHadCredentials({} as unknown as Request)).toBe(false)
    expect(requestHadCredentials(null as unknown as Request)).toBe(false)
  })
})

// Guardarraíl a nivel de fuente: el corte de VLE y la severidad del timing deben
// aplicarse SOLO al 401 anónimo, no a todo 401 (para no perder la señal de auth).
describe('withErrorLogging — filtro 401 solo anónimo (source)', () => {
  const content = fs.readFileSync(path.join(ROOT, 'lib/api/withErrorLogging.ts'), 'utf-8')

  it('corta VLE solo para 401 sin credenciales', () => {
    expect(content).toMatch(/response\.status === 401 && !credentialed/)
  })

  it('degrada timing a info solo para 401 sin credenciales (no todo 401)', () => {
    expect(content).toMatch(/\(response\.status === 401 && !credentialed\) \? 'info'/)
  })

  it('el 403 de límite diario sigue filtrado (no se rompió)', () => {
    expect(content).toMatch(/límite diario/)
  })

  it('los statuses ESPERADOS se muestrean (no fuerzan el 100% de request_completed)', () => {
    // El 401 del token (polling constante) inflaba observable_events a ~525k/día.
    // forceEmit debe excluir los expectedStatuses → se muestrean como los 2xx (10%).
    expect(content).toMatch(/const forceEmit = isError && !isExpectedStatus\(response\.status\)/)
    expect(content).toMatch(/shouldEmitTiming = forceEmit \|\| Math\.random\(\) < SUCCESS_TIMING_SAMPLE_RATE/)
  })
})

describe('/api/auth/token — auth_token_minted muestreado (anti-firehose)', () => {
  const route = fs.readFileSync(path.join(ROOT, 'app/api/auth/token/route.ts'), 'utf-8')

  it('muestrea el mint (via=bridge siempre, authjs_session al 10%)', () => {
    expect(route).toMatch(/via === 'bridge' \|\| Math\.random\(\) < MINT_SAMPLE_RATE/)
  })
})

// /api/auth/token: su 401 es contrato SIEMPRE (el cliente manda credenciales y hace
// polling → la regla central del 401 anónimo NO basta). Debe marcarlo expectedStatuses.
describe('/api/auth/token — 401 esperado por contrato (source)', () => {
  const route = fs.readFileSync(path.join(ROOT, 'app/api/auth/token/route.ts'), 'utf-8')

  it('marca expectedStatuses:[401] para no re-inundar validation_error_logs', () => {
    expect(route).toMatch(/withErrorLogging\(\s*['"]\/api\/auth\/token['"]\s*,\s*_GET\s*,\s*\{\s*expectedStatuses:\s*\[\s*401\s*\]\s*\}\s*\)/)
  })
})
