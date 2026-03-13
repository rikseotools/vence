// __tests__/lib/api/validation-error-log/sourceCode.test.ts
// Verifica que las 3 API routes importan y usan logValidationError

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../../..')

const apiRoutes = [
  { file: 'app/api/answer/route.ts', endpoint: '/api/answer' },
  { file: 'app/api/exam/validate/route.ts', endpoint: '/api/exam/validate' },
  { file: 'app/api/answer/psychometric/route.ts', endpoint: '/api/answer/psychometric' },
]

describe('API routes — validation error logging integrado', () => {
  for (const { file, endpoint } of apiRoutes) {
    describe(endpoint, () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')

      it('importa logValidationError', () => {
        expect(content).toMatch(/import.*logValidationError.*from/)
      })

      it('importa classifyError', () => {
        expect(content).toMatch(/import.*classifyError.*from/)
      })

      it('llama a logValidationError en el catch de errores 500', () => {
        expect(content).toMatch(/logValidationError\(\{[\s\S]*?errorType:\s*classifyError\(error\)/)
      })

      it('incluye durationMs para medir latencia', () => {
        expect(content).toMatch(/durationMs:\s*Date\.now\(\)\s*-\s*startTime/)
      })

      it('incluye userAgent del request', () => {
        expect(content).toMatch(/userAgent:\s*request\.headers\.get\(['"]user-agent['"]\)/)
      })

      it('mide startTime al inicio del handler', () => {
        expect(content).toMatch(/const startTime = Date\.now\(\)/)
      })
    })
  }
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
