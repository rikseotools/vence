/**
 * Huella de dispositivo v2 — los invariantes que hacen que el límite por dispositivo sea real.
 *
 * Contexto (medido el 30/07/2026): el límite por dispositivo lleva desde el 17/04 cableado en el
 * frontend Y en el backend, con tests y pantalla de bloqueo… y en 30 días no ha cortado ni una vez,
 * mientras 3-11 dispositivos al día se pasan del tope. No fallaba el enforcement: fallaba el ANCLA.
 * Se apoyaba en el `device_id` de `localStorage`, que se borra en dos clics — el mismo trío de
 * cuentas aparece bajo TRES `device_id` distintos, rotando cada 15 minutos.
 *
 * Estos tests fijan las dos propiedades sin las cuales el arreglo no sirve de nada:
 *   1. ESTABILIDAD — el mismo equipo produce siempre la misma huella (si no, el contador se
 *      reinicia solo y volvemos a un enforcement mudo que encima se cree que funciona);
 *   2. DISCRIMINACIÓN — equipos distintos producen huellas distintas (si no, bloquearíamos a
 *      inocentes, que es como v1 acabó con huellas de 83 cuentas).
 */
import {
  normalizeScreen,
  hardwareLooksConsistent,
  serializeSignals,
  strongSignalCount,
  NA,
  type RawSignals,
} from '@/lib/security/fingerprint/signals'
import {
  sha256Hex,
  buildFingerprint,
  isValidFingerprint,
  FP_VERSION,
  FP_HASH_LEN,
} from '@/lib/security/fingerprint/hash'

const base: RawSignals = {
  screen: '360x800', colorDepth: '24', pixelRatio: '3', timezone: 'Europe/Madrid',
  language: 'es-ES', cores: '8', memory: '8', touch: '5', platform: 'Linux armv8l',
  canvas: 'data:image/png;base64,AAAA', webgl: 'Qualcomm~Adreno (TM) 640', audio: '124.043',
}

describe('normalizeScreen — girar el móvil no puede cambiar la identidad', () => {
  it('vertical y horizontal dan la MISMA huella de pantalla', () => {
    expect(normalizeScreen(360, 800)).toBe(normalizeScreen(800, 360))
    expect(normalizeScreen(360, 800)).toBe('360x800')
  })

  it('pantallas realmente distintas siguen distinguiéndose', () => {
    expect(normalizeScreen(360, 800)).not.toBe(normalizeScreen(390, 844))
  })

  it('valores imposibles dan `na`, no NaN ni "0x0"', () => {
    for (const [w, h] of [[0, 800], [-1, 5], [null, 800], ['x', 'y'], [undefined, undefined]]) {
      expect(normalizeScreen(w, h)).toBe(NA)
    }
  })
})

describe('hardwareLooksConsistent — CPU y RAM se validan entre sí', () => {
  it('combinaciones reales pasan', () => {
    expect(hardwareLooksConsistent(8, 8)).toBe(true)
    expect(hardwareLooksConsistent(4, 4)).toBe(true)
    expect(hardwareLooksConsistent(16, 32)).toBe(true)
  })

  it('muchos núcleos con muy poca RAM huele a entorno manipulado', () => {
    expect(hardwareLooksConsistent(16, 2)).toBe(false)
  })

  it('un solo núcleo con 32 GB, también', () => {
    expect(hardwareLooksConsistent(1, 32)).toBe(false)
  })

  it('sin datos NO se opina (no penalizar a quien no expone la API)', () => {
    expect(hardwareLooksConsistent(undefined, 8)).toBe(true)
    expect(hardwareLooksConsistent('na', 'na')).toBe(true)
    expect(hardwareLooksConsistent(0, 0)).toBe(true)
  })
})

describe('serializeSignals — el material del hash', () => {
  it('es determinista: mismas señales, mismo material', () => {
    expect(serializeSignals(base)).toBe(serializeSignals({ ...base }))
  })

  it('lleva claves explícitas (añadir una señal se ve, no desplaza al resto)', () => {
    expect(serializeSignals(base)).toContain('canvas=')
    expect(serializeSignals(base)).toContain('webgl=')
    expect(serializeSignals(base)).toContain('audio=')
  })

  it('una señal ausente ocupa su sitio con `na` en vez de desaparecer', () => {
    // Si al faltar el audio se omitiera el campo, el mismo equipo tendría dos huellas según
    // si esa API respondió — exactamente la inestabilidad que hace inútil el contador.
    const sinAudio = serializeSignals({ ...base, audio: NA })
    expect(sinAudio).toContain(`audio=${NA}`)
    expect(sinAudio.split('|')).toHaveLength(serializeSignals(base).split('|').length)
  })

  it('el orden NO depende del orden de las claves del objeto', () => {
    const alReves = Object.fromEntries(Object.entries(base).reverse()) as RawSignals
    expect(serializeSignals(alReves)).toBe(serializeSignals(base))
  })
})

describe('strongSignalCount — la calidad de la huella es medible', () => {
  it('cuenta canvas, WebGL y audio', () => {
    expect(strongSignalCount(base)).toBe(3)
    expect(strongSignalCount({ ...base, audio: NA })).toBe(2)
    expect(strongSignalCount({ ...base, canvas: NA, webgl: NA, audio: NA })).toBe(0)
  })
})

