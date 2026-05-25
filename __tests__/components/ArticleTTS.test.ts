// __tests__/components/ArticleTTS.test.ts
//
// Tests de la capa UI ArticleTTS + checks de integración con temarios.
// La lógica de TTS está en `lib/tts/*` — sus tests viven en
// `__tests__/lib/tts/*.test.ts`. Aquí verificamos:
//
//   - El componente se monta sin lógica duplicada (ya no tiene watchdog,
//     state machine, chunker — todo eso se delega a useTTS).
//   - Sigue habiendo TTS en TODOS los TopicContentView del temario.

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const SRC = fs.readFileSync(
  path.join(ROOT, 'components/ArticleTTS.tsx'),
  'utf-8',
)
const ENGINE_SRC = fs.readFileSync(
  path.join(ROOT, 'lib/tts/engine.ts'),
  'utf-8',
)

// ============================================
// 1. ArticleTTS es UI pura sobre useTTS
// ============================================
describe('ArticleTTS — UI pura sobre useTTS', () => {
  it('importa useTTS de lib/tts', () => {
    expect(SRC).toMatch(/from '@\/lib\/tts\/useTTS'/)
  })

  it('NO contiene state machine ni watchdog (delegado al engine)', () => {
    expect(SRC).not.toMatch(/watchdogRef/)
    expect(SRC).not.toMatch(/startWatchdog/)
    expect(SRC).not.toMatch(/playingRef/)
    expect(SRC).not.toMatch(/stoppedRef/)
    expect(SRC).not.toMatch(/pausedRef/)
    expect(SRC).not.toMatch(/MAX_WATCHDOG_RETRIES/)
  })

  it('NO contiene splitIntoChunks (delegado a lib/tts/chunker)', () => {
    expect(SRC).not.toMatch(/function splitIntoChunks/)
    expect(SRC).not.toMatch(/MAX_CHUNK_LENGTH/)
  })

  it('NO contiene cleanText inline (delegado al engine)', () => {
    // El cleanText vive en lib/tts/chunker
    expect(SRC).not.toMatch(/function cleanText/)
  })

  it('expone botones Escuchar/Continuar/Pausar/Parar + select de rate', () => {
    expect(SRC).toMatch(/Escuchar/)
    expect(SRC).toMatch(/Continuar/)
    expect(SRC).toMatch(/Pausar/)
    expect(SRC).toMatch(/Parar/)
    expect(SRC).toMatch(/<select/)
  })

  it('usa canResume para etiquetar el botón principal', () => {
    expect(SRC).toMatch(/canResume/)
  })

  it('persiste rate y voiceURI en localStorage', () => {
    expect(SRC).toMatch(/TTS_RATE_STORAGE_KEY/)
    expect(SRC).toMatch(/TTS_VOICE_STORAGE_KEY/)
    expect(SRC).toMatch(/localStorage\.setItem/)
  })

  it('registra la instancia con TTSChain para encadenar leyes', () => {
    expect(SRC).toMatch(/chain\.register/)
    expect(SRC).toMatch(/onNaturalEnd/)
  })

  it('renderiza ChainModeToggle solo en la primera ley del tema', () => {
    expect(SRC).toMatch(/isFirstInChain/)
    expect(SRC).toMatch(/<ChainModeToggle/)
  })
})

