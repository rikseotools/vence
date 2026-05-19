// __tests__/lib/api/v2/complete-onboarding/flow.test.ts
// Verificar que OnboardingModal usa el endpoint v2 y que el flujo es correcto
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../../../..')

describe('Onboarding — flujo v2 end-to-end', () => {
  const modalContent = fs.readFileSync(path.join(ROOT, 'components/OnboardingModal.tsx'), 'utf-8')
  const routeContent = fs.readFileSync(path.join(ROOT, 'app/api/v2/complete-onboarding/route.ts'), 'utf-8')
  const queriesContent = fs.readFileSync(path.join(ROOT, 'lib/api/v2/complete-onboarding/queries.ts'), 'utf-8')
  const clientContent = fs.readFileSync(path.join(ROOT, 'lib/api/v2/complete-onboarding/client.ts'), 'utf-8')

  describe('OnboardingModal', () => {
    it('usa completeOnboardingOnServer en vez de supabase directo en handleComplete', () => {
      expect(modalContent).toContain('completeOnboardingOnServer')
    })

    it('NO hace queries directas a user_profiles en handleComplete', () => {
      // El handleComplete debe usar la API v2, no supabase directo
      const handleCompleteBlock = modalContent.slice(
        modalContent.indexOf('const handleComplete = async'),
        modalContent.indexOf("console.log('✅ Onboarding completado via API v2')")
      )
      expect(handleCompleteBlock).not.toContain(".from('user_profiles')")
    })

    it('tiene guard de doble ejecución con useRef', () => {
      expect(modalContent).toContain('completingRef.current')
    })

    it('envía todos los campos obligatorios al servidor', () => {
      expect(modalContent).toContain('targetOposicion:')
      expect(modalContent).toContain('age:')
      expect(modalContent).toContain('gender:')
      expect(modalContent).toContain('ciudad:')
    })

    it('envía campos opcionales', () => {
      expect(modalContent).toContain('dailyStudyHours:')
      expect(modalContent).toContain('targetOposicionData:')
    })
  })

  describe('API route /api/v2/complete-onboarding', () => {
    it('verifica auth con Bearer token', () => {
      // Migrado en commit b9f637d6 (11/05/2026) al wrapper verifyAuth.
      // El header Bearer/authorization ya no aparece literal: lo gestiona el wrapper.
      expect(routeContent).toContain("verifyAuth")
    })

    it('usa safeParseCompleteOnboardingRequest para validar', () => {
      expect(routeContent).toContain('safeParseCompleteOnboardingRequest')
    })

    it('usa withErrorLogging para log de errores', () => {
      expect(routeContent).toContain('withErrorLogging')
    })

    it('devuelve 401 si no hay token', () => {
      expect(routeContent).toContain('401')
    })

    it('devuelve 400 si validación falla', () => {
      expect(routeContent).toContain('400')
    })
  })

  describe('Server queries', () => {
    it('usa Drizzle para actualizar user_profiles', () => {
      expect(queriesContent).toContain('userProfiles')
      expect(queriesContent).toContain('.update(')
    })

    it('guarda onboardingCompletedAt', () => {
      expect(queriesContent).toContain('onboardingCompletedAt')
    })

    it('resetea onboardingSkipCount a 0', () => {
      expect(queriesContent).toContain('onboardingSkipCount: 0')
    })

    it('hace una sola operación de update (atómico)', () => {
      // Solo debe haber un .update() — todo en una sola query
      const updateCount = (queriesContent.match(/\.update\(/g) || []).length
      expect(updateCount).toBe(1)
    })

    it('devuelve success: false si usuario no encontrado', () => {
      expect(queriesContent).toContain("success: false")
      expect(queriesContent).toContain('Usuario no encontrado')
    })
  })

  describe('Client', () => {
    it('hace POST a /api/v2/complete-onboarding', () => {
      expect(clientContent).toContain('/api/v2/complete-onboarding')
      expect(clientContent).toContain("method: 'POST'")
    })

    it('tiene timeout de 10s', () => {
      expect(clientContent).toContain('10000')
    })

    it('maneja errores de auth', () => {
      expect(clientContent).toContain('Sesión expirada')
    })

    it('maneja timeout', () => {
      expect(clientContent).toContain('AbortError')
      expect(clientContent).toContain('Timeout')
    })

    it('valida respuesta con Zod', () => {
      expect(clientContent).toContain('completeOnboardingResponseSchema.safeParse')
    })
  })
})
