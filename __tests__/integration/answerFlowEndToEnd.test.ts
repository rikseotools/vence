// __tests__/integration/answerFlowEndToEnd.test.ts
// Tests de integración que verifican el flujo completo:
// preguntas cargadas → correct_option presente → validación client-side → enqueueAnswer con sessionId
//
// NO hace queries a la BD real — verifica que el código tiene la estructura correcta
// para que el flujo funcione end-to-end.

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')

// ============================================
// 1. TestLayout: flujo completo de respuesta
// ============================================
describe('TestLayout — flujo de respuesta end-to-end', () => {
  const content = fs.readFileSync(path.join(ROOT, 'components/TestLayout.tsx'), 'utf-8')

  it('crea sesión de test eager al montar (useEffect)', () => {
    // Debe tener un useEffect que cree la sesión antes de la primera respuesta
    expect(content).toContain('createDetailedTestSession')
    // Sesión se crea con setCurrentTestSession
    expect(content).toContain('setCurrentTestSession(session)')
  })

  it('handleAnswerClick no es async (validación instantánea)', () => {
    expect(content).toMatch(/const handleAnswerClick = \(answerIndex: number\): void/)
  })

  it('valida con correct_option antes de cualquier setState', () => {
    // correct_option debe leerse antes de setShowResult
    const correctOptionLine = content.indexOf('currentQ.correct_option')
    const showResultLine = content.indexOf('setShowResult(true)')
    expect(correctOptionLine).toBeGreaterThan(0)
    expect(showResultLine).toBeGreaterThan(correctOptionLine)
  })

  it('setShowResult se llama ANTES del setTimeout', () => {
    const showResultLine = content.indexOf('setShowResult(true)')
    // Buscar el setTimeout que está después
    const setTimeoutAfter = content.indexOf('setTimeout(() => {', showResultLine)
    expect(setTimeoutAfter).toBeGreaterThan(showResultLine)
  })

  it('captura sesión antes del setTimeout para evitar stale closures', () => {
    expect(content).toContain('const capturedSession = currentTestSession')
  })

  it('guardado servidor está en función helper (saveAnswerToServer)', () => {
    expect(content).toContain('saveAnswerToServer(')
    expect(content).toContain('const saveAnswerToServer')
  })

  it('saveAnswerToServer usa enqueueAnswer con session.id', () => {
    expect(content).toMatch(/enqueueAnswer[\s\S]*?sessionId:\s*session\.id/)
    expect(content).toMatch(/if\s*\(!user \|\| !session\)\s*return/)
  })

  it('completeTestOnServer se llama en la finalización del test', () => {
    expect(content).toContain('completeTestOnServer')
  })

  it('scrollToResult está en el setTimeout (no bloquea render)', () => {
    const timeoutStart = content.indexOf('setTimeout(() => {', content.indexOf('setShowResult(true)'))
    const scrollPos = content.indexOf('scrollToResult()', timeoutStart)
    expect(scrollPos).toBeGreaterThan(timeoutStart)
  })

  it('no importa answerAndSave ni useAnswerWatchdog', () => {
    expect(content).not.toMatch(/import.*answerAndSave.*from/)
    expect(content).not.toMatch(/import.*useAnswerWatchdog.*from/)
  })
})

// ============================================
// 2. PsychometricTestLayout: flujo completo
// ============================================
describe('PsychometricTestLayout — flujo de respuesta end-to-end', () => {
  const content = fs.readFileSync(path.join(ROOT, 'components/PsychometricTestLayout.tsx'), 'utf-8')

  it('crea sesión eager al montar', () => {
    expect(content).toContain('createTestSession')
    expect(content).toMatch(/sessionCreated\.current/)
  })

  it('valida con correct_option localmente', () => {
    expect(content).toMatch(/typeof currentQ\.correct_option === .number./)
  })

  it('usa validatePsychometricAnswer para guardar (no enqueueAnswer)', () => {
    expect(content).toContain('validatePsychometricAnswer')
    expect(content).not.toContain('enqueueAnswer')
  })

  it('guardado es fire-and-forget (.then/.catch)', () => {
    expect(content).toMatch(/validatePsychometricAnswer[\s\S]*?\.then/)
    expect(content).toMatch(/validatePsychometricAnswer[\s\S]*?\.catch/)
  })

  it('isAnswering es constante false', () => {
    expect(content).toContain('const isAnswering = false')
  })

  it('no importa useAnswerWatchdog', () => {
    expect(content).not.toMatch(/import.*useAnswerWatchdog.*from/)
  })
})

// ============================================
// 3. answerSaveQueue: estructura correcta
// ============================================
describe('answerSaveQueue — estructura', () => {
  const content = fs.readFileSync(path.join(ROOT, 'utils/answerSaveQueue.ts'), 'utf-8')

  it('usa /api/v2/answer-and-save como endpoint', () => {
    expect(content).toContain('/api/v2/answer-and-save')
  })

  it('tiene AbortController con timeout', () => {
    expect(content).toContain('AbortController')
    expect(content).toContain('setTimeout(() => controller.abort()')
  })

  it('tiene deduplicación con flushInProgress', () => {
    expect(content).toContain('flushInProgress')
  })

  it('filtra respuestas antiguas (>24h)', () => {
    expect(content).toMatch(/24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/)
  })

  it('tiene MAX_RETRIES', () => {
    expect(content).toContain('MAX_RETRIES')
  })

  it('tiene listeners de online y visibilitychange', () => {
    expect(content).toContain("addEventListener('online'")
    expect(content).toContain("addEventListener('visibilitychange'")
  })

  it('usa crypto.randomUUID con fallback', () => {
    expect(content).toContain('crypto.randomUUID')
    expect(content).toContain('Math.random')
  })
})

// ============================================
// 4. Sesión de test: se crea ANTES de responder
// ============================================
describe('Sesión de test — creación eager', () => {
  const content = fs.readFileSync(path.join(ROOT, 'components/TestLayout.tsx'), 'utf-8')

  it('createDetailedTestSession se llama en un useEffect, no en handleAnswerClick', () => {
    // handleAnswerClick no debe llamar a createDetailedTestSession
    const handleStart = content.indexOf('const handleAnswerClick')
    const handleEnd = content.indexOf('  }', content.indexOf('}, 0)', handleStart))

    const handleBody = content.slice(handleStart, handleEnd)
    expect(handleBody).not.toContain('createDetailedTestSession')

    // Pero sí debe existir en un useEffect
    expect(content).toMatch(/useEffect\(\(\) => \{[\s\S]*?createDetailedTestSession/)
  })

  it('el useEffect de sesión verifica !currentTestSession', () => {
    // Para no crear sesiones duplicadas
    expect(content).toMatch(/!currentTestSession.*createDetailedTestSession|currentTestSession.*return/)
  })

  it('usa sessionCreationRef para evitar llamadas concurrentes', () => {
    expect(content).toContain('sessionCreationRef.current.has(sessionKey)')
    expect(content).toContain('sessionCreationRef.current.add(sessionKey)')
    expect(content).toContain('sessionCreationRef.current.delete(sessionKey)')
  })
})
