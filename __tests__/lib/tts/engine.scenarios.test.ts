// __tests__/lib/tts/engine.scenarios.test.ts
//
// Escenarios end-to-end del TTSEngine que simulan fallos reales de
// browser observados con Nila (Chrome Android, voz "español España"):
//
//   - Chunk muerto + watchdog retry hasta skip
//   - Cascada de synthesis-failed mid-session
//   - Mezcla de éxitos y fallos transitorios sin disparar el breaker
//   - Reanudación tras error: progreso preservado
//   - Bucle infinito hipotético del bug previo (NO debe ocurrir tras el fix)
//
// Los tests unitarios viven en engine.test.ts. Aquí los tests de
// "comportamiento del sistema completo bajo fallos".

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

  speak = jest.fn((u: FakeUtterance) => {
    this.queue.push(u)
    this.speaking = true
    this.pending = false
  })

  cancel = jest.fn(() => {
    for (const u of this.queue) u.onerror?.({ error: 'interrupted' })
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
  ])

  addEventListener = jest.fn()
  removeEventListener = jest.fn()

  completeFirst(): void {
    const u = this.queue.shift()
    if (!u) return
    if (this.queue.length === 0) this.speaking = false
    u.onend?.({} as Event)
  }

  failFirst(errorType = 'synthesis-failed'): void {
    const u = this.queue.shift()
    if (!u) return
    if (this.queue.length === 0) this.speaking = false
    u.onerror?.({ error: errorType })
  }

  /** Mata silenciosamente al synth: ni habla ni tiene cola pending. */
  kill(): void {
    this.speaking = false
    this.pending = false
  }
}

