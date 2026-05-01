// __tests__/components/ArticleTTS.test.ts
// Tests de la lógica de ArticleTTS (chunking, robustez)

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const SRC = fs.readFileSync(path.join(ROOT, 'components/ArticleTTS.tsx'), 'utf-8')

// Extraer splitIntoChunks para testear directamente
// (es función pura fuera del componente, la reimplementamos idéntica)
const MAX_CHUNK_LENGTH = 250

function splitIntoChunks(text: string): string[] {
  const sentences = text.split(/(?<=[.!?;])\s+/)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (current.length + sentence.length > MAX_CHUNK_LENGTH && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks.length > 0 ? chunks : [text]
}

// ============================================
// 1. SPLITTING
// ============================================
describe('splitIntoChunks', () => {
  it('texto corto → 1 chunk', () => {
    const result = splitIntoChunks('Hola mundo.')
    expect(result).toEqual(['Hola mundo.'])
  })

  it('texto vacío → 1 chunk con texto original', () => {
    const result = splitIntoChunks('')
    expect(result).toEqual([''])
  })

  it('respeta MAX_CHUNK_LENGTH', () => {
    const chunks = splitIntoChunks(
      'Artículo 1. La Constitución se fundamenta en la indisoluble unidad de la Nación española. ' +
      'Artículo 2. Reconoce y garantiza el derecho a la autonomía de las nacionalidades y regiones. ' +
      'Artículo 3. El castellano es la lengua española oficial del Estado. ' +
      'Artículo 4. La bandera de España está formada por tres franjas horizontales, roja, amarilla y roja. ' +
      'Artículo 5. La capital del Estado es la villa de Madrid.'
    )
    for (const chunk of chunks) {
      // Puede exceder ligeramente si una frase individual es > 250
      expect(chunk.length).toBeLessThan(MAX_CHUNK_LENGTH + 100)
    }
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('no corta a mitad de frase', () => {
    const text = 'Primera frase completa. Segunda frase completa. Tercera frase completa.'
    const chunks = splitIntoChunks(text)
    for (const chunk of chunks) {
      // Cada chunk termina en punto, exclamación, interrogación o punto y coma
      expect(chunk).toMatch(/[.!?;]$/)
    }
  })

  it('maneja frase única más larga que MAX', () => {
    const longSentence = 'A'.repeat(300) + '.'
    const result = splitIntoChunks(longSentence)
    // No puede dividirla (no hay separador), devuelve como un chunk
    expect(result.length).toBe(1)
    expect(result[0]).toBe(longSentence)
  })

  it('simula CE completa: muchos chunks sin perder texto', () => {
    // Generar texto similar a la CE: ~1000 artículos cortos
    const articles = Array.from({ length: 100 }, (_, i) =>
      `Artículo ${i + 1}. Este es el contenido del artículo número ${i + 1} que establece disposiciones importantes.`
    ).join(' ')

    const chunks = splitIntoChunks(articles)
    const reconstructed = chunks.join(' ')

    // Verificar que no se pierde texto
    expect(reconstructed.length).toBeGreaterThanOrEqual(articles.length - 10) // tolerancia espacios
    expect(chunks.length).toBeGreaterThan(10)

    // Verificar que ningún chunk excede límite razonable
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThan(MAX_CHUNK_LENGTH + 150)
    }
  })
})

// ============================================
// 2. SOURCE CODE — mecanismos de robustez
// ============================================
describe('ArticleTTS — mecanismos de robustez', () => {
  it('NO usa keepAlive pause+resume (causa pérdida de onend en Chrome 147)', () => {
    // El keepalive con pause()+resume() corrompe el estado de Chrome
    // y hace que chunks mueran sin disparar onend tras ~3 min
    expect(SRC).not.toMatch(/startKeepAlive/)
    expect(SRC).not.toMatch(/keepAliveRef/)
  })

  it('tiene watchdog timer (detecta muerte silenciosa cada 2s)', () => {
    expect(SRC).toMatch(/watchdogRef/)
    expect(SRC).toMatch(/startWatchdog/)
    expect(SRC).toMatch(/stopWatchdog/)
    expect(SRC).toMatch(/2[_,]?000/)
  })

  it('watchdog detecta caso 1: speech murió (speaking=false)', () => {
    expect(SRC).toMatch(/!window\.speechSynthesis\.speaking/)
    expect(SRC).toMatch(/!window\.speechSynthesis\.pending/)
  })

  it('watchdog detecta caso 2: chunk zombie (speaking=true >30s)', () => {
    expect(SRC).toMatch(/CHUNK_TIMEOUT_MS/)
    expect(SRC).toMatch(/30[_,]?000/)
    expect(SRC).toMatch(/chunkAge > CHUNK_TIMEOUT_MS/)
    expect(SRC).toMatch(/chunk.*zombie/)
  })

  it('watchdog hace cancel() antes de re-lanzar', () => {
    // Importante: cancel() limpia el estado de Chrome antes de re-intentar.
    // cancel() debe aparecer ANTES de speakChunkRef.current en el watchdog.
    // (entre ambos hay lógica de retries con MAX_WATCHDOG_RETRIES)
    const watchdogSection = SRC.slice(SRC.indexOf('Caso 1: speech murió silenciosamente'))
    const cancelIdx = watchdogSection.indexOf('speechSynthesis.cancel()')
    const speakIdx = watchdogSection.indexOf('speakChunkRef.current(currentChunkRef.current')
    expect(cancelIdx).toBeGreaterThan(0)
    expect(speakIdx).toBeGreaterThan(cancelIdx)
  })

  it('watchdog re-lanza desde el chunk actual (no desde 0)', () => {
    expect(SRC).toMatch(/speakChunkRef\.current\(currentChunkRef\.current\)/)
  })

  it('registra timestamp de inicio de cada chunk', () => {
    expect(SRC).toMatch(/chunkStartTimeRef\.current = Date\.now\(\)/)
  })

  it('limpia todos los timers al parar', () => {
    expect(SRC).toMatch(/stopAllTimers/)
    expect(SRC).toMatch(/const stop = useCallback\(\(\) =>[\s\S]*?stopAllTimers/)
  })

  it('limpia watchdog al desmontar componente', () => {
    expect(SRC).toMatch(/watchdogRef\.current\) clearInterval\(watchdogRef\.current\)/)
  })

  it('muestra progreso visual', () => {
    expect(SRC).toMatch(/progressPercent/)
    expect(SRC).toMatch(/progress\.current/)
    expect(SRC).toMatch(/progress\.total/)
  })

  it('play() inicia watchdog (no keepalive)', () => {
    const playFn = SRC.match(/const play = useCallback\(\(\) =>[\s\S]*?\}, \[/)?.[0] || ''
    expect(playFn).toContain('startWatchdog()')
    expect(playFn).not.toContain('startKeepAlive()')
  })

  it('pause() para timers', () => {
    const pauseFn = SRC.match(/const pause = useCallback\(\(\) =>[\s\S]*?\}, \[/)?.[0] || ''
    expect(pauseFn).toContain('stopAllTimers()')
  })

  it('speakChunk actualiza progreso', () => {
    expect(SRC).toMatch(/setProgress\(\{ current: index \+ 1, total: chunksRef\.current\.length \}\)/)
  })

  it('onerror con interrupted se ignora', () => {
    expect(SRC).toMatch(/e\.error !== 'interrupted'/)
  })

  it('usa refs para estado en timers (no state stale)', () => {
    expect(SRC).toMatch(/playingRef\.current/)
    expect(SRC).toMatch(/pausedRef\.current/)
    expect(SRC).toMatch(/stoppedRef\.current/)
  })
})

// ============================================
// 3. INTEGRACIÓN: todos los temarios tienen TTS
// ============================================
describe('ArticleTTS — integración con temarios', () => {
  const glob = require('glob')
  const topicViews: string[] = glob.sync('app/**/temario/*/TopicContentView.tsx', { cwd: ROOT })

  it('hay al menos 20 TopicContentView con TTS', () => {
    const withTTS = topicViews.filter(f => {
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

  it('TTS recibe el texto concatenado de artículos (no individual)', () => {
    // Verificar que al menos uno usa el patrón de concatenación
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
// 4. CONFIGURACIÓN Y DIAGNÓSTICO
// ============================================
describe('ArticleTTS — configuración y diagnóstico', () => {
  it('tiene panel de diagnóstico con info del dispositivo', () => {
    expect(SRC).toMatch(/getDiagnostic/)
    expect(SRC).toMatch(/showDiag/)
    expect(SRC).toMatch(/diagInfo/)
  })

  it('detecta navegador (Chrome, Firefox, Safari)', () => {
    expect(SRC).toMatch(/isChrome/)
    expect(SRC).toMatch(/isFirefox/)
    expect(SRC).toMatch(/isSafari/)
  })

  it('detecta dispositivo (móvil vs escritorio)', () => {
    expect(SRC).toMatch(/isMobile/)
    expect(SRC).toMatch(/Android|iPhone|iPad/)
  })

  it('muestra número de voces disponibles', () => {
    expect(SRC).toMatch(/Voces totales/)
    expect(SRC).toMatch(/Voces en español/)
  })

  it('tiene selector de voz si hay varias opciones', () => {
    expect(SRC).toMatch(/selectedVoiceURI/)
    expect(SRC).toMatch(/availableVoices/)
    expect(SRC).toMatch(/<select/)
    expect(SRC).toMatch(/<option/)
  })

  it('getSpanishVoice respeta la selección del usuario', () => {
    expect(SRC).toMatch(/selectedVoiceURI/)
    expect(SRC).toMatch(/v\.voiceURI === selectedVoiceURI/)
  })

  it('muestra aviso si no hay voces en español', () => {
    expect(SRC).toMatch(/No se detectan voces en español/)
  })

  it('play() verifica voces antes de reproducir', () => {
    const playFn = SRC.match(/const play = useCallback\(\(\) =>[\s\S]*?\}, \[/)?.[0] || ''
    expect(playFn).toContain('voices.length === 0')
    expect(playFn).toContain('esVoices.length === 0')
    expect(playFn).toContain('setShowDiag(true)')
  })

  it('tiene botón de configuración con icono engranaje y texto responsive', () => {
    expect(SRC).toMatch(/Configurar voz/) // title
    expect(SRC).toMatch(/hidden sm:inline.*Configurar/) // texto solo en desktop
    expect(SRC).toMatch(/hover:bg-gray-200/) // hover visible
    expect(SRC).toMatch(/hover:border-gray-300/) // borde en hover
  })

  it('tiene botón cerrar en el panel', () => {
    expect(SRC).toMatch(/Cerrar/)
    expect(SRC).toMatch(/setShowDiag\(false\)/)
  })
})
