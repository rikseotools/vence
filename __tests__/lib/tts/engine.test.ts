// __tests__/lib/tts/engine.test.ts
//
// Tests del TTSEngine. Mockea SpeechSynthesis para verificar:
//   - play() arranca chunks desde 0 con texto nuevo
//   - resume desde paused: usa el chunk guardado, NO desde 0
//   - resume desde stopped/ended con MISMO texto: canResume=true, retoma
//   - resume desde ended habiendo llegado al final: reinicia desde 0
//   - Idempotencia NATURAL_END: si onend dispara dos veces, NO se llama
//     a onNaturalEnd dos veces (fix del bucle de Nila)
//
// La telemetría está mockeada — los tests de taxonomía viven en telemetry.test.ts.

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

class FakeSynth {
  speaking = false
  pending = false
  paused = false
  private queue: FakeUtterance[] = []
  private listeners = new Map<string, Set<EventListener>>()

  speak = jest.fn((u: FakeUtterance) => {
    this.queue.push(u)
    this.speaking = true
    this.pending = false
  })

  cancel = jest.fn(() => {
    // En real browser, cancel triggers onerror 'interrupted' en utterances
    // activas. Aquí lo simulamos para los que aún están en queue.
    for (const u of this.queue) {
      // El engine pone onerror=null antes de cancel para no honrar el evento,
      // pero por consistencia con browser-real, intentamos dispararlo.
      u.onerror?.({ error: 'interrupted' })
    }
    this.queue.length = 0
    this.speaking = false
    this.pending = false
  })

  pause = jest.fn(() => {
    this.paused = true
  })

  resume = jest.fn(() => {
    this.paused = false
  })

  getVoices = jest.fn(() => [
    { name: 'Google Español', lang: 'es-ES', voiceURI: 'google-es' },
    { name: 'Spanish (Spain)', lang: 'es-ES', voiceURI: 'spanish-es' },
  ])

  addEventListener = jest.fn((event: string, listener: EventListener) => {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
  })

  removeEventListener = jest.fn(
    (event: string, listener: EventListener) => {
      this.listeners.get(event)?.delete(listener)
    },
  )

  // ─── Test helpers (no parte de la API real de SpeechSynthesis) ──────

  /** Simula que el utterance en cabeza terminó natural → dispara onend. */
  completeFirst(): void {
    const u = this.queue.shift()
    if (!u) return
    if (this.queue.length === 0) this.speaking = false
    u.onend?.({} as Event)
  }

  /** Cuántos utterances quedan pendientes (cola interna). */
  pendingCount(): number {
    return this.queue.length
  }

  /** Acceso al utterance en cabeza (para tests). */
  peek(): FakeUtterance | undefined {
    return this.queue[0]
  }

  /** Dispara onend DOS veces para el mismo utterance — bug Chrome onend duplicado. */
  fireDuplicateOnend(): void {
    const u = this.queue[0]
    if (!u) return
    u.onend?.({} as Event)
    u.onend?.({} as Event)
  }
}

function setupSynth(): FakeSynth {
  const synth = new FakeSynth()
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: synth,
  })
  // SpeechSynthesisUtterance shim
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

