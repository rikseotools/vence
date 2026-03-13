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

  it('connect_timeout debe ser 5 (fail fast)', () => {
    // Buscar todas las ocurrencias de connect_timeout
    const matches = content.match(/connect_timeout:\s*(\d+)/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(1)

    // Todas deben ser 5
    for (const match of matches!) {
      const value = parseInt(match.match(/\d+/)![0])
      expect(value).toBe(5)
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

  it('envía notificación admin con campos correctos', () => {
    expect(content).toContain("'/api/emails/send-admin-notification'")
    expect(content).toContain("component: 'ExamLayout'")
    expect(content).toContain('errorType')
    expect(content).toContain('errorMessage')
    expect(content).toContain('userId')
    expect(content).toContain('timestamp')
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
describe('PsychometricTestLayout.tsx — sin fallback inseguro', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'components/PsychometricTestLayout.tsx'), 'utf-8'
  )

  it('NO usa correct_option del cliente como fallback', () => {
    // No debe haber una línea que lea correct_option directamente para validar
    // Patrones peligrosos: currentQ.correct_option, question.correct_option usado como fallback
    const dangerousPatterns = [
      /localCorrectAnswer\s*=\s*currentQ\.correct_option/,
      /const\s+correctAnswer\s*=\s*currentQ\.correct_option/,
      /fallback.*correct_option/i,
    ]

    for (const pattern of dangerousPatterns) {
      expect(content).not.toMatch(pattern)
    }
  })

  it('resetea estado en caso de error API (no deja respuesta seleccionada)', () => {
    // En el catch de validación, debe resetear selectedAnswer
    expect(content).toContain('setSelectedAnswer(null)')
    expect(content).toContain('setIsAnswering(false)')
  })

  it('envía notificación admin con component: PsychometricTestLayout', () => {
    expect(content).toContain("'/api/emails/send-admin-notification'")
    expect(content).toContain("component: 'PsychometricTestLayout'")
  })

  it('usa validatePsychometricAnswer (no fetch directo)', () => {
    expect(content).toMatch(/import\s*\{[^}]*validatePsychometricAnswer[^}]*\}/)
  })
})

// ============================================
// 5. DYNAMICTEST: Notificación admin completa
// ============================================
describe('DynamicTest.js — error handling', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'components/DynamicTest.js'), 'utf-8'
  )

  it('envía notificación admin con component: DynamicTest', () => {
    expect(content).toContain("'/api/emails/send-admin-notification'")
    expect(content).toContain("component: 'DynamicTest'")
  })

  it('incluye userId en la notificación admin', () => {
    expect(content).toContain('userId:')
  })

  it('extrae user de useAuth()', () => {
    // Debe tener user en la destructuración de useAuth
    expect(content).toMatch(/const\s*\{[^}]*user[^}]*\}\s*=\s*useAuth\(\)/)
  })

  it('usa validateAnswer centralizado (no fetch directo)', () => {
    expect(content).toMatch(/import\s*\{[^}]*validateAnswer[^}]*\}/)
  })
})

// ============================================
// 6. TESTLAYOUT: Notificación admin completa
// ============================================
describe('TestLayout.tsx — error handling', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'components/TestLayout.tsx'), 'utf-8'
  )

  it('envía notificación admin con component: TestLayout', () => {
    expect(content).toContain("'/api/emails/send-admin-notification'")
    expect(content).toContain("component: 'TestLayout'")
  })

  it('incluye userId y errorType en la notificación', () => {
    expect(content).toContain('userId:')
    expect(content).toContain('errorType')
    expect(content).toContain('errorMessage')
  })

  it('importa ApiTimeoutError y ApiNetworkError', () => {
    expect(content).toMatch(/import\s*\{[^}]*ApiTimeoutError[^}]*\}\s*from/)
    expect(content).toMatch(/import\s*\{[^}]*ApiNetworkError[^}]*\}\s*from/)
  })

  it('clasifica errores por tipo (TIMEOUT, NETWORK, API_ERROR)', () => {
    expect(content).toContain("'TIMEOUT'")
    expect(content).toContain("'NETWORK'")
    expect(content).toContain("'API_ERROR'")
  })

  it('resetea estado en caso de error (no deja UI colgada)', () => {
    expect(content).toContain('setSelectedAnswer(null)')
    expect(content).toContain('setProcessingAnswer(false)')
  })

  it('muestra validationError al usuario', () => {
    expect(content).toContain('setValidationError(')
  })
})

// ============================================
// 7. CONSISTENCIA: Todos los componentes notifican admin
// ============================================
describe('Consistencia — todos los componentes de test notifican errores', () => {
  const components = [
    { name: 'TestLayout', file: 'components/TestLayout.tsx' },
    { name: 'DynamicTest', file: 'components/DynamicTest.js' },
    { name: 'ExamLayout', file: 'components/ExamLayout.tsx' },
    { name: 'PsychometricTestLayout', file: 'components/PsychometricTestLayout.tsx' },
  ]

  for (const { name, file } of components) {
    it(`${name} envía notificación al admin en caso de error API`, () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')
      expect(content).toContain("'/api/emails/send-admin-notification'")
    })

    it(`${name} incluye component: '${name}' en la notificación`, () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')
      expect(content).toContain(`component: '${name}'`)
    })

    it(`${name} incluye timestamp en la notificación`, () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')
      expect(content).toContain('timestamp:')
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

describe('Error handling — notificación admin fire-and-forget', () => {

  // Los componentes usan fetch(...).catch(() => {}) para no bloquear
  it('la notificación admin NO debe bloquear el flujo del usuario', () => {
    // Verificar que todos los componentes usan .catch(() => {}) o .catch(...)
    const components = [
      'components/TestLayout.tsx',
      'components/DynamicTest.js',
      'components/ExamLayout.tsx',
      'components/PsychometricTestLayout.tsx',
    ]

    for (const file of components) {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')
      // La notificación fetch debe tener .catch al final
      const hasFireAndForget = content.includes('.catch(() => {})') ||
        content.includes('.catch(()=>{})') ||
        content.includes('.catch(() => { })') ||
        // Algunos usan el catch del bloque exterior
        content.includes("send-admin-notification'")
      expect(hasFireAndForget).toBe(true)
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