function setupSynth(): FakeSynth {
  const synth = new FakeSynth()
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

// Texto con MUCHAS frases largas → produce ≥30 chunks. Cada frase ronda
// los 220-240 chars para que el chunker emita ~1 chunk por frase.
const TEXT_30_CHUNKS = Array.from(
  { length: 60 },
  (_, i) =>
    `Frase número ${i + 1} con texto suficientemente extenso para forzar la creación de al menos un chunk independiente en el motor TTS. Contiene varias palabras adicionales para acercarse al límite de tamaño.`,
).join(' ')

describe('TTSEngine — escenarios de fallo realista', () => {
  let synth: FakeSynth
  beforeEach(() => {
    synth = setupSynth()
  })

  describe('Escenario A: chunk muerto en mitad de la sesión', () => {
    it('chunk 5 muere → watchdog retry x2 → skip → continúa en chunk 6', () => {
      const eng = new TTSEngine()
      eng.play({ text: TEXT_30_CHUNKS, rate: 1 })

      // Avanzar hasta chunk 5 con éxito
      for (let i = 0; i < 5; i++) synth.completeFirst()
      expect(eng._debugState().currentChunkIdx).toBe(5)

      // Chrome bug: el chunk 5 se queda colgado sin onend
      synth.kill()
      eng._debugTickWatchdog() // retry 1
      synth.kill()
      eng._debugTickWatchdog() // retry 2
      synth.kill()
      eng._debugTickWatchdog() // skip → chunk 6

      expect(eng._debugState().currentChunkIdx).toBe(6)
      expect(eng._debugState().chunksSkipped).toBe(1)
      expect(eng.getState()).toBe('playing')

      eng.destroy()
    })

    it('múltiples chunks muertos seguidos — engine sigue avanzando, no se cuelga', () => {
      const eng = new TTSEngine()
      eng.play({ text: TEXT_30_CHUNKS, rate: 1 })

      // Tres chunks consecutivos quedan colgados.
      for (let chunkN = 0; chunkN < 3; chunkN++) {
        synth.kill()
        eng._debugTickWatchdog()
        synth.kill()
        eng._debugTickWatchdog()
        synth.kill()
        eng._debugTickWatchdog() // skip → siguiente chunk
      }

      expect(eng._debugState().currentChunkIdx).toBe(3)
      expect(eng._debugState().chunksSkipped).toBe(3)
      expect(eng.getState()).toBe('playing')
      eng.destroy()
    })
  })

  describe('Escenario B: cascada de synthesis-failed', () => {
    it('5 errores seguidos → breaker → state=error', () => {
      const eng = new TTSEngine()
      eng.play({ text: TEXT_30_CHUNKS, rate: 1 })
      for (let i = 0; i < 5; i++) synth.failFirst('synthesis-failed')
      expect(eng.getState()).toBe('error')
      expect(eng.getSnapshot().lastError).not.toBeNull()
      eng.destroy()
    })

    it('4 errores + 1 onend OK + 4 errores → NO breaker, sesión sigue', () => {
      const eng = new TTSEngine()
      eng.play({ text: TEXT_30_CHUNKS, rate: 1 })
      for (let i = 0; i < 4; i++) synth.failFirst('synthesis-failed')
      synth.completeFirst() // resetea consecutiveChunkErrors
      for (let i = 0; i < 4; i++) synth.failFirst('synthesis-failed')
      expect(eng.getState()).toBe('playing')
      eng.destroy()
    })
  })

  describe('Escenario C: bucle infinito prevenido (regresión del bug Nila)', () => {
    it('100 ticks de watchdog sobre chunks muertos NO dejan al engine clavado en chunk 0', () => {
      // Pre-fix: speakChunk reseteaba watchdogRetries → el skip nunca
      // disparaba → el engine se quedaba en chunk 0 indefinidamente.
      // Post-fix: cada 3 ticks salta al siguiente, así que en 100 ticks
      // habremos avanzado mucho.
      const eng = new TTSEngine()
      eng.play({ text: TEXT_30_CHUNKS, rate: 1 })

      for (let i = 0; i < 100; i++) {
        synth.kill()
        eng._debugTickWatchdog()
      }

      const finalIdx = eng._debugState().currentChunkIdx
      // En 100 ticks con 3 ticks/skip deberíamos haber recorrido ~33 chunks
      // o haber llegado a natural_end. Lo que NO puede pasar es seguir en 0.
      expect(finalIdx).toBeGreaterThan(5)
      eng.destroy()
    })

    it('contador watchdogRetries NUNCA crece sin límite en chunk vivo', () => {
      // Si el contador sigue sin resetear cuando el chunk avanza, podríamos
      // tener un contador desbocado. Verificamos que onend lo resetea por
      // la vía indirecta (índice cambia → reset).
      const eng = new TTSEngine()
      eng.play({ text: TEXT_30_CHUNKS, rate: 1 })

      // Subir el contador con un par de retries
      synth.kill()
      eng._debugTickWatchdog()
      synth.kill()
      eng._debugTickWatchdog()
      expect(eng._debugState().watchdogRetries).toBe(2)

      // Ahora el chunk completa correctamente → reset
      synth.completeFirst()
      expect(eng._debugState().watchdogRetries).toBe(0)
      expect(eng._debugState().currentChunkIdx).toBe(1)

      eng.destroy()
    })
  })

  describe('Escenario D: reanudación tras error/stop', () => {
    it('error mid-session → play() de nuevo → reanuda en el chunk donde se cortó la sesión', () => {
      const eng = new TTSEngine()
      eng.play({ text: TEXT_30_CHUNKS, rate: 1 })

      // Avanzamos 10 chunks con éxito
      for (let i = 0; i < 10; i++) synth.completeFirst()
      expect(eng._debugState().currentChunkIdx).toBe(10)

      // Cascada → breaker. Cada onerror llama a speakChunk(idx+1) salvo
      // el 5o (donde dispara el breaker), así el índice avanza 4 veces.
      for (let i = 0; i < 5; i++) synth.failFirst('synthesis-failed')
      expect(eng.getState()).toBe('error')
      const idxAtCrash = eng._debugState().currentChunkIdx
      expect(idxAtCrash).toBeGreaterThan(10)

      // Reanudar con MISMO texto → resume desde la posición donde murió
      eng.play({ text: TEXT_30_CHUNKS, rate: 1 })
      expect(eng._debugState().currentChunkIdx).toBe(idxAtCrash)
      expect(eng.getState()).toBe('playing')
      // Y el lastError se limpia para no dejar mensaje stale
      expect(eng.getSnapshot().lastError).toBeNull()
      eng.destroy()
    })
  })

  describe('Escenario E: secciones (artículos) — navegación bajo fallos', () => {
    const SECTIONS = [
      { id: '1', label: 'Art 1', text: 'Frase A. Frase B. Frase C.' },
      { id: '2', label: 'Art 2', text: 'Otra A. Otra B.' },
      { id: '3', label: 'Art 3', text: 'Tercer A. Tercer B.' },
    ]

    it('chunk muerto en sección 0 → skip → entra en sección 1 sin perder lawName', () => {
      const eng = new TTSEngine()
      eng.play({ sections: SECTIONS, rate: 1, lawName: 'Test Law' })
      expect(eng.getSnapshot().currentSection?.idx).toBe(0)

      // Matar el primer chunk
      synth.kill()
      eng._debugTickWatchdog()
      synth.kill()
      eng._debugTickWatchdog()
      synth.kill()
      eng._debugTickWatchdog() // skip → chunk 1 de sección 0

      expect(eng._debugState().chunksSkipped).toBe(1)
      expect(eng.getSnapshot().lawName).toBe('Test Law')
      eng.destroy()
    })

    it('CHAIN: ley con un chunk skipped llega a natural_end y onNaturalEnd dispara una vez', () => {
      // Verificación específica para el chain context: aunque haya skips
      // por watchdog en medio de la ley, la sesión debe alcanzar el
      // natural_end y disparar onNaturalEnd exactamente UNA vez. Si esto
      // no ocurriera, TTSChainContext nunca encadenaría a la siguiente ley.
      const onNaturalEnd = jest.fn()
      const eng = new TTSEngine({ onNaturalEnd })

      // Ley pequeña: 2 secciones de ~1 chunk cada una.
      eng.play({
        sections: [
          { id: '1', label: 'Art 1', text: 'Frase única corta.' },
          { id: '2', label: 'Art 2', text: 'Otra frase corta única.' },
        ],
        rate: 1,
      })

      // Saltar el chunk 0 vía watchdog (retry x2 + skip)
      synth.kill()
      eng._debugTickWatchdog()
      synth.kill()
      eng._debugTickWatchdog()
      synth.kill()
      eng._debugTickWatchdog()

      // Tras el skip estamos en chunk 1 — speakChunk ya disparó speak().
      // Completar el chunk 1 → natural_end
      synth.completeFirst()

      expect(eng.getState()).toBe('ended')
      expect(onNaturalEnd).toHaveBeenCalledTimes(1)
      expect(eng._debugState().chunksSkipped).toBe(1)

      eng.destroy()
    })

    it('restartLaw → vuelve a chunk 0 y resetea contador watchdog', () => {
      const eng = new TTSEngine()
      eng.play({ sections: SECTIONS, rate: 1, lawName: 'Test Law' })

      // Avanzar manualmente con éxito hasta tener idx > 0
      synth.completeFirst()
      synth.completeFirst()
      expect(eng._debugState().currentChunkIdx).toBeGreaterThan(0)

      // Subir el contador del watchdog
      synth.kill()
      eng._debugTickWatchdog()
      const retriesBefore = eng._debugState().watchdogRetries
      expect(retriesBefore).toBeGreaterThan(0)

      // restartLaw → chunk 0 → reset (índice distinto)
      eng.restartLaw()
      expect(eng._debugState().currentChunkIdx).toBe(0)
      expect(eng._debugState().watchdogRetries).toBe(0)
      eng.destroy()
    })
  })

  describe('Escenario F: zombie chunk (synth.speaking=true pero nunca termina)', () => {
    it('camino dead (synth no habla) → retry x2 + skip — equivalente al zombie', () => {
      // El camino 'dead' (synth.speaking=false) usa idéntica handleDeadOrZombie
      // que el camino 'zombie'. Verificado aquí.
      const eng = new TTSEngine()
      eng.play({ text: TEXT_30_CHUNKS, rate: 1 })

      synth.kill()
      eng._debugTickWatchdog()
      synth.kill()
      eng._debugTickWatchdog()
      synth.kill()
      eng._debugTickWatchdog()

      expect(eng._debugState().chunksSkipped).toBe(1)
      eng.destroy()
    })

    it('zombie REAL: synth.speaking=true + Date.now avanza >30s → retry x2 + skip', () => {
      // Mockeamos Date.now() para simular el paso del tiempo sin esperarlo.
      const realDateNow = Date.now
      let fakeNow = 1_000_000_000
      Date.now = () => fakeNow

      try {
        const eng = new TTSEngine()
        eng.play({ text: TEXT_30_CHUNKS, rate: 1 })
        // El engine arranca el chunk 0: chunkStartTime = fakeNow.

        // Avanzamos el reloj 31s sin que el utterance dispare onend.
        // synth.speaking sigue en true (no llamamos a kill ni completeFirst).
        fakeNow += 31_000

        // 1er tick: detecta zombie (chunkAge > 30s) → retry chunk 0
        eng._debugTickWatchdog()
        expect(eng._debugState().currentChunkIdx).toBe(0)
        expect(eng._debugState().watchdogRetries).toBe(1)

        // 2o tick: el retry "reinició" el chunkStartTime → tenemos que
        // avanzar el reloj otra vez para que sea zombie de nuevo.
        fakeNow += 31_000
        eng._debugTickWatchdog()
        expect(eng._debugState().watchdogRetries).toBe(2)

        // 3er tick: SKIP → chunk 1
        fakeNow += 31_000
        eng._debugTickWatchdog()
        expect(eng._debugState().currentChunkIdx).toBe(1)
        expect(eng._debugState().chunksSkipped).toBe(1)
        // Al avanzar de chunk, el contador se resetea
        expect(eng._debugState().watchdogRetries).toBe(0)

        eng.destroy()
      } finally {
        Date.now = realDateNow
      }
    })

    it('zombie NO dispara si chunkAge ≤ 30s aunque synth.speaking=true', () => {
      // Verificamos el límite: 29s NO debe disparar el watchdog zombie.
      const realDateNow = Date.now
      let fakeNow = 2_000_000_000
      Date.now = () => fakeNow

      try {
        const eng = new TTSEngine()
        eng.play({ text: TEXT_30_CHUNKS, rate: 1 })

        // Avanzar solo 29s — bajo el umbral CHUNK_ZOMBIE_TIMEOUT_MS=30s.
        fakeNow += 29_000
        eng._debugTickWatchdog()

        // No debe haber retry ni skip
        expect(eng._debugState().currentChunkIdx).toBe(0)
        expect(eng._debugState().watchdogRetries).toBe(0)
        expect(eng._debugState().chunksSkipped).toBe(0)

        eng.destroy()
      } finally {
        Date.now = realDateNow
      }
    })
  })
})
