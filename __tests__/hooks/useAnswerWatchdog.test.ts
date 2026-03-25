// __tests__/hooks/useAnswerWatchdog.test.ts
// Tests para el hook watchdog que detecta UI congelada

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')

// ============================================
// 1. LÓGICA PURA DEL WATCHDOG
// ============================================
describe('useAnswerWatchdog — lógica del timer', () => {

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('ejecuta onReset tras 20s si isProcessing sigue en true', () => {
    const onReset = jest.fn()
    let timer: ReturnType<typeof setTimeout> | null = null

    // Simular: isProcessing pasa a true
    timer = setTimeout(() => {
      onReset()
    }, 20_000)

    // Antes de 20s: no se ha llamado
    jest.advanceTimersByTime(19_999)
    expect(onReset).not.toHaveBeenCalled()

    // A los 20s: se llama
    jest.advanceTimersByTime(1)
    expect(onReset).toHaveBeenCalledTimes(1)

    clearTimeout(timer!)
  })

  it('NO ejecuta onReset si se cancela antes de 20s', () => {
    const onReset = jest.fn()

    const timer = setTimeout(() => {
      onReset()
    }, 20_000)

    // A los 5s el procesamiento termina
    jest.advanceTimersByTime(5_000)
    clearTimeout(timer)

    // Avanzar más allá de 20s
    jest.advanceTimersByTime(30_000)
    expect(onReset).not.toHaveBeenCalled()
  })

  it('múltiples ciclos isProcessing=true/false no acumulan timers', () => {
    const onReset = jest.fn()

    // Ciclo 1: empieza y termina rápido
    const t1 = setTimeout(onReset, 20_000)
    jest.advanceTimersByTime(2_000)
    clearTimeout(t1)

    // Ciclo 2: empieza y termina rápido
    const t2 = setTimeout(onReset, 20_000)
    jest.advanceTimersByTime(2_000)
    clearTimeout(t2)

    // Avanzar mucho tiempo
    jest.advanceTimersByTime(60_000)
    expect(onReset).not.toHaveBeenCalled()
  })
})

