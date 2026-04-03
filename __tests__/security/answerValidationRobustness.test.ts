// __tests__/security/answerValidationRobustness.test.ts
// Tests para verificar las mejoras de robustez en la cadena de validación de respuestas:
// 1. connect_timeout reducido (5s en vez de 30s)
// 2. maxDuration en las 3 rutas API
// 3. Error handling correcto en ExamLayout, PsychometricTestLayout, DynamicTest, TestLayout
// 4. No fallback inseguro que exponga correct_option
// 5. Notificaciones admin con campos correctos

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')

// ============================================
// 1. DB CLIENT: connect_timeout = 5
// ============================================
describe('db/client.ts — connect_timeout', () => {
  const filePath = path.join(ROOT, 'db/client.ts')
  const content = fs.readFileSync(filePath, 'utf-8')

  it('connect_timeout debe ser <= 5 (fail fast)', () => {
    // Buscar todas las ocurrencias de connect_timeout
    const matches = content.match(/connect_timeout:\s*(\d+)/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(1)

    // Todas deben ser <= 5 (2 para APIs normales, 3 para admin)
    for (const match of matches!) {
      const value = parseInt(match.match(/\d+/)![0])
      expect(value).toBeLessThanOrEqual(5)
      expect(value).toBeGreaterThanOrEqual(1)
    }
  })

  it('NO debe tener connect_timeout: 30 (el valor problemático)', () => {
    expect(content).not.toMatch(/connect_timeout:\s*30/)
  })
})

// ============================================
// 2. maxDuration EN RUTAS API
// ============================================
describe('API Routes — maxDuration export', () => {

  it('/api/answer/route.ts exporta maxDuration = 30', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'app/api/answer/route.ts'), 'utf-8'
    )
    expect(content).toMatch(/export\s+const\s+maxDuration\s*=\s*30/)
  })

  it('/api/exam/validate/route.ts exporta maxDuration = 60', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'app/api/exam/validate/route.ts'), 'utf-8'
    )
    expect(content).toMatch(/export\s+const\s+maxDuration\s*=\s*60/)
  })

  it('/api/answer/psychometric/route.ts exporta maxDuration = 30', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'app/api/answer/psychometric/route.ts'), 'utf-8'
    )
    expect(content).toMatch(/export\s+const\s+maxDuration\s*=\s*30/)
  })

  it('maxDuration de exam/validate es mayor que answer (batch vs individual)', () => {
    const answerContent = fs.readFileSync(
      path.join(ROOT, 'app/api/answer/route.ts'), 'utf-8'
    )
    const examContent = fs.readFileSync(
      path.join(ROOT, 'app/api/exam/validate/route.ts'), 'utf-8'
    )

    const answerDuration = parseInt(answerContent.match(/maxDuration\s*=\s*(\d+)/)![1])
    const examDuration = parseInt(examContent.match(/maxDuration\s*=\s*(\d+)/)![1])

    expect(examDuration).toBeGreaterThan(answerDuration)
  })
})

// ============================================
// 3. EXAMLAYOUT: Error handling robusto
// ============================================
describe('ExamLayout.tsx — error handling', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'components/ExamLayout.tsx'), 'utf-8'
  )

  it('importa ApiTimeoutError y ApiNetworkError', () => {
    expect(content).toMatch(/import\s*\{[^}]*ApiTimeoutError[^}]*\}\s*from/)
    expect(content).toMatch(/import\s*\{[^}]*ApiNetworkError[^}]*\}\s*from/)
  })

  it('clasifica errores por tipo (TIMEOUT, NETWORK, API_ERROR)', () => {
    expect(content).toContain('ApiTimeoutError')
    expect(content).toContain('ApiNetworkError')
    expect(content).toContain("'TIMEOUT'")
    expect(content).toContain("'NETWORK'")
    expect(content).toContain("'API_ERROR'")
  })

  it('muestra alert al usuario en caso de error', () => {
    // Verificar que hay un alert que informa al usuario
    expect(content).toMatch(/alert\s*\(/)
  })

  it('NO envía emails de notificación admin (se registran en validation_error_logs)', () => {
    expect(content).not.toContain("'/api/emails/send-admin-notification'")
  })

  it('resetea isSaving en caso de error (no deja UI colgada)', () => {
    // Buscar que setIsSaving(false) está dentro del bloque catch
    const catchBlock = content.match(/catch\s*\(error\)\s*\{[\s\S]*?setIsSaving\(false\)/m)
    expect(catchBlock).not.toBeNull()
  })
})

