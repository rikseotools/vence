// __tests__/lib/api/validation-error-log/sourceCode.test.ts
// Verifica que las API routes usan withErrorLogging wrapper

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../../..')

// /api/answer eliminado en refactor 7ee5c172 (07-may-2026): reemplazado por
// /api/v2/answer-and-save (validar + guardar atómicamente).
const apiRoutes = [
  { file: 'app/api/v2/answer-and-save/route.ts', endpoint: '/api/v2/answer-and-save' },
  { file: 'app/api/exam/validate/route.ts', endpoint: '/api/exam/validate' },
  { file: 'app/api/answer/psychometric/route.ts', endpoint: '/api/answer/psychometric' },
  { file: 'app/api/exam/answer/route.ts', endpoint: '/api/exam/answer' },
  { file: 'app/api/exam/pending/route.js', endpoint: '/api/exam/pending' },
]

describe('API routes — withErrorLogging wrapper', () => {
  for (const { file, endpoint } of apiRoutes) {
    describe(endpoint, () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')

      it('importa withErrorLogging', () => {
        expect(content).toMatch(/import.*withErrorLogging.*from/)
      })

      it('exporta handler envuelto con withErrorLogging', () => {
        expect(content).toMatch(/export const (GET|POST) = withErrorLogging\(/)
      })

      it('usa el endpoint correcto en el wrapper', () => {
        expect(content).toContain(`withErrorLogging('${endpoint}'`)
      })
    })
  }
})

describe('withErrorLogging wrapper — source code', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'lib/api/withErrorLogging.ts'),
    'utf-8'
  )

  it('importa logValidationError', () => {
    expect(content).toMatch(/import.*logValidationError.*from/)
  })

  it('importa classifyError', () => {
    expect(content).toMatch(/import.*classifyError.*from/)
  })

  it('logea respuestas 400+', () => {
    expect(content).toMatch(/response\.status >= 400/)
  })

  it('captura errores no manejados', () => {
    expect(content).toMatch(/catch \(error\)/)
  })

  it('mide duración con startTime', () => {
    expect(content).toMatch(/Date\.now\(\) - startTime/)
  })

  it('extrae userAgent del request', () => {
    expect(content).toMatch(/user-agent/)
  })

  it('parsea body para POST/PUT/PATCH', () => {
    expect(content).toMatch(/request\.clone\(\)\.json\(\)/)
  })

  it('4xx fire-and-forget, 5xx awaitable', () => {
    // Política 2026-05-25: para 4xx (volumen alto) seguimos fire-and-forget,
    // pero para 5xx usamos logValidationErrorAwait para garantizar persistencia
    // antes de que Vercel suspenda la lambda al `return response`. Sin esto se
    // perdieron logs de 500 en /api/v2/admin/unread-sales el 2026-05-25.
    expect(content).not.toMatch(/await logValidationError\(/)  // sin "Await" prohibido
    expect(content).toMatch(/await logValidationErrorAwait\(/)  // variante 5xx obligatoria
  })
})

describe('next.config.mjs — deploy version', () => {
  const config = fs.readFileSync(path.join(ROOT, 'next.config.mjs'), 'utf-8')

  it('expone NEXT_PUBLIC_DEPLOY_VERSION', () => {
    expect(config).toMatch(/NEXT_PUBLIC_DEPLOY_VERSION/)
  })

  it('usa VERCEL_GIT_COMMIT_SHA', () => {
    expect(config).toMatch(/VERCEL_GIT_COMMIT_SHA/)
  })

  it('fallback a "local" cuando no hay SHA', () => {
    expect(config).toMatch(/\|\|\s*['"]local['"]/)
  })
})

describe('queries.ts — logValidationError es fire-and-forget', () => {
  const content = fs.readFileSync(
    path.join(ROOT, 'lib/api/validation-error-log/queries.ts'),
    'utf-8'
  )

  it('logValidationError retorna void (no async)', () => {
    expect(content).toMatch(/function logValidationError\(.*\):\s*void/)
  })

  it('usa .catch para no propagar errores', () => {
    expect(content).toMatch(/\.catch\(/)
  })

  it('usa VERCEL_GIT_COMMIT_SHA para deploy version', () => {
    expect(content).toMatch(/VERCEL_GIT_COMMIT_SHA/)
  })

  it('usa VERCEL_REGION', () => {
    expect(content).toMatch(/VERCEL_REGION/)
  })

  it('sanitiza el request body', () => {
    expect(content).toMatch(/sanitizeRequestBody/)
  })

  it('elimina campos sensibles (token, password)', () => {
    expect(content).toMatch(/delete sanitized\.token/)
    expect(content).toMatch(/delete sanitized\.password/)
  })
})
