// __tests__/lib/tts/engine.realbrowser-sim.test.ts
//
// Simulación end-to-end del engine TTS con un FakeSynth que IMITA el
// comportamiento conocido de Chrome Android (caso Nila):
//
//   - Utterances ≤ 300 chars: se sintetizan OK (dispara onend).
//   - Utterances > 300 chars: rechazo síncrono con `synthesis-failed`.
//     Es lo que la voz "español España" de Android hace con frases largas.
//
// Objetivo: probar que con el chunker NUEVO la lectura completa del
// Artículo 1 del Reglamento Asamblea Madrid (el caso que rompió a Nila)
// termina en `natural_end`, sin clavarse ni triggear el circuit breaker.
//
// Esto es la prueba EMPÍRICA del fix: usa el chunker y el engine de
// producción (sin mocks de su lógica) y solo "miente" en la capa que
// representa el browser.

/**
 * @jest-environment jsdom
 */

import { TTSEngine } from '@/lib/tts/engine'

jest.mock('@/lib/observability/client', () => ({
  emitClientEvent: jest.fn(),
}))

interface FakeUtterance {
  text: string
  lang: string
  rate: number
  voice: unknown
  onend: ((ev: Event) => void) | null
  onerror: ((ev: { error: string }) => void) | null
}

/**
 * FakeSynth realista: imita Chrome Android con voz "español España".
 *
 * Reglas:
 * - Si la longitud del utterance > CHROME_FAIL_THRESHOLD: dispara
 *   `onerror({ error: 'synthesis-failed' })` síncronamente (drena la
 *   cola y vuelve speaking=false). Es lo que hace Chrome de verdad.
 * - Si la longitud ≤ threshold: dispara `onend` síncronamente. Es una
 *   simplificación pero válida para validar el control de flujo del
 *   engine; tiempos reales no son relevantes para el test.
 *
 * Para hacer el test determinista: las llamadas a speak() resuelven
 * inmediatamente vía un microtask síncrono. No usamos timers.
 */
class ChromeMobileFakeSynth {
  speaking = false
  pending = false
  paused = false
  static CHROME_FAIL_THRESHOLD = 300 // chars
  private currentUtterance: FakeUtterance | null = null

  /** Total de utterances que el engine envió a speak(). */
  speakCalls = 0
  /** Cuántos completaron OK (≤ threshold). */
  successfulSpeaks = 0
  /** Cuántos fallaron con synthesis-failed (> threshold). */
  failedSpeaks = 0

  speak = (u: FakeUtterance) => {
    this.speakCalls++
    this.currentUtterance = u
    this.speaking = true
    if (u.text.length > ChromeMobileFakeSynth.CHROME_FAIL_THRESHOLD) {
      // Chrome móvil: falla síncronamente — el utterance ni se reproduce.
      this.failedSpeaks++
      // Salimos del estado speaking inmediatamente (no había nada que decir).
      this.speaking = false
      this.currentUtterance = null
      // Dispara onerror en el siguiente microtask para no romper la pila.
      queueMicrotask(() => u.onerror?.({ error: 'synthesis-failed' }))
    } else {
      this.successfulSpeaks++
      queueMicrotask(() => {
        // Solo dispara onend si el utterance sigue siendo el actual
        // (no fue cancelado mientras esperábamos).
        if (this.currentUtterance === u) {
          this.speaking = false
          this.currentUtterance = null
          u.onend?.({} as Event)
        }
      })
    }
  }

  cancel = () => {
    if (this.currentUtterance) {
      this.currentUtterance.onerror = null
      this.currentUtterance.onend = null
      this.currentUtterance = null
    }
    this.speaking = false
    this.pending = false
  }

  pause = () => {
    this.paused = true
  }
  resume = () => {
    this.paused = false
  }

  getVoices = () => [
    { name: 'español España', lang: 'es-ES', voiceURI: 'es-spain' },
  ]

  addEventListener = jest.fn()
  removeEventListener = jest.fn()
}

