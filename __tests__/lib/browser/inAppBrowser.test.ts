import { isInAppBrowser } from '@/lib/browser/inAppBrowser'

// UAs reales (recortados) de navegadores embebidos que bloquean window.print().
const IN_APP = {
  'App de Google (GSA) iOS — caso María':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/329.0.630251527 Mobile/15E148 Safari/604.1',
  'Instagram iOS':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 329.0.0.0 (iPhone; iOS 17_4)',
  'Facebook iOS (FBAN/FBAV)':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/458.0.0.0;FBBV/1;FBDV/iPhone14,3]',
  'TikTok Android':
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 musical_ly_2023 BytedanceWebview/d8a21c',
  'LinkedIn':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 LinkedInApp/9.0.0',
  'WKWebView iOS genérico (app desconocida, sin token propio)':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
}

const REAL_BROWSERS = {
  'Safari iOS':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Chrome iOS (CriOS) — navegador real, imprime':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.0.0 Mobile/15E148 Safari/604.1',
  'Firefox iOS (FxiOS) — navegador real':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/604.1',
  'Chrome Android':
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  'Chrome escritorio':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Firefox escritorio':
    'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
}

describe('isInAppBrowser — detección de navegadores embebidos', () => {
  for (const [name, ua] of Object.entries(IN_APP)) {
    test(`detecta in-app: ${name}`, () => {
      expect(isInAppBrowser(ua)).toBe(true)
    })
  }

  for (const [name, ua] of Object.entries(REAL_BROWSERS)) {
    test(`NO marca navegador real: ${name}`, () => {
      expect(isInAppBrowser(ua)).toBe(false)
    })
  }

  test('UA vacío o ausente → false (nunca rompe el flujo normal)', () => {
    expect(isInAppBrowser('')).toBe(false)
    expect(isInAppBrowser(undefined)).toBe(false)
  })
})

// Corpus de simulación: más UAs reales, para endurecer contra falsos pos/neg.
describe('isInAppBrowser — corpus de simulación (regresión de cobertura)', () => {
  const MORE_IN_APP = {
    'WhatsApp iOS':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.24.10',
    'Snapchat iOS':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.0',
    'LINE iOS':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.0.0',
    'Twitter/X iOS':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone',
    'Facebook Android (FB_IAB)':
      'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0;]',
    'Instagram Android':
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 Instagram 320.0.0.0 Android',
    'Pinterest iOS':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Pinterest/11.0',
    'Google App genérico iOS (variante sin Safari)':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/330.0 Mobile/15E148',
  }

  const MORE_REAL = {
    'Edge iOS (EdgiOS)':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/125.0 Mobile/15E148 Safari/604.1',
    'Opera iOS (OPT)':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) OPT/4.0 Mobile/15E148',
    'Samsung Internet (Android real)':
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121 Mobile Safari/537.36',
    'iPad Safari (escritorio-like)':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Edge escritorio':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36 Edg/125.0',
  }

  for (const [name, ua] of Object.entries(MORE_IN_APP)) {
    test(`in-app: ${name}`, () => expect(isInAppBrowser(ua)).toBe(true))
  }
  for (const [name, ua] of Object.entries(MORE_REAL)) {
    test(`real: ${name}`, () => expect(isInAppBrowser(ua)).toBe(false))
  }

  // Decisión deliberada: un WebView de Android GENÉRICO ("wv", sin token de app
  // conocida) NO se intercepta — en Android el print suele funcionar y no queremos
  // falsos positivos. Solo interceptamos Android cuando hay app conocida (arriba).
  test('WebView Android genérico ("wv") NO se marca (evita falso positivo)', () => {
    const androidWv =
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 wv'
    expect(isInAppBrowser(androidWv)).toBe(false)
  })
})
