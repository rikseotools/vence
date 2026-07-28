// T-243 — qué visita merece un toque de atribución, y en qué canal cae.
//
// El bug que esto fija: la regla estaba escrita DOS VECES (cliente y endpoint) con el mismo
// criterio equivocado —`if (!hasSignal) return`, o sea solo tráfico de PAGO—, así que el 86%
// de las altas quedaba como `direct` y el canal `organic` salía 1 vez en 12 días. Y el
// duplicado tenía un modo de fallo peor que el bug: ampliar solo el cliente habría dejado el
// toque descartado en el servidor **respondiendo `success: true`**.

import {
  hasCampaignSignal,
  esNavegacionInterna,
  shouldStoreTouch,
} from '@/lib/attribution/touchPolicy'
import { deriveChannel } from '@/lib/attribution/deriveChannel'

describe('shouldStoreTouch — el criterio que estaba mal', () => {
  it('tráfico de PAGO: se guarda (lo único que se guardaba antes)', () => {
    expect(shouldStoreTouch({ gclid: 'abc', landingPath: '/x' })).toEqual({ store: true, motivo: 'campaign' })
    expect(shouldStoreTouch({ utmSource: 'meta', landingPath: '/x' }).store).toBe(true)
  })

  // Los cuatro casos que ANTES se perdían enteros. Son el objeto de T-243.
  it('visita ORGÁNICA (Google) se guarda: su referrer dice el canal', () => {
    const t = { landingPath: '/auxiliar-administrativo-madrid', referrer: 'https://www.google.com/' }
    expect(shouldStoreTouch(t)).toEqual({ store: true, motivo: 'entrada_sesion' })
    expect(deriveChannel(t)).toBe('organic')
  })

  it('visita desde ChatGPT se guarda y es su propio canal, no SEO', () => {
    const t = { landingPath: '/', referrer: 'https://chatgpt.com/' }
    expect(shouldStoreTouch(t).store).toBe(true)
    expect(deriveChannel(t)).toBe('ai_referral')
  })

  it('enlace de un FORO se guarda como referral (la pregunta que lo destapó todo)', () => {
    const t = { landingPath: '/oposiciones', referrer: 'https://www.foroopositores.com/hilo/123' }
    expect(shouldStoreTouch(t).store).toBe(true)
    expect(deriveChannel(t)).toBe('referral')
  })

  it('visita DIRECTA (sin referrer) se guarda: "directo" también es un dato', () => {
    const t = { landingPath: '/auxiliar-administrativo-estado' }
    expect(shouldStoreTouch(t)).toEqual({ store: true, motivo: 'entrada_sesion' })
    expect(deriveChannel(t)).toBe('direct')
  })

  it('navegación INTERNA se descarta: no dice nada del origen', () => {
    expect(shouldStoreTouch({ landingPath: '/temario', referrer: 'https://www.vence.es/tests' }))
      .toEqual({ store: false, motivo: 'navegacion_interna' })
  })

  it('pero una campaña SÍ se guarda aunque el referrer sea interno (un anuncio es un toque)', () => {
    expect(shouldStoreTouch({ gclid: 'x', referrer: 'https://www.vence.es/', landingPath: '/' }).store).toBe(true)
  })

  it('sin landing ni nada → no se guarda (no aporta información)', () => {
    expect(shouldStoreTouch({})).toEqual({ store: false, motivo: 'sin_informacion' })
  })
})

describe('esNavegacionInterna — se parsea el HOST, no se busca la cadena', () => {
  it('reconoce nuestros dominios', () => {
    expect(esNavegacionInterna('https://www.vence.es/x')).toBe(true)
    expect(esNavegacionInterna('https://vence.es/')).toBe(true)
    expect(esNavegacionInterna('http://localhost:3000/x')).toBe(true)
  })

  // Un `includes('vence.es')` daría true aquí y perderíamos un referido legítimo.
  it('un dominio que CONTIENE el nuestro NO es interno', () => {
    expect(esNavegacionInterna('https://vence.es.sitio-malicioso.com/')).toBe(false)
    expect(esNavegacionInterna('https://no-es-vence.es.example.org/')).toBe(false)
  })

  it('sin referrer NO es navegación interna (es entrada directa)', () => {
    expect(esNavegacionInterna(null)).toBe(false)
    expect(esNavegacionInterna('')).toBe(false)
  })

  it('referrer ilegible → no se puede afirmar que sea interno', () => {
    expect(esNavegacionInterna('no-es-una-url')).toBe(false)
  })
})