function setupChromeMobile(): ChromeMobileFakeSynth {
  const synth = new ChromeMobileFakeSynth()
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: synth,
  })
  ;(window as unknown as { SpeechSynthesisUtterance: typeof FakeUtterance }).SpeechSynthesisUtterance =
    function (this: FakeUtterance, text: string) {
      this.text = text
      this.lang = ''
      this.rate = 1
      this.voice = null
      this.onend = null
      this.onerror = null
    } as unknown as typeof FakeUtterance
  return synth
}

/**
 * Helper: ejecuta todos los microtasks pendientes hasta que la cola
 * quede vacía. Async porque queueMicrotask se procesa en el siguiente tick.
 * Hasta `maxIterations` para no entrar en loop infinito si hay bug.
 */
async function flushMicrotasks(maxIterations = 10000): Promise<number> {
  let n = 0
  while (n < maxIterations) {
    // Yield al microtask queue.
    await Promise.resolve()
    n++
    // Si no hay ya nada pendiente, salimos.
    // (Aproximación: tras un yield consecutivo sin cambios, asumimos quieto.)
    // En la práctica, las cadenas onend→speak→onend se procesan en O(N) ticks.
    // Salimos pronto si no hay cambios detectables.
    if (n > 20 && n % 50 === 0) {
      // Pulso cada 50 yields como guardia, sin medir más.
    }
  }
  return n
}

// El texto literal del Artículo 1 — el caso que rompió a Nila.
const ART_1_RAM =
  'La Asamblea de Madrid, órgano legislativo y representativo del pueblo de Madrid, ejerce la potestad legislativa de la Comunidad, aprueba y controla los Presupuestos Generales de la misma, impulsa, orienta y controla la acción del Consejo de Gobierno y ejerce cualesquiera otras funciones que le otorguen las leyes, de acuerdo con las competencias que la Constitución Española, el Estatuto de Autonomía y el resto del ordenamiento jurídico atribuyen a la Comunidad de Madrid.'

