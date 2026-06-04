/**
 * Tests del cableado de límites del chat IA v2 (verificación de código fuente).
 *
 * Tras la migración a chatLimit.ts (Redis, cross-lambda), el route ya no usa
 * FREE_USER_DAILY_LIMIT/getUserDailyMessageCount. Verifica que el nuevo gate
 * por capas está bien cableado: burst por IP, premium verificado en BD, tope
 * diario vía chatLimit, 429 con limitReached, e incremento solo tras éxito.
 *
 * El comportamiento real del cálculo de límites está en chatLimit.test.ts.
 */

import * as fs from 'fs'
import * as path from 'path'

const routePath = path.join(__dirname, '../../../app/api/ai/chat-v2/route.ts')
const routeCode = fs.readFileSync(routePath, 'utf-8')

describe('Chat IA v2 - cableado de límites', () => {
  it('usa el módulo chatLimit (getChatLimitStatus + incrementChatUsage)', () => {
    expect(routeCode).toContain("from '@/lib/api/chatLimit'")
    expect(routeCode).toContain('getChatLimitStatus(')
    expect(routeCode).toContain('incrementChatUsage(')
    expect(routeCode).toContain('getChatLimitMode(')
  })

  it('ya NO usa el contador legacy (FREE_USER_DAILY_LIMIT / getUserDailyMessageCount)', () => {
    expect(routeCode).not.toContain('FREE_USER_DAILY_LIMIT')
    expect(routeCode).not.toContain('getUserDailyMessageCount')
  })

  it('aplica burst guard por IP (RATE_LIMIT_CHAT)', () => {
    expect(routeCode).toContain('RATE_LIMIT_CHAT')
    expect(routeCode).toContain('checkRateLimit(')
    expect(routeCode).toContain('getClientIp(')
  })

  it('lee el device id del request para anónimos', () => {
    expect(routeCode).toContain('getDeviceIdFromRequest(')
  })

  it('clasifica el cubo: explain para exentas, free para el resto', () => {
    expect(routeCode).toMatch(/isExemptSuggestion\s*\?\s*'explain'\s*:\s*'free'/)
    expect(routeCode).toContain("'explicar_respuesta'")
    expect(routeCode).toContain("'explicar_psico'")
  })

  it('NO confía solo en isPremium del frontend - verifica en BD con getAdminDb', () => {
    expect(routeCode).toContain('getAdminDb()')
    expect(routeCode).toContain('.from(userProfiles)')
    expect(routeCode).toContain("plan_type === 'premium'")
    expect(routeCode).toContain("plan_type === 'trial'")
  })

  it('premium salta el límite (countUsage excluye premium)', () => {
    expect(routeCode).toMatch(/countUsage\s*=\s*!isPremiumVerified/)
  })

  it('modo off desactiva el límite; shadow no bloquea', () => {
    expect(routeCode).toContain("limitMode !== 'off'")
    expect(routeCode).toContain("limitMode === 'on'")
  })

  it('devuelve 429 con limitReached y code RATE_LIMIT', () => {
    expect(routeCode).toContain("code: 'RATE_LIMIT'")
    expect(routeCode).toContain('limitReached: true')
    expect(routeCode).toContain('status: 429')
    expect(routeCode).toContain('dailyUsed:')
    expect(routeCode).toContain('dailyLimit:')
  })

  it('emite observable_event chat_limit_reached', () => {
    expect(routeCode).toContain("eventType: 'chat_limit_reached'")
  })

  it('incrementa la cuota SOLO tras respuesta exitosa (no en error)', () => {
    // streaming: guard por fullResponse; no-stream: guard por response.content
    expect(routeCode).toMatch(/countUsage\s*&&\s*fullResponse/)
    expect(routeCode).toMatch(/countUsage\s*&&\s*response\.content/)
  })

  it('no verifica en BD para usuarios anónimos', () => {
    expect(routeCode).toContain("'anonymous'")
  })
})
