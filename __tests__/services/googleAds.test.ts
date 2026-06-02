// __tests__/services/googleAds.test.ts
// Tests de la lógica pura de la integración Google Ads (sin red ni credenciales):
// validación de config (fail-fast) y normalización de errores de la API.

import {
  loadAdsConfig,
  normalizeCustomerId,
} from '@/lib/services/googleAds/config'
import {
  GoogleAdsError,
  normalizeGoogleAdsError,
} from '@/lib/services/googleAds/errors'

describe('googleAds/config', () => {
  describe('normalizeCustomerId', () => {
    test('quita guiones y deja solo dígitos', () => {
      expect(normalizeCustomerId('914-896-7335')).toBe('9148967335')
    })
    test('acepta ya-normalizado', () => {
      expect(normalizeCustomerId('9148967335')).toBe('9148967335')
    })
    test('devuelve undefined para vacío/nulo', () => {
      expect(normalizeCustomerId('')).toBeUndefined()
      expect(normalizeCustomerId(null)).toBeUndefined()
      expect(normalizeCustomerId(undefined)).toBeUndefined()
    })
  })

  describe('loadAdsConfig', () => {
    const fullEnv = {
      GOOGLE_ADS_CLIENT_ID: 'cid',
      GOOGLE_ADS_CLIENT_SECRET: 'secret',
      GOOGLE_ADS_DEVELOPER_TOKEN: 'devtoken',
      GOOGLE_ADS_REFRESH_TOKEN: 'refresh',
      GOOGLE_ADS_CUSTOMER_ID: '914-896-7335',
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: '221-720-1941',
    } as unknown as NodeJS.ProcessEnv

    test('carga y normaliza una config completa', () => {
      const cfg = loadAdsConfig(fullEnv)
      expect(cfg.customerId).toBe('9148967335')
      expect(cfg.loginCustomerId).toBe('2217201941')
      expect(cfg.developerToken).toBe('devtoken')
    })

    test('usa el fallback GOOGLE_CLIENT_ID/SECRET del OAuth de la app', () => {
      const env = {
        ...fullEnv,
        GOOGLE_ADS_CLIENT_ID: undefined,
        GOOGLE_ADS_CLIENT_SECRET: undefined,
        GOOGLE_CLIENT_ID: 'app-cid',
        GOOGLE_CLIENT_SECRET: 'app-secret',
      } as unknown as NodeJS.ProcessEnv
      const cfg = loadAdsConfig(env)
      expect(cfg.clientId).toBe('app-cid')
      expect(cfg.clientSecret).toBe('app-secret')
    })

    test('login_customer_id es opcional', () => {
      const env = { ...fullEnv, GOOGLE_ADS_LOGIN_CUSTOMER_ID: undefined } as NodeJS.ProcessEnv
      expect(loadAdsConfig(env).loginCustomerId).toBeUndefined()
    })

    test('falla listando TODO lo que falta de golpe', () => {
      expect(() => loadAdsConfig({} as NodeJS.ProcessEnv)).toThrow(/Config de Google Ads incompleta/)
      try {
        loadAdsConfig({} as NodeJS.ProcessEnv)
      } catch (e) {
        const msg = (e as Error).message
        expect(msg).toContain('GOOGLE_ADS_DEVELOPER_TOKEN')
        expect(msg).toContain('GOOGLE_ADS_REFRESH_TOKEN')
        expect(msg).toContain('GOOGLE_ADS_CUSTOMER_ID')
      }
    })
  })
})

describe('googleAds/errors', () => {
  test('aplana un GoogleAdsFailure con errors[]', () => {
    const failure = {
      errors: [
        {
          error_code: { authentication_error: 'NOT_ADS_USER' },
          message: 'User not associated with any Ads account',
          trigger: { string_value: 'x' },
        },
      ],
      request_id: 'REQ123',
    }
    const err = normalizeGoogleAdsError(failure)
    expect(err).toBeInstanceOf(GoogleAdsError)
    expect(err.requestId).toBe('REQ123')
    expect(err.details).toHaveLength(1)
    expect(err.details[0].errorCode).toBe('authentication_error:NOT_ADS_USER')
    expect(err.message).toContain('not associated')
  })

  test('envuelve un error genérico sin forma conocida', () => {
    const err = normalizeGoogleAdsError(new Error('boom'))
    expect(err).toBeInstanceOf(GoogleAdsError)
    expect(err.message).toBe('boom')
    expect(err.details).toHaveLength(1)
  })

  test('es idempotente: un GoogleAdsError ya normalizado se devuelve igual', () => {
    const original = new GoogleAdsError('x', [{ message: 'x' }], 'R')
    expect(normalizeGoogleAdsError(original)).toBe(original)
  })
})