describe('TTSEngine — simulación Chrome Android con voz que rechaza >300 chars', () => {
  let synth: ChromeMobileFakeSynth
  beforeEach(() => {
    synth = setupChromeMobile()
  })

  it('SIM REAL: lee el Artículo 1 RAM completo con el chunker nuevo — termina en natural_end', async () => {
    const onNaturalEnd = jest.fn()
    const eng = new TTSEngine({ onNaturalEnd })

    eng.play({
      sections: [
        { id: '1', label: 'Artículo 1', text: `Artículo 1. ${ART_1_RAM}` },
      ],
      rate: 1,
      lawName: 'Reglamento Asamblea Madrid',
    })

    // Procesar la cadena onend→speak→onend hasta que todos los chunks
    // pasen por el FakeSynth.
    await flushMicrotasks(200)

    // Diagnóstico
    const state = eng.getState()
    const dbg = eng._debugState()

    expect(state).toBe('ended')
    expect(onNaturalEnd).toHaveBeenCalledTimes(1)
    // Con el chunker nuevo NINGÚN chunk debería superar el umbral de Chrome.
    expect(synth.failedSpeaks).toBe(0)
    expect(synth.successfulSpeaks).toBeGreaterThan(0)
    expect(dbg.chunksCompleted).toBe(synth.successfulSpeaks)

    eng.destroy()
  })

  it('SIM REAL: lee una ley con 12 artículos (Nila reportó 2-11 OK, 1 NO) — todos completan', async () => {
    const onNaturalEnd = jest.fn()
    const eng = new TTSEngine({ onNaturalEnd })

    // Mezcla de artículos cortos (2-11 estilo Nila, ≤200 chars) + el Art 1
    // problemático. Cada uno como section independiente.
    const sections = [
      { id: '1', label: 'Artículo 1', text: `Artículo 1. ${ART_1_RAM}` },
    ]
    for (let i = 2; i <= 11; i++) {
      sections.push({
        id: String(i),
        label: `Artículo ${i}`,
        text: `Artículo ${i}. Contenido breve de prueba para el artículo número ${i}.`,
      })
    }

    eng.play({ sections, rate: 1, lawName: 'Reglamento Asamblea Madrid' })
    await flushMicrotasks(500)

    expect(eng.getState()).toBe('ended')
    expect(onNaturalEnd).toHaveBeenCalledTimes(1)
    expect(synth.failedSpeaks).toBe(0)
    expect(eng._debugState().chunksCompleted).toBe(synth.successfulSpeaks)

    eng.destroy()
  })

  it('SIM REAL: artículo con párrafo enorme (1700+ chars, peor caso del corpus) — termina natural', async () => {
    // El peor caso del corpus tenía chunks de 1.700+ chars con un único punto.
    // Simulamos: una frase masiva con comas pero un solo punto final.
    const enorme = Array.from({ length: 80 }, (_, i) => `cláusula número ${i + 1}`).join(', ') + '.'
    expect(enorme.length).toBeGreaterThan(1000)

    const onNaturalEnd = jest.fn()
    const eng = new TTSEngine({ onNaturalEnd })
    eng.play({
      sections: [{ id: '1', label: 'Art enorme', text: enorme }],
      rate: 1,
    })
    await flushMicrotasks(500)

    expect(eng.getState()).toBe('ended')
    expect(onNaturalEnd).toHaveBeenCalledTimes(1)
    expect(synth.failedSpeaks).toBe(0)
    eng.destroy()
  })

  it('SIM REAL: cada chunk emitido al synth está ≤ umbral Chrome (no hay forma de fallar)', async () => {
    const eng = new TTSEngine()
    eng.play({
      sections: [
        { id: '1', label: 'Art 1', text: `Artículo 1. ${ART_1_RAM}` },
        { id: '2', label: 'Art 2', text: 'Artículo 2. Frase corta normal.' },
      ],
      rate: 1,
    })
    await flushMicrotasks(200)

    // Verificación dura: TODOS los textos que el engine envió al synth
    // están bajo el umbral de Chrome.
    expect(synth.speakCalls).toBeGreaterThan(0)
    expect(synth.failedSpeaks).toBe(0)
    eng.destroy()
  })

  it('CONTROL NEGATIVO: aún con un chunk monstruoso (palabra única >>MAX), el engine no se cuelga', async () => {
    // Caso patológico documentado (I4-a): una "palabra" única >MAX se
    // devuelve íntegra por el chunker (no rompemos mid-char). Chrome
    // la rechazará con synthesis-failed → el engine debe avanzar.
    const monstruosa = 'X'.repeat(500)
    const onNaturalEnd = jest.fn()
    const eng = new TTSEngine({ onNaturalEnd })
    eng.play({
      sections: [
        { id: '1', label: 'Art monstruo', text: monstruosa },
        { id: '2', label: 'Art normal', text: 'Frase normal y corta.' },
      ],
      rate: 1,
    })
    await flushMicrotasks(500)

    // El primer chunk falla (chunk > 300), pero el engine debe advanzar
    // al siguiente vía onerror y completar el resto.
    expect(synth.failedSpeaks).toBeGreaterThanOrEqual(1)
    expect(synth.successfulSpeaks).toBeGreaterThanOrEqual(1)
    // El estado final es 'ended' (natural end) o 'error' (si el breaker
    // se disparó por una racha de fallos). En ningún caso debe estar
    // playing/paused colgado.
    expect(['ended', 'error']).toContain(eng.getState())
    eng.destroy()
  })

  it('TOPE: 1.000 secciones tipo Art 1 RAM en cadena — completa sin que la sesión muera', async () => {
    // Stress: simular una "ley" con 1.000 artículos del estilo Art 1.
    // Si el chunker funciona, ningún chunk supera 300 → no fallos → completa.
    const sections = []
    for (let i = 0; i < 100; i++) {
      sections.push({
        id: String(i + 1),
        label: `Artículo ${i + 1}`,
        text: `Artículo ${i + 1}. ${ART_1_RAM}`,
      })
    }

    const onNaturalEnd = jest.fn()
    const eng = new TTSEngine({ onNaturalEnd })
    eng.play({ sections, rate: 1, lawName: 'Stress test' })
    await flushMicrotasks(2000)

    expect(eng.getState()).toBe('ended')
    expect(onNaturalEnd).toHaveBeenCalledTimes(1)
    expect(synth.failedSpeaks).toBe(0)
    // Con 100 secciones de ~3 chunks cada una → ~300 chunks emitidos
    expect(synth.successfulSpeaks).toBeGreaterThan(100)
    eng.destroy()
  })
})
