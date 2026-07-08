import { isSyntheticRequest } from '@/lib/api/syntheticRequest'

// Simula la interfaz mínima de Request: headers.get()
function req(headers: Record<string, string>) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  return { headers: { get: (name: string) => map.get(name.toLowerCase()) ?? null } }
}

describe('isSyntheticRequest', () => {
  it('detecta el header canónico x-vence-canary=1 (el que envían TODOS los canaries)', () => {
    expect(isSyntheticRequest(req({ 'x-vence-canary': '1' }))).toBe(true)
  })

  it('acepta también "true" por robustez', () => {
    expect(isSyntheticRequest(req({ 'x-vence-canary': 'true' }))).toBe(true)
  })

  it('es case-insensitive en el nombre del header', () => {
    expect(isSyntheticRequest(req({ 'X-Vence-Canary': '1' }))).toBe(true)
  })

  it('tráfico real (sin el header) NO es sintético', () => {
    expect(isSyntheticRequest(req({ 'user-agent': 'Mozilla/5.0' }))).toBe(false)
  })

  it('no se activa con valores distintos de 1/true', () => {
    expect(isSyntheticRequest(req({ 'x-vence-canary': '0' }))).toBe(false)
    expect(isSyntheticRequest(req({ 'x-vence-canary': 'false' }))).toBe(false)
    expect(isSyntheticRequest(req({ 'x-vence-canary': '' }))).toBe(false)
  })

  it('defensivo: no lanza con request/headers null/undefined', () => {
    expect(isSyntheticRequest(null)).toBe(false)
    expect(isSyntheticRequest(undefined)).toBe(false)
    expect(isSyntheticRequest({ headers: null })).toBe(false)
    expect(isSyntheticRequest({})).toBe(false)
  })
})