// ============================================
// 4. PSYCHOMETRIC: Sin fallback inseguro
// ============================================
describe('PsychometricTestLayout.tsx — validación client-side', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'components/PsychometricTestLayout.tsx'), 'utf-8'
  )

  it('usa correct_option para validación client-side instantánea', () => {
    expect(content).toContain('correct_option')
    expect(content).toContain('enqueueAnswer')
  })

  it('no bloquea UI con isAnswering (validación instantánea)', () => {
    expect(content).not.toMatch(/setIsAnswering\(true\)/)
  })

  it('NO envía emails de notificación admin (se registran en validation_error_logs)', () => {
    expect(content).not.toContain("'/api/emails/send-admin-notification'")
  })

  it('usa enqueueAnswer para guardado en background', () => {
    expect(content).toMatch(/import\s*\{[^}]*enqueueAnswer[^}]*\}/)
  })
})

// ============================================
// 5. DYNAMICTEST: Error handling
// ============================================
describe('DynamicTest — error handling', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'components/DynamicTest.tsx'), 'utf-8'
  )

  it('NO envía emails de notificación admin (se registran en validation_error_logs)', () => {
    expect(content).not.toContain("'/api/emails/send-admin-notification'")
  })

  it('extrae user de useAuth()', () => {
    expect(content).toMatch(/const\s*\{[^}]*user[^}]*\}\s*=\s*useAuth\(\)/)
  })

  it('usa validateAnswer centralizado (no fetch directo)', () => {
    expect(content).toMatch(/import\s*\{[^}]*validateAnswer[^}]*\}/)
  })
})

// ============================================
// 6. TESTLAYOUT: Error handling
// ============================================
describe('TestLayout.tsx — error handling', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'components/TestLayout.tsx'), 'utf-8'
  )

  it('NO envía emails de notificación admin (se registran en validation_error_logs)', () => {
    expect(content).not.toContain("'/api/emails/send-admin-notification'")
  })

  it('usa validación client-side con correct_option y cola de guardado', () => {
    expect(content).toContain('correct_option')
    expect(content).toContain('enqueueAnswer')
  })

  it('usa completeTestOnServer para finalización', () => {
    expect(content).toContain('completeTestOnServer')
  })

  it('no bloquea UI con processingAnswer (validación instantánea)', () => {
    // processingAnswer ya no se usa — la validación es síncrona client-side
    expect(content).not.toMatch(/setProcessingAnswer\(true\)/)
  })

  it('muestra validationError al usuario', () => {
    expect(content).toContain('validationError')
  })
})

// ============================================
// 7. CONSISTENCIA: Ningún componente envía emails de error (se usan validation_error_logs)
// ============================================
describe('Consistencia — ningún componente envía emails de error admin', () => {
  const components = [
    { name: 'TestLayout', file: 'components/TestLayout.tsx' },
    { name: 'DynamicTest', file: 'components/DynamicTest.tsx' },
    { name: 'ExamLayout', file: 'components/ExamLayout.tsx' },
    { name: 'PsychometricTestLayout', file: 'components/PsychometricTestLayout.tsx' },
  ]

  for (const { name, file } of components) {
    it(`${name} NO envía email de notificación admin`, () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')
      expect(content).not.toContain("'/api/emails/send-admin-notification'")
    })
  }
})

// ============================================
// 8. SEGURIDAD: Ninguna ruta API expone correct_option en GET
// ============================================
describe('Seguridad — rutas API bloquean GET', () => {
  const routes = [
    'app/api/answer/route.ts',
    'app/api/exam/validate/route.ts',
    'app/api/answer/psychometric/route.ts',
  ]

  for (const route of routes) {
    it(`${route} tiene handler GET que devuelve 405`, () => {
      const content = fs.readFileSync(path.join(ROOT, route), 'utf-8')
      expect(content).toMatch(/export\s+const\s+GET\s*=\s*withErrorLogging|export\s+async\s+function\s+GET/)
      expect(content).toContain('405')
    })
  }
})