// ============================================
// 2. Engine de lib/tts/engine.ts contiene la lógica robusta
// ============================================
describe('lib/tts/engine — robustez heredada', () => {
  it('NO usa keepalive pause+resume (causa pérdida de onend en Chrome)', () => {
    expect(ENGINE_SRC).not.toMatch(/startKeepAlive/)
    expect(ENGINE_SRC).not.toMatch(/keepAliveRef/)
  })

  it('watchdog con interval 2s', () => {
    expect(ENGINE_SRC).toMatch(/WATCHDOG_INTERVAL_MS\s*=\s*2[_,]?000/)
  })

  it('detecta speech muerto (speaking=false, pending=false)', () => {
    expect(ENGINE_SRC).toMatch(/!synth\.speaking/)
    expect(ENGINE_SRC).toMatch(/!synth\.pending/)
  })

  it('detecta chunk zombie (>30s)', () => {
    expect(ENGINE_SRC).toMatch(/CHUNK_ZOMBIE_TIMEOUT_MS\s*=\s*30[_,]?000/)
  })

  it('idempotencia natural end vía state machine (fix bucle)', () => {
    expect(ENGINE_SRC).toMatch(/handleNaturalEnd/)
    expect(ENGINE_SRC).toMatch(/transitionTo\(\{ type: 'NATURAL_END' \}\)/)
  })

  it('cancela handlers de utterance ANTES de cancel() para evitar races', () => {
    expect(ENGINE_SRC).toMatch(/this\.currentUtterance\.onend = null/)
    expect(ENGINE_SRC).toMatch(/this\.currentUtterance\.onerror = null/)
  })

  it('resume cancela + relanza chunk (Chrome móvil resume nativo flaky)', () => {
    expect(ENGINE_SRC).toMatch(
      /resume\(\)[\s\S]*?cancelCurrent\(\)[\s\S]*?speakChunk/,
    )
  })

  it('emite telemetría a observable_events vía ttsTelemetry', () => {
    expect(ENGINE_SRC).toMatch(/ttsTelemetry\.sessionStart/)
    expect(ENGINE_SRC).toMatch(/ttsTelemetry\.sessionEnd/)
    expect(ENGINE_SRC).toMatch(/ttsTelemetry\.chunkSkip/)
    expect(ENGINE_SRC).toMatch(/ttsTelemetry\.watchdogRetry/)
  })
})

// ============================================
// 3. INTEGRACIÓN: todos los temarios tienen TTS
// ============================================
describe('ArticleTTS — integración con temarios', () => {
  const glob = require('glob')
  const topicViews: string[] = glob.sync(
    'app/**/temario/*/TopicContentView.tsx',
    { cwd: ROOT },
  )

  it('hay al menos 20 TopicContentView con TTS', () => {
    const withTTS = topicViews.filter((f) => {
      const content = fs.readFileSync(path.join(ROOT, f), 'utf-8')
      return content.includes('ArticleTTS')
    })
    expect(withTTS.length).toBeGreaterThanOrEqual(20)
  })

  it('todos los TopicContentView importan ArticleTTS', () => {
    const missing: string[] = []
    for (const f of topicViews) {
      const content = fs.readFileSync(path.join(ROOT, f), 'utf-8')
      if (!content.includes('ArticleTTS')) {
        missing.push(f)
      }
    }
    expect(missing).toEqual([])
  })

  it('TTS recibe el texto concatenado de artículos', () => {
    let found = false
    for (const f of topicViews) {
      const content = fs.readFileSync(path.join(ROOT, f), 'utf-8')
      if (content.includes('.map(a =>') && content.includes('.join(')) {
        found = true
        break
      }
    }
    expect(found).toBe(true)
  })
})

// ============================================
// 4. Configuración + diagnóstico (en UI)
// ============================================
describe('ArticleTTS — diagnóstico de voces', () => {
  it('botón Configurar abre panel de voces', () => {
    expect(SRC).toMatch(/Configurar voz/)
    expect(SRC).toMatch(/showDiag/)
  })

  it('muestra conteo total y filtrado por español', () => {
    expect(SRC).toMatch(/Voces totales/)
    expect(SRC).toMatch(/voicesTotal/)
  })

  it('mensaje claro si no hay voces ES en el dispositivo', () => {
    expect(SRC).toMatch(/No se detectan voces en español/)
  })

  it('selector de voz tipo automática | específica', () => {
    expect(SRC).toMatch(/Automática \(mejor disponible\)/)
  })
})
