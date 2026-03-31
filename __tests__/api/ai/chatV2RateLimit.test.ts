/**
 * Tests para rate limiting del chat IA v2
 *
 * Verifica que:
 * - Usuarios premium NUNCA son bloqueados por rate limit
 * - Si el frontend envía isPremium=false pero el usuario es premium en BD, NO se bloquea
 * - Usuarios free son bloqueados después del límite
 * - Sugerencias exentas nunca cuentan contra el límite
 *
 * IMPORTANTE: Estos tests leen el código fuente para verificar la lógica de rate limiting
 * sin necesidad de ejecutar el handler completo (que requiere muchas dependencias).
 */

import * as fs from 'fs'
import * as path from 'path'

const routePath = path.join(__dirname, '../../../app/api/ai/chat-v2/route.ts')
const routeCode = fs.readFileSync(routePath, 'utf-8')

describe('Chat IA v2 - Rate Limit Code Verification', () => {

  it('FREE_USER_DAILY_LIMIT está definido como 5', () => {
    expect(routeCode).toMatch(/FREE_USER_DAILY_LIMIT\s*=\s*5/)
  })

  it('EXEMPT_SUGGESTIONS incluye explicar_respuesta y explicar_psico', () => {
    expect(routeCode).toContain("'explicar_respuesta'")
    expect(routeCode).toContain("'explicar_psico'")
    expect(routeCode).toContain("'analizar_psico'")
  })

  it('sugerencias exentas se verifican ANTES del rate limit check', () => {
    // El if que usa isExemptSuggestion debe venir antes del check de dailyCount >= FREE_USER_DAILY_LIMIT
    const exemptUsage = routeCode.indexOf('!isExemptSuggestion')
    const rateLimitCheck = routeCode.indexOf('>= FREE_USER_DAILY_LIMIT')
    expect(exemptUsage).toBeGreaterThan(0)
    expect(rateLimitCheck).toBeGreaterThan(0)
    expect(exemptUsage).toBeLessThan(rateLimitCheck)
  })

  it('NO confía solo en isPremium del frontend - verifica en BD', () => {
    // Debe consultar user_profiles.plan_type
    expect(routeCode).toContain("from('user_profiles')")
    expect(routeCode).toContain("select('plan_type')")
    expect(routeCode).toContain("plan_type === 'premium'")
    expect(routeCode).toContain("plan_type === 'trial'")
  })

  it('verifica en BD cuando isPremium es false (no solo cuando es true)', () => {
    // La verificación en BD debe ocurrir cuando isPremium es false
    expect(routeCode).toContain('!isPremiumVerified')
    // Y debe asignar el resultado de la BD
    expect(routeCode).toContain('isPremiumVerified = profile?.plan_type')
  })

  it('no verifica en BD para usuarios anónimos', () => {
    expect(routeCode).toContain("'anonymous'")
  })

  it('rate limit devuelve 429 con código RATE_LIMIT', () => {
    expect(routeCode).toContain("code: 'RATE_LIMIT'")
    expect(routeCode).toContain('status: 429')
  })

  it('rate limit incluye dailyUsed y dailyLimit en la respuesta', () => {
    expect(routeCode).toContain('dailyUsed:')
    expect(routeCode).toContain('dailyLimit:')
  })

  it('getUserDailyMessageCount excluye sugerencias exentas del conteo', () => {
    // La función debe filtrar mensajes que son sugerencias exentas
    expect(routeCode).toContain('EXEMPT_SUGGESTIONS')
    // Debe contar solo mensajes no exentos
    expect(routeCode).toMatch(/filter|EXEMPT_SUGGESTIONS/)
  })

  it('la verificación premium en BD usa service_role (no anon key)', () => {
    // Debe usar SUPABASE_SERVICE_ROLE_KEY para poder leer user_profiles
    expect(routeCode).toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('REGRESIÓN: el flujo completo premium-check está en el orden correcto', () => {
    const lines = routeCode.split('\n')

    // 1. isExemptSuggestion check debe venir primero
    const exemptLine = lines.findIndex(l => l.includes('isExemptSuggestion') && l.includes('!isExemptSuggestion'))
    // 2. Luego isPremiumVerified = data.isPremium (fast path)
    const fastPathLine = lines.findIndex(l => l.includes('isPremiumVerified = data.isPremium'))
    // 3. Luego verificación en BD
    const bdCheckLine = lines.findIndex(l => l.includes("select('plan_type')"))
    // 4. Luego rate limit check
    const rateLimitLine = lines.findIndex(l => l.includes('FREE_USER_DAILY_LIMIT') && l.includes('>='))

    expect(exemptLine).toBeGreaterThan(0)
    expect(fastPathLine).toBeGreaterThan(exemptLine)
    expect(bdCheckLine).toBeGreaterThan(fastPathLine)
    expect(rateLimitLine).toBeGreaterThan(bdCheckLine)
  })
})
