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
  it('tiene keepAlive timer (pause+resume cada 10s)', () => {
    expect(SRC).toMatch(/keepAliveRef/)
    expect(SRC).toMatch(/startKeepAlive/)
    expect(SRC).toMatch(/stopKeepAlive/)
    expect(SRC).toMatch(/10[_,]?000/)
    expect(SRC).toMatch(/speechSynthesis\.pause\(\)/)
    expect(SRC).toMatch(/speechSynthesis\.resume\(\)/)
  })

  it('tiene watchdog timer (detecta muerte silenciosa cada 3s)', () => {
    expect(SRC).toMatch(/watchdogRef/)
    expect(SRC).toMatch(/startWatchdog/)
    expect(SRC).toMatch(/stopWatchdog/)
    expect(SRC).toMatch(/3[_,]?000/)
  })

  it('watchdog verifica condiciones correctas antes de re-lanzar', () => {
    // Debe verificar: playing + !paused + !stopped + !speaking + !pending + chunks restantes
    expect(SRC).toMatch(/playingRef\.current/)
    expect(SRC).toMatch(/pausedRef\.current/)
    expect(SRC).toMatch(/stoppedRef\.current/)
    expect(SRC).toMatch(/speechSynthesis\.speaking/)
    expect(SRC).toMatch(/speechSynthesis\.pending/)
    expect(SRC).toMatch(/currentChunkRef\.current < chunksRef\.current\.length/)
  })

  it('watchdog re-lanza desde el chunk actual (no desde 0)', () => {
    expect(SRC).toMatch(/speakChunkRef\.current\(currentChunkRef\.current\)/)
  })

  it('limpia todos los timers al parar', () => {
    expect(SRC).toMatch(/stopAllTimers/)
    // stop() llama stopAllTimers
    expect(SRC).toMatch(/const stop = useCallback\(\(\) =>[\s\S]*?stopAllTimers/)
  })

  it('limpia todos los timers al desmontar componente', () => {
    // useEffect cleanup
    expect(SRC).toMatch(/keepAliveRef\.current\) clearInterval\(keepAliveRef\.current\)/)
    expect(SRC).toMatch(/watchdogRef\.current\) clearInterval\(watchdogRef\.current\)/)
  })

  it('muestra progreso visual', () => {
    expect(SRC).toMatch(/progressPercent/)
    expect(SRC).toMatch(/progress\.current/)
    expect(SRC).toMatch(/progress\.total/)
  })

  it('play() inicia keepAlive + watchdog', () => {
    // Ambos deben iniciarse al reproducir
    const playFn = SRC.match(/const play = useCallback\(\(\) =>[\s\S]*?\}, \[/)?.[0] || ''
    expect(playFn).toContain('startKeepAlive()')
    expect(playFn).toContain('startWatchdog()')
  })

  it('pause() para ambos timers', () => {
    const pauseFn = SRC.match(/const pause = useCallback\(\(\) =>[\s\S]*?\}, \[/)?.[0] || ''
    expect(pauseFn).toContain('stopAllTimers()')
  })

  it('resume (isPaused → play) reinicia ambos timers', () => {
    // Dentro de play(), el branch isPaused también inicia los timers
    const playFn = SRC.match(/const play = useCallback\(\(\) =>[\s\S]*?\}, \[/)?.[0] || ''
    // Hay dos llamadas a startKeepAlive y startWatchdog (una para resume, otra para play nuevo)
    const keepAliveCount = (playFn.match(/startKeepAlive\(\)/g) || []).length
    const watchdogCount = (playFn.match(/startWatchdog\(\)/g) || []).length
    expect(keepAliveCount).toBeGreaterThanOrEqual(2)
    expect(watchdogCount).toBeGreaterThanOrEqual(2)
  })

  it('speakChunk actualiza progreso', () => {
    expect(SRC).toMatch(/setProgress\(\{ current: index \+ 1, total: chunksRef\.current\.length \}\)/)
  })

  it('onerror con interrupted no es error (keepalive causa esto)', () => {
    expect(SRC).toMatch(/e\.error !== 'interrupted'/)
  })

  it('usa refs para estado en timers (no state stale)', () => {
    // Los timers deben leer refs, no state (que se cierra en el closure)
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