describe('deriveChannel — el clasificador que llevaba meses en ayunas', () => {
  it('los click-id mandan sobre los UTM', () => {
    expect(deriveChannel({ gclid: 'x', utmSource: 'newsletter' })).toBe('google_ads')
    expect(deriveChannel({ fbclid: 'x' })).toBe('meta_ads')
    expect(deriveChannel({ msclkid: 'x' })).toBe('bing_ads')
  })

  it('buscadores → organic', () => {
    for (const r of ['https://www.google.com/', 'https://duckduckgo.com/', 'https://www.bing.com/search?q=x', 'https://search.brave.com/']) {
      expect(deriveChannel({ referrer: r })).toBe('organic')
    }
  })

  it('asistentes de IA → ai_referral (canal propio, no SEO)', () => {
    for (const r of ['https://chatgpt.com/', 'https://www.perplexity.ai/', 'https://gemini.google.com/']) {
      expect(deriveChannel({ referrer: r })).toBe('ai_referral')
    }
  })

  // Cambio explícito de T-243 (antes caía en `referral`): hay altas reales con este origen.
  it('copilot cuenta como IA', () => {
    expect(deriveChannel({ referrer: 'https://copilot.microsoft.com/' })).toBe('ai_referral')
  })

  // Lo destapó la simulación sobre datos reales, no una lluvia de ideas: 121 casos en 7 días
  // de `android-app://com.google.android.gm/` contados como `organic`. Un clic desde el
  // correo NO es SEO, y con la captura ampliada iban a llegar muchos más.
  describe('referrers android-app: el package name no es un dominio', () => {
    it('Gmail es email, NO organic (aunque el paquete lleve .google.)', () => {
      expect(deriveChannel({ referrer: 'android-app://com.google.android.gm/' })).toBe('email')
    })

    it('la app de Google SÍ es organic', () => {
      expect(deriveChannel({ referrer: 'android-app://com.google.android.googlequicksearchbox/' })).toBe('organic')
    })

    it('WhatsApp/Telegram → social', () => {
      expect(deriveChannel({ referrer: 'android-app://com.whatsapp/' })).toBe('social')
      expect(deriveChannel({ referrer: 'android-app://org.telegram.messenger/' })).toBe('social')
    })

    it('una app desconocida cae en referral, nunca en organic', () => {
      expect(deriveChannel({ referrer: 'android-app://com.app.desconocida/' })).toBe('referral')
    })
  })

  it('nuestro propio dominio NO se cuenta como referral (inflaría el canal)', () => {
    expect(deriveChannel({ referrer: 'https://www.vence.es/tests' })).toBe('direct')
    expect(deriveChannel({ referrer: 'http://localhost:3000/' })).toBe('direct')
  })

  it('sin nada → direct', () => {
    expect(deriveChannel({})).toBe('direct')
    expect(deriveChannel({ referrer: null })).toBe('direct')
  })
})

describe('cliente y endpoint aplican la MISMA regla (el duplicado fue la causa)', () => {
  const { readFileSync } = require('fs') as typeof import('fs')
  const { join } = require('path') as typeof import('path')
  const ROOT = join(__dirname, '..', '..', '..')
  const cliente = readFileSync(join(ROOT, 'components/tracking/AttributionCapture.tsx'), 'utf8')
  const endpoint = readFileSync(join(ROOT, 'app/api/attribution/touch/route.ts'), 'utf8')
  const sinComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

  it('el endpoint decide con el núcleo compartido', () => {
    expect(endpoint).toMatch(/shouldStoreTouch\(a\)/)
    expect(endpoint).toMatch(/from '@\/lib\/attribution\/touchPolicy'/)
  })

  it('el cliente usa el núcleo compartido para la navegación interna', () => {
    expect(cliente).toMatch(/from '@\/lib\/attribution\/touchPolicy'/)
    expect(cliente).toMatch(/esNavegacionInterna\(document\.referrer\)/)
  })

  it('ninguno vuelve a cortar por "sin señal de campaña"', () => {
    // La línea exacta que causó el bug: `if (!hasSignal) return`.
    // Se quitan los COMENTARIOS antes de mirar: los dos ficheros citan esa línea para
    // explicar qué se arregló, y una cita no es una llamada (mismo falso positivo que se
    // autodenunció en el guardarraíl del Bearer, T-210).
    expect(sinComentarios(cliente)).not.toMatch(/if\s*\(\s*!hasSignal\s*\)\s*return/)
    expect(sinComentarios(endpoint)).not.toMatch(/skipped:\s*'no_signal'/)
  })

  it('el cliente emite UN toque de entrada por sesión (si no, uno por navegación)', () => {
    expect(cliente).toMatch(/attr_touch_entrada_sesion/)
  })

  it('el endpoint de binding NO lleva su propia copia de deriveChannel', () => {
    const binding = readFileSync(join(ROOT, 'app/api/acquisition/route.ts'), 'utf8')
    expect(binding).toMatch(/from '@\/lib\/attribution\/deriveChannel'/)
    expect(binding).not.toMatch(/function deriveChannel/)
  })

  it('AuthContext manda deviceId (si no, cae al modo legacy y fija la fila con datos pobres)', () => {
    const ctx = readFileSync(join(ROOT, 'contexts/AuthContext.tsx'), 'utf8')
    expect(ctx).toMatch(/deviceId:\s*typeof window/)
  })
})
