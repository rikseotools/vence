/**
 * @jest-environment node
 *
 * URL pública del S3StorageAdapter según el endpoint configurado (soporte S3-compatible para mover
 * el storage a koigrid sin reescribir el adapter). El endpoint se lee del env en cada llamada.
 */
import { S3StorageAdapter } from '@/lib/storage/s3-adapter'

describe('S3StorageAdapter.getPublicUrl — endpoint-aware', () => {
  const adapter = new S3StorageAdapter()
  const ENV = process.env

  beforeEach(() => {
    process.env = { ...ENV }
    delete process.env.AWS_S3_ENDPOINT
    delete process.env.AWS_S3_PUBLIC_BASE
    process.env.AWS_S3_REGION = 'eu-west-2'
    process.env.AWS_S3_BUCKET = 'vence-uploads'
  })
  afterAll(() => { process.env = ENV })

  it('sin endpoint → URL nativa de AWS S3 (comportamiento por defecto, sin cambios)', () => {
    const url = adapter.getPublicUrl('temario-pdf', 'aux/1.pdf')
    expect(url).toBe('https://vence-uploads.s3.eu-west-2.amazonaws.com/temario-pdf/aux/1.pdf')
  })

  it('con AWS_S3_ENDPOINT → path-style contra el endpoint (koigrid / S3-compatible)', () => {
    process.env.AWS_S3_ENDPOINT = 'https://s3.koigrid.example/'
    const url = adapter.getPublicUrl('temario-pdf', 'aux/1.pdf')
    // barra final del endpoint normalizada, bucket en la ruta (path-style)
    expect(url).toBe('https://s3.koigrid.example/vence-uploads/temario-pdf/aux/1.pdf')
  })

  it('con AWS_S3_PUBLIC_BASE → base pública propia (CDN/dominio)', () => {
    process.env.AWS_S3_ENDPOINT = 'https://s3.koigrid.example'
    process.env.AWS_S3_PUBLIC_BASE = 'https://cdn.vence.es'
    const url = adapter.getPublicUrl('temario-pdf', 'aux/1.pdf')
    expect(url).toBe('https://cdn.vence.es/temario-pdf/aux/1.pdf')
  })
})