describe('hash — SHA-256 de verdad, no el casero de 32 bits de v1', () => {
  it('vector conocido de SHA-256', async () => {
    // "abc" → ba7816bf... (FIPS 180-4). Si esto falla, no es nuestro código: es el entorno.
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('la huella lleva versión y longitud fija', async () => {
    const fp = await buildFingerprint(serializeSignals(base))
    expect(fp).toMatch(new RegExp(`^${FP_VERSION}_[0-9a-f]{${FP_HASH_LEN}}$`))
    expect(isValidFingerprint(fp)).toBe(true)
  })

  it('ESTABILIDAD: el mismo equipo da la misma huella siempre', async () => {
    const a = await buildFingerprint(serializeSignals(base))
    const b = await buildFingerprint(serializeSignals({ ...base }))
    expect(a).toBe(b)
  })

  it('DISCRIMINACIÓN: cambiar UNA señal cambia la huella', async () => {
    const ref = await buildFingerprint(serializeSignals(base))
    const variantes: Partial<RawSignals>[] = [
      { canvas: 'data:image/png;base64,BBBB' },
      { webgl: 'Apple~Apple GPU' },
      { audio: '124.044' },
      { cores: '4' },
      { memory: '4' },
      { screen: '390x844' },
      { timezone: 'Atlantic/Canary' },
    ]
    for (const v of variantes) {
      const otro = await buildFingerprint(serializeSignals({ ...base, ...v }))
      expect(otro).not.toBe(ref)
    }
  })

  it('dos móviles del MISMO modelo pero distinta GPU/canvas ya no colisionan', async () => {
    // El fallo de v1: al recortar el canvas a sus últimos 50 caracteres (el cierre del PNG, casi
    // idéntico entre equipos), dos móviles iguales por fuera caían en la misma huella. Llegó a
    // haber huellas con 83 cuentas.
    const movilA = { ...base, canvas: 'data:image/png;base64,AAAAmuchotexto1', webgl: 'Qualcomm~Adreno (TM) 640' }
    const movilB = { ...base, canvas: 'data:image/png;base64,AAAAmuchotexto2', webgl: 'Qualcomm~Adreno (TM) 650' }
    expect(await buildFingerprint(serializeSignals(movilA)))
      .not.toBe(await buildFingerprint(serializeSignals(movilB)))
  })

  it('isValidFingerprint rechaza basura, huellas v1 y longitudes raras', () => {
    expect(isValidFingerprint('hw_abc123')).toBe(false)        // v1
    expect(isValidFingerprint('fp2_XYZ')).toBe(false)          // corta
    expect(isValidFingerprint(`fp2_${'g'.repeat(32)}`)).toBe(false) // no es hex
    expect(isValidFingerprint(null)).toBe(false)
    expect(isValidFingerprint(undefined)).toBe(false)
    expect(isValidFingerprint(12345)).toBe(false)
    expect(isValidFingerprint(`fp2_${'a'.repeat(64)}`)).toBe(false) // demasiado larga
  })

  it('sin Web Crypto devuelve null — NUNCA una huella inventada', async () => {
    // Inventar una agruparía dispositivos que no tienen nada que ver, y encima con apariencia de
    // dato bueno. Es preferible no opinar.
    const real = globalThis.crypto
    // @ts-expect-error — se retira a propósito para el test
    delete globalThis.crypto
    try {
      expect(await sha256Hex('lo que sea')).toBeNull()
      expect(await buildFingerprint('lo que sea')).toBeNull()
    } finally {
      globalThis.crypto = real
    }
  })
})

/**
 * EL INVARIANTE CENTRAL: borrar el almacén NO cambia la identidad del equipo.
 *
 * Es exactamente el gesto que hacen las cuentas que rotan (borrar datos del navegador o abrir una
 * ventana de incógnito) y lo que hacía inútil al `device_id`. Si este test se pone rojo, el límite
 * por dispositivo vuelve a ser decorativo aunque todo lo demás siga verde.
 */
describe('la caché es CACHÉ, no identidad', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getDeviceFingerprint, getCachedFingerprint } = require('@/lib/security/fingerprint')

  beforeEach(() => window.localStorage.clear())

  it('borrar localStorage devuelve la MISMA huella (se recalcula del hardware)', async () => {
    const primera = await getDeviceFingerprint()
    expect(primera.fingerprint).not.toBeNull()
    expect(primera.cached).toBe(false)

    // El gesto del que rota cuentas: limpiar el navegador.
    window.localStorage.clear()

    const segunda = await getDeviceFingerprint()
    expect(segunda.cached).toBe(false)          // no vino de caché: se recalculó
    expect(segunda.fingerprint).toBe(primera.fingerprint) // …y salió idéntica
  })

  it('la segunda llamada seguida sí usa la caché (no recalcula canvas/audio)', async () => {
    const a = await getDeviceFingerprint()
    const b = await getDeviceFingerprint()
    expect(b.cached).toBe(true)
    expect(b.fingerprint).toBe(a.fingerprint)
  })

  it('llamadas concurrentes comparten el cálculo y dan el mismo valor', async () => {
    const [a, b, c] = await Promise.all([
      getDeviceFingerprint(), getDeviceFingerprint(), getDeviceFingerprint(),
    ])
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(b.fingerprint).toBe(c.fingerprint)
  })

  it('nunca se cachea una huella inválida', async () => {
    window.localStorage.setItem('vence_fp2', 'basura-no-valida')
    const r = await getDeviceFingerprint()
    expect(r.cached).toBe(false)                 // ignora la basura
    expect(isValidFingerprint(r.fingerprint)).toBe(true)
  })

  it('getCachedFingerprint no bloquea: null la primera vez, valor después', async () => {
    expect(getCachedFingerprint()).toBeNull()
    await getDeviceFingerprint()
    expect(isValidFingerprint(getCachedFingerprint())).toBe(true)
  })

  it('informa de la CALIDAD de la huella (cuántas señales fuertes hubo)', async () => {
    const r = await getDeviceFingerprint()
    expect(typeof r.strength).toBe('number')
    expect(typeof r.consistent).toBe('boolean')
  })
})