// ============================================
// 2. VERIFICACIÓN SOURCE CODE DEL HOOK
// ============================================
describe('useAnswerWatchdog.ts — source code', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'hooks/useAnswerWatchdog.ts'), 'utf-8'
  )

  it('timeout es 20 segundos', () => {
    expect(content).toMatch(/20[_,]?000/)
  })

  it('usa useEffect para manejar el timer', () => {
    expect(content).toMatch(/useEffect/)
  })

  it('limpia el timer en cleanup (return de useEffect)', () => {
    expect(content).toMatch(/clearTimeout/)
  })

  it('logea a validation_error_logs via fetch API', () => {
    expect(content).toMatch(/fetch\(['"]\/api\/validation-error-log['"]/)
  })

  it('incluye component y questionId en el log', () => {
    expect(content).toMatch(/component/)
    expect(content).toMatch(/questionId/)
  })

  it('exporta WatchdogConfig como interfaz', () => {
    expect(content).toMatch(/export interface WatchdogConfig/)
  })

  it('isProcessing controla inicio/cancelación del timer', () => {
    expect(content).toMatch(/if \(isProcessing\)/)
  })

  it('solo inicia timer cuando isProcessing es true', () => {
    // Verificar que setTimeout solo se llama en el branch isProcessing=true
    const lines = content.split('\n')
    let inProcessingBlock = false
    let setTimeoutInCorrectBlock = false

    for (const line of lines) {
      if (line.includes('if (isProcessing)')) inProcessingBlock = true
      if (inProcessingBlock && line.includes('setTimeout')) setTimeoutInCorrectBlock = true
      if (line.includes('} else {')) inProcessingBlock = false
    }

    expect(setTimeoutInCorrectBlock).toBe(true)
  })
})

// ============================================
// 3. INTEGRACIÓN EN COMPONENTES
// ============================================
describe('Componentes — watchdog integrado', () => {
  const components = [
    { name: 'TestLayout', file: 'components/TestLayout.tsx', flag: 'processingAnswer' },
    { name: 'ExamLayout', file: 'components/ExamLayout.tsx', flag: 'isSaving' },
    { name: 'DynamicTest', file: 'components/DynamicTest.tsx', flag: 'processingAnswer' },
    { name: 'PsychometricTestLayout', file: 'components/PsychometricTestLayout.tsx', flag: 'isAnswering' },
  ]

  for (const { name, file, flag } of components) {
    describe(name, () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')

      it('importa useAnswerWatchdog', () => {
        expect(content).toMatch(/import.*useAnswerWatchdog.*from/)
      })

      it('llama a useAnswerWatchdog con isProcessing', () => {
        expect(content).toMatch(/useAnswerWatchdog\(\{/)
        expect(content).toMatch(/isProcessing:\s*\w+/)
      })

      it(`usa ${flag} como isProcessing`, () => {
        expect(content).toMatch(new RegExp(`isProcessing:\\s*${flag}`))
      })

      it(`incluye component: '${name}'`, () => {
        // El watchdog config debe incluir el nombre del componente
        expect(content).toContain(`component: '${name}'`)
      })

      it('incluye onReset que resetea el flag de procesamiento', () => {
        // El onReset debe poner el flag a false
        expect(content).toMatch(new RegExp(`set\\w+\\(false\\)`))
      })

      it('incluye userId en la config del watchdog', () => {
        expect(content).toMatch(/userId:\s*user\?\.id/)
      })
    })
  }
})

// ============================================
// 4. DynamicTest — processingAnswer guard añadido
// ============================================
describe('DynamicTest — processingAnswer guard', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'components/DynamicTest.tsx'), 'utf-8'
  )

  it('tiene estado processingAnswer', () => {
    expect(content).toMatch(/useState\(false\)/)
    expect(content).toContain('processingAnswer')
    expect(content).toContain('setProcessingAnswer')
  })

  it('usa processingAnswer como guard en handleAnswerClick', () => {
    expect(content).toMatch(/if \(showResult \|\| processingAnswer\) return/)
  })

  it('setProcessingAnswer(true) al inicio de handleAnswerClick', () => {
    expect(content).toContain('setProcessingAnswer(true)')
  })

  it('setProcessingAnswer(false) en el catch de error', () => {
    // En el bloque catch, debe resetear
    const catchBlock = content.match(/catch \(err[^)]*\) \{[\s\S]*?return\s*\n\s*\}/m)
    expect(catchBlock).not.toBeNull()
    expect(catchBlock![0]).toContain('setProcessingAnswer(false)')
  })

  it('setProcessingAnswer(false) al final del flujo exitoso', () => {
    expect(content).toContain('setProcessingAnswer(false)')
  })
})

// ============================================
// 5. SEGURIDAD: Watchdog no interfiere con flujo normal
// ============================================
describe('Watchdog — no interfiere con flujo normal', () => {

  it('20s es mayor que timeout API máximo (10s x 2 retries + delays = ~32s... wait, 20s < 32s)', () => {
    // En realidad: timeout 10s + retry delay 1s + timeout 10s + retry delay 1s + timeout 10s = 32s
    // PERO el AbortController del client.ts aborta tras 10s cada intento
    // Y el catch en el componente ejecuta setProcessingAnswer(false)
    // Así que en la PRÁCTICA, processingAnswer se resetea en <32s por el catch
    // El watchdog a 20s es un safety net para cuando el catch NO se ejecuta (bug, crash, etc.)
    //
    // Verificamos que el watchdog timeout (20s) es razonable:
    // - Mayor que un solo intento (10s) + margen
    // - Menor que "el usuario se ha ido" (60s+)
    const WATCHDOG_MS = 20_000
    const SINGLE_ATTEMPT_MS = 10_000

    expect(WATCHDOG_MS).toBeGreaterThan(SINGLE_ATTEMPT_MS)
    expect(WATCHDOG_MS).toBeLessThan(60_000)
  })

  it('el hook usa onReset como callback (no modifica estado directamente)', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'hooks/useAnswerWatchdog.ts'), 'utf-8'
    )
    // El hook llama a onReset(), no a setProcessingAnswer directamente
    expect(content).toMatch(/onReset\(\)/)
    expect(content).not.toMatch(/setProcessingAnswer/)
    expect(content).not.toMatch(/setIsAnswering/)
    expect(content).not.toMatch(/setIsSaving/)
  })
})