describe('TTSEngine', () => {
  let synth: FakeSynth

  beforeEach(() => {
    synth = setupSynth()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  it('arranca en estado idle', () => {
    const eng = new TTSEngine()
    expect(eng.getState()).toBe('idle')
    expect(eng.getSnapshot().canResume).toBe(false)
    eng.destroy()
  })

  it('play() transiciona a playing y reproduce primer chunk', () => {
    const eng = new TTSEngine()
    eng.play({
      text: 'Frase uno. Frase dos. Frase tres.',
      rate: 1,
    })
    expect(eng.getState()).toBe('playing')
    expect(synth.speak).toHaveBeenCalledTimes(1)
    eng.destroy()
  })

  it('avanza chunks al disparar onend natural', () => {
    const eng = new TTSEngine()
    // Texto largo: forzamos varios chunks (cada chunk ≤250 chars)
    const text = Array.from({ length: 5 }, (_, i) =>
      `Artículo ${i + 1}. Lorem ipsum dolor sit amet consectetur adipiscing.`,
    ).join(' ')
    eng.play({ text, rate: 1 })
    expect(synth.speak).toHaveBeenCalledTimes(1)
    synth.completeFirst()
    expect(synth.speak).toHaveBeenCalledTimes(2)
    eng.destroy()
  })

  it('llama onNaturalEnd UNA SOLA VEZ tras completar todos los chunks', () => {
    const onNaturalEnd = jest.fn()
    const eng = new TTSEngine({ onNaturalEnd })
    eng.play({ text: 'Sola frase.', rate: 1 })
    // Completar el único chunk
    synth.completeFirst()
    // Engine debería haber transicionado a ended
    expect(eng.getState()).toBe('ended')
    expect(onNaturalEnd).toHaveBeenCalledTimes(1)
    eng.destroy()
  })

  it('FIX BUCLE: onend duplicado no re-dispara onNaturalEnd', () => {
    const onNaturalEnd = jest.fn()
    const eng = new TTSEngine({ onNaturalEnd })
    eng.play({ text: 'Sola frase.', rate: 1 })
    // Bug Chrome: onend dispara dos veces para el mismo utterance.
    // El engine pone onend=null en cancelCurrent, pero la primera vez
    // el handler está vivo. La segunda llamada (si Chrome la hace antes
    // de que limpiemos) entra en speakChunk(1) → natural end. La SM
    // ya está en `ended`, transición NATURAL_END devuelve null → no
    // re-llamamos onNaturalEnd.
    synth.fireDuplicateOnend()
    expect(onNaturalEnd).toHaveBeenCalledTimes(1)
    expect(eng.getState()).toBe('ended')
    eng.destroy()
  })

  it('pause + resume mantiene chunk actual (canResume=true mientras paused)', () => {
    const eng = new TTSEngine()
    const text = 'Frase uno. Frase dos. Frase tres. Frase cuatro.'
    eng.play({ text, rate: 1 })
    expect(eng.getState()).toBe('playing')
    eng.pause()
    expect(eng.getState()).toBe('paused')
    expect(eng.getSnapshot().canResume).toBe(true)
    eng.resume()
    expect(eng.getState()).toBe('playing')
    eng.destroy()
  })

  it('stop a mitad → canResume=true si quedan chunks por leer', () => {
    const eng = new TTSEngine()
    // Forzamos varios chunks
    const text = Array.from({ length: 5 }, (_, i) =>
      `Frase número ${i + 1} con texto bastante extenso para llegar al límite del chunk MAX para que se parta en varios.`,
    ).join(' ')
    eng.play({ text, rate: 1 })
    // Avanzamos un chunk para que currentChunkIdx > 0
    synth.completeFirst()
    eng.stop()
    expect(eng.getState()).toBe('stopped')
    // canResume debería ser true porque paramos con chunks pendientes
    expect(eng.getSnapshot().canResume).toBe(true)
    eng.destroy()
  })

  it('FIX RESUME: play() tras stop con MISMO texto retoma desde chunk guardado', () => {
    const eng = new TTSEngine()
    const text = Array.from({ length: 5 }, (_, i) =>
      `Frase número ${i + 1} con texto bastante extenso para llegar al límite del chunk MAX para que se parta en varios.`,
    ).join(' ')
    eng.play({ text, rate: 1 })
    synth.completeFirst()
    synth.completeFirst()
    const idxBeforeStop = eng._debugState().currentChunkIdx
    expect(idxBeforeStop).toBeGreaterThan(0)
    eng.stop()
    // Volver a play con MISMO texto → debe retomar desde idxBeforeStop
    eng.play({ text, rate: 1 })
    expect(eng._debugState().currentChunkIdx).toBe(idxBeforeStop)
    expect(eng.getState()).toBe('playing')
    eng.destroy()
  })

  it('play() con texto DIFERENTE tras stop arranca desde chunk 0', () => {
    const eng = new TTSEngine()
    eng.play({ text: 'Texto uno. Frase dos.', rate: 1 })
    synth.completeFirst()
    eng.stop()
    eng.play({ text: 'Texto totalmente diferente. Otra frase.', rate: 1 })
    expect(eng._debugState().currentChunkIdx).toBe(0)
    eng.destroy()
  })

  it('play() tras natural end con MISMO texto reinicia desde 0 (ya completó todo)', () => {
    const eng = new TTSEngine()
    eng.play({ text: 'Sola frase.', rate: 1 })
    synth.completeFirst() // natural end
    expect(eng.getState()).toBe('ended')
    eng.play({ text: 'Sola frase.', rate: 1 })
    expect(eng._debugState().currentChunkIdx).toBe(0)
    expect(eng.getState()).toBe('playing')
    eng.destroy()
  })

  it('setRate en caliente cancela + relanza chunk actual con el nuevo rate', () => {
    const eng = new TTSEngine()
    eng.play({ text: 'Frase uno. Frase dos.', rate: 1 })
    const callsBefore = synth.speak.mock.calls.length
    eng.setRate(1.5)
    // setRate debería haber lanzado cancel + speak nuevo
    expect(synth.cancel).toHaveBeenCalled()
    expect(synth.speak.mock.calls.length).toBeGreaterThan(callsBefore)
    eng.destroy()
  })

  it('FIX SILENCIO: setRate con el MISMO valor es no-op (no cancela el chunk vivo)', () => {
    const eng = new TTSEngine()
    eng.play({ text: 'Frase uno. Frase dos.', rate: 1 })
    const callsBefore = synth.speak.mock.calls.length
    const cancelsBefore = synth.cancel.mock.calls.length
    eng.setRate(1) // mismo valor que ya tenía
    expect(synth.cancel.mock.calls.length).toBe(cancelsBefore)
    expect(synth.speak.mock.calls.length).toBe(callsBefore)
    eng.destroy()
  })

  it('FIX SILENCIO: setVoice con el MISMO valor es no-op', () => {
    const eng = new TTSEngine()
    eng.play({ text: 'Frase uno. Frase dos.', rate: 1, voiceURI: null })
    const callsBefore = synth.speak.mock.calls.length
    const cancelsBefore = synth.cancel.mock.calls.length
    eng.setVoice(null) // mismo valor
    expect(synth.cancel.mock.calls.length).toBe(cancelsBefore)
    expect(synth.speak.mock.calls.length).toBe(callsBefore)
    eng.destroy()
  })

  it('destroy() libera recursos y bloquea callbacks futuros', () => {
    const onNaturalEnd = jest.fn()
    const eng = new TTSEngine({ onNaturalEnd })
    eng.play({ text: 'Frase uno.', rate: 1 })
    eng.destroy()
    // Tras destroy, ya no responde
    eng.play({ text: 'Otra frase.', rate: 1 })
    expect(eng._debugState().destroyed).toBe(true)
  })

  describe('Navegación por sections (artículos)', () => {
    const SECTIONS = [
      { id: '1', label: 'Artículo 1', text: 'Frase uno. Frase dos. Frase tres.' },
      { id: '2', label: 'Artículo 2', text: 'Otra frase larga. Y otra más para forzar varios chunks aquí.' },
      { id: '3', label: 'Artículo 3', text: 'Tercer artículo bien sencillo. Final.' },
    ]

    it('snapshot expone currentSection cuando se reproduce con sections', () => {
      const eng = new TTSEngine()
      eng.play({ sections: SECTIONS, rate: 1, lawName: 'Test Law' })
      const snap = eng.getSnapshot()
      expect(snap.currentSection).not.toBeNull()
      expect(snap.currentSection?.idx).toBe(0)
      expect(snap.currentSection?.label).toBe('Artículo 1')
      expect(snap.currentSection?.total).toBe(3)
      expect(snap.lawName).toBe('Test Law')
      eng.destroy()
    })

    it('nextSection() salta al primer chunk de la siguiente sección', () => {
      const eng = new TTSEngine()
      eng.play({ sections: SECTIONS, rate: 1 })
      expect(eng.getSnapshot().currentSection?.idx).toBe(0)
      eng.nextSection()
      expect(eng.getSnapshot().currentSection?.idx).toBe(1)
      eng.nextSection()
      expect(eng.getSnapshot().currentSection?.idx).toBe(2)
      // En la última no avanza
      eng.nextSection()
      expect(eng.getSnapshot().currentSection?.idx).toBe(2)
      eng.destroy()
    })

    it('previousSection() retrocede a la sección anterior', () => {
      const eng = new TTSEngine()
      eng.play({ sections: SECTIONS, rate: 1 })
      eng.nextSection()
      eng.nextSection()
      expect(eng.getSnapshot().currentSection?.idx).toBe(2)
      eng.previousSection()
      expect(eng.getSnapshot().currentSection?.idx).toBe(1)
      eng.destroy()
    })

    it('restartLaw() vuelve al chunk 0', () => {
      const eng = new TTSEngine()
      eng.play({ sections: SECTIONS, rate: 1 })
      eng.nextSection()
      eng.nextSection()
      expect(eng._debugState().currentChunkIdx).toBeGreaterThan(0)
      eng.restartLaw()
      expect(eng._debugState().currentChunkIdx).toBe(0)
      eng.destroy()
    })

    it('seekPercent(0.5) salta a ~mitad de chunks', () => {
      const eng = new TTSEngine()
      eng.play({ sections: SECTIONS, rate: 1 })
      const totalChunks = (eng.getSnapshot().progress.totalChunks)
      eng.seekPercent(0.5)
      const after = eng._debugState().currentChunkIdx
      expect(after).toBe(Math.floor(0.5 * totalChunks))
      eng.destroy()
    })

    it('back-compat: play({text}) crea una única sección', () => {
      const eng = new TTSEngine()
      eng.play({ text: 'Hola mundo. Frase dos.', rate: 1 })
      const snap = eng.getSnapshot()
      expect(snap.currentSection?.total).toBe(1)
      eng.destroy()
    })
  })
})
