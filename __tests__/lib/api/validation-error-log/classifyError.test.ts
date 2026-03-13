// __tests__/lib/api/validation-error-log/classifyError.test.ts
import { classifyError } from '@/lib/api/validation-error-log/queries'

describe('classifyError', () => {
  it('clasifica timeout errors', () => {
    expect(classifyError(new Error('Request timed out after 10000ms'))).toBe('timeout')
    expect(classifyError(new Error('The operation was aborted'))).toBe('timeout')
    expect(classifyError(new Error('connect ETIMEDOUT'))).toBe('timeout')
  })

  it('clasifica network errors', () => {
    expect(classifyError(new Error('fetch failed'))).toBe('network')
    expect(classifyError(new Error('connect ECONNREFUSED'))).toBe('network')
    expect(classifyError(new Error('read ECONNRESET'))).toBe('network')
    expect(classifyError(new Error('Network error'))).toBe('network')
  })

  it('clasifica db connection errors', () => {
    expect(classifyError(new Error('connection terminated unexpectedly'))).toBe('db_connection')
    expect(classifyError(new Error('too many clients already'))).toBe('db_connection')
    expect(classifyError(new Error('pool is full'))).toBe('db_connection')
    expect(classifyError(new Error('connect_timeout exceeded'))).toBe('db_connection')
  })

  it('clasifica validation errors', () => {
    expect(classifyError(new Error('Invalid input'))).toBe('validation')
    expect(classifyError(new Error('Validation failed'))).toBe('validation')
    expect(classifyError(new Error('Could not parse body'))).toBe('validation')
  })

  it('devuelve unknown para errores genéricos', () => {
    expect(classifyError(new Error('Something went wrong'))).toBe('unknown')
    expect(classifyError(new Error('Unexpected error'))).toBe('unknown')
  })

  it('devuelve unknown para no-Error', () => {
    expect(classifyError('string error')).toBe('unknown')
    expect(classifyError(42)).toBe('unknown')
    expect(classifyError(null)).toBe('unknown')
    expect(classifyError(undefined)).toBe('unknown')
    expect(classifyError({ message: 'not an Error' })).toBe('unknown')
  })

  it('es case-insensitive', () => {
    expect(classifyError(new Error('TIMEOUT'))).toBe('timeout')
    expect(classifyError(new Error('Fetch Failed'))).toBe('network')
    expect(classifyError(new Error('CONNECTION REFUSED'))).toBe('db_connection')
  })
})