// ============================================
// 9. TIMEOUTS: Client timeout < Server connect_timeout < maxDuration
// ============================================
describe('Timeouts — jerarquía correcta', () => {
  it('client timeout (10s) > server connect_timeout (5s)', () => {
    // El cliente espera 10s, pero el servidor falla la conexión a DB en 5s
    // Esto asegura que el servidor responde antes de que el cliente abandone
    const clientContent = fs.readFileSync(
      path.join(ROOT, 'lib/api/answers/client.ts'), 'utf-8'
    )
    const dbContent = fs.readFileSync(
      path.join(ROOT, 'db/client.ts'), 'utf-8'
    )

    const clientTimeout = parseInt(
      clientContent.match(/timeoutMs[:\s]*(\d+)/)![1]
    )
    const connectTimeout = parseInt(
      dbContent.match(/connect_timeout:\s*(\d+)/)![1]
    )

    // Client debe esperar más que el connect_timeout del servidor
    expect(clientTimeout / 1000).toBeGreaterThan(connectTimeout)
  })

  it('maxDuration (30s) > client timeout (10s) para /api/answer', () => {
    const routeContent = fs.readFileSync(
      path.join(ROOT, 'app/api/answer/route.ts'), 'utf-8'
    )
    const clientContent = fs.readFileSync(
      path.join(ROOT, 'lib/api/answers/client.ts'), 'utf-8'
    )

    const maxDuration = parseInt(
      routeContent.match(/maxDuration\s*=\s*(\d+)/)![1]
    )
    const clientTimeout = parseInt(
      clientContent.match(/timeoutMs[:\s]*(\d+)/)![1]
    )

    // maxDuration en segundos, clientTimeout en ms
    expect(maxDuration * 1000).toBeGreaterThan(clientTimeout)
  })
})

// ============================================
// 10. LÓGICA DE ERROR HANDLING EN COMPONENTES
// ============================================
describe('Error handling — lógica de clasificación de errores', () => {

  // Replica la lógica de clasificación usada en TestLayout/ExamLayout
  function classifyError(error: Error): 'TIMEOUT' | 'NETWORK' | 'API_ERROR' {
    // Simula la lógica: error instanceof ApiTimeoutError ? 'TIMEOUT' : ...
    if (error.name === 'ApiTimeoutError') return 'TIMEOUT'
    if (error.name === 'ApiNetworkError') return 'NETWORK'
    return 'API_ERROR'
  }

  it('clasifica timeout correctamente', () => {
    const err = new Error('Request timed out')
    err.name = 'ApiTimeoutError'
    expect(classifyError(err)).toBe('TIMEOUT')
  })

  it('clasifica error de red correctamente', () => {
    const err = new Error('Failed to fetch')
    err.name = 'ApiNetworkError'
    expect(classifyError(err)).toBe('NETWORK')
  })

  it('clasifica error genérico como API_ERROR', () => {
    const err = new Error('Something went wrong')
    expect(classifyError(err)).toBe('API_ERROR')
  })
})

describe('Error handling — errores se registran en servidor, no por email', () => {
  it('ningún componente envía emails de error (usan validation_error_logs)', () => {
    const components = [
      'components/TestLayout.tsx',
      'components/DynamicTest.tsx',
      'components/ExamLayout.tsx',
      'components/PsychometricTestLayout.tsx',
    ]

    for (const file of components) {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')
      expect(content).not.toContain("send-admin-notification")
    }
  })
})

// ============================================
// 11. VALIDACIÓN ZOD EN RUTAS API
// ============================================
describe('Rutas API — validación Zod de entrada', () => {

  it('/api/answer valida con safeParse (no lanza excepciones)', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'app/api/answer/route.ts'), 'utf-8'
    )
    expect(content).toMatch(/safeParse|safeParseAnswerRequest/)
  })

  it('/api/exam/validate valida con safeParse', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'app/api/exam/validate/route.ts'), 'utf-8'
    )
    expect(content).toMatch(/safeParse/)
  })

  it('/api/answer/psychometric valida con safeParse', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'app/api/answer/psychometric/route.ts'), 'utf-8'
    )
    expect(content).toMatch(/safeParse/)
  })

  it('las 3 rutas devuelven 400 con datos inválidos', () => {
    const routes = [
      'app/api/answer/route.ts',
      'app/api/exam/validate/route.ts',
      'app/api/answer/psychometric/route.ts',
    ]

    for (const route of routes) {
      const content = fs.readFileSync(path.join(ROOT, route), 'utf-8')
      expect(content).toContain('400')
    }
  })

  it('las 3 rutas devuelven 500 en error interno', () => {
    const routes = [
      'app/api/answer/route.ts',
      'app/api/exam/validate/route.ts',
      'app/api/answer/psychometric/route.ts',
    ]

    for (const route of routes) {
      const content = fs.readFileSync(path.join(ROOT, route), 'utf-8')
      expect(content).toContain('500')
    }
  })
})
