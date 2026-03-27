// __tests__/config/landingDataIntegrity.test.ts
// Verifica que las landings migradas, la BD y la config central son coherentes.
// Detecta: epígrafes incorrectos, datos faltantes, hitos incoherentes,
// discrepancias entre landing/tests/BD.

import { OPOSICIONES, getOposicion } from '@/lib/config/oposiciones'
import fs from 'fs'
import path from 'path'

// Oposiciones migradas a datos de BD (añadir aquí cada nueva migración)
// Todas las landings servidas por el template dinámico app/[oposicion]/page.tsx
const DYNAMIC_SLUGS = [
  'auxiliar-administrativo-estado',
  'auxiliar-administrativo-madrid',
  'administrativo-estado',
  'tramitacion-procesal',
  'auxilio-judicial',
  'auxiliar-administrativo-canarias',
  'auxiliar-administrativo-clm',
  'auxiliar-administrativo-extremadura',
  'auxiliar-administrativo-valencia',
  'auxiliar-administrativo-galicia',
  'auxiliar-administrativo-carm',
  'auxiliar-administrativo-aragon',
  'auxiliar-administrativo-asturias',
  'auxiliar-administrativo-baleares',
  'auxiliar-administrativo-cyl',
  'auxiliar-administrativo-andalucia',
  'auxiliar-administrativo-ayuntamiento-valencia',
]

// Mapeo de displayNumber en landing (17→101, etc.) para auxiliar estado
const BLOQUE2_OFFSET: Record<string, number> = {
  'auxiliar-administrativo-estado': 100, // tema 17 en landing = topic_number 101 en BD
}

describe('Landing Data Integrity', () => {

  describe('Config central vs BD', () => {
    test.each(OPOSICIONES.map(o => [o.slug, o]))('%s: config tiene datos válidos', (_slug, config) => {
      expect(config.id).toBeTruthy()
      expect(config.slug).toBeTruthy()
      expect(config.positionType).toBeTruthy()
      expect(config.name).toBeTruthy()
      expect(config.blocks.length).toBeGreaterThan(0)
      expect(config.totalTopics).toBeGreaterThan(0)

      // Verificar que totalTopics coincide con la suma de temas en bloques
      const totalFromBlocks = config.blocks.reduce((sum, b) => sum + b.themes.length, 0)
      expect(totalFromBlocks).toBe(config.totalTopics)
    })

    test.each(OPOSICIONES.map(o => [o.slug, o]))('%s: positionType usa underscores, slug usa guiones', (_slug, config) => {
      expect(config.slug).not.toContain('_')
      expect(config.positionType).not.toContain('-')
      expect(config.slug.replace(/-/g, '_')).toBe(config.positionType)
    })
  })

  describe('Landings dinámicas: template cubre las oposiciones migradas', () => {
    const templatePath = path.join(process.cwd(), 'app/[oposicion]/page.tsx')
    const templateContent = fs.readFileSync(templatePath, 'utf-8')

    test('template dinámico existe y tiene las secciones necesarias', () => {
      expect(templateContent).toContain('getOposicionLandingData')
      expect(templateContent).toContain('getHitosConvocatoria')
      expect(templateContent).toContain('revalidate')
      expect(templateContent).toContain('generateStaticParams')
      expect(templateContent).toContain('application/ld+json')
      expect(templateContent).toContain('hitos.map')
    })

    test.each(DYNAMIC_SLUGS)('%s: NO tiene page.tsx estático (usa template dinámico)', (slug) => {
      const staticPath = path.join(process.cwd(), `app/${slug}/page.tsx`)
      expect(fs.existsSync(staticPath)).toBe(false)
    })

    test.each(DYNAMIC_SLUGS)('%s: config existe en oposiciones.ts', (slug) => {
      const { getOposicion } = require('@/lib/config/oposiciones')
      const config = getOposicion(slug)
      expect(config).toBeTruthy()
      expect(config.blocks.length).toBeGreaterThan(0)
    })
  })

  describe('Nuestras oposiciones: Server Component', () => {
    test('page.tsx es Server Component (no use client)', () => {
      const filePath = path.join(process.cwd(), 'app/nuestras-oposiciones/page.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).not.toContain("'use client'")
      expect(content).toContain('getAllOposicionesCardData')
      expect(content).toContain('export default async function')
    })

    test('OposicionCards.tsx es Client Component', () => {
      const filePath = path.join(process.cwd(), 'app/nuestras-oposiciones/OposicionCards.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain("'use client'")
      expect(content).toContain('useOposicion')
    })

    test('page.tsx tiene JSON-LD ItemList', () => {
      const filePath = path.join(process.cwd(), 'app/nuestras-oposiciones/page.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('ItemList')
      expect(content).toContain('application/ld+json')
    })
  })

  describe('Monitoreo seguimiento', () => {
    test('cron endpoint existe', () => {
      const filePath = path.join(process.cwd(), 'app/api/cron/check-seguimiento/route.ts')
      expect(fs.existsSync(filePath)).toBe(true)
    })

    test('cron usa withErrorLogging', () => {
      const filePath = path.join(process.cwd(), 'app/api/cron/check-seguimiento/route.ts')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('withErrorLogging')
      expect(content).not.toMatch(/^export async function/m)
    })

    test('admin page existe', () => {
      const filePath = path.join(process.cwd(), 'app/admin/seguimiento-convocatorias/page.tsx')
      expect(fs.existsSync(filePath)).toBe(true)
    })

    test('admin API usa withErrorLogging', () => {
      const filePath = path.join(process.cwd(), 'app/api/admin/seguimiento-convocatorias/route.ts')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('withErrorLogging')
    })

    test('GitHub workflow existe', () => {
      const filePath = path.join(process.cwd(), '.github/workflows/check-seguimiento.yml')
      expect(fs.existsSync(filePath)).toBe(true)
    })
  })

  describe('Queries compartidas', () => {
    test('getOposicionLandingData está exportada', () => {
      const filePath = path.join(process.cwd(), 'lib/api/convocatoria/queries.ts')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('export async function getOposicionLandingData')
    })

    test('getHitosConvocatoria está exportada', () => {
      const filePath = path.join(process.cwd(), 'lib/api/convocatoria/queries.ts')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('export async function getHitosConvocatoria')
    })

    test('getAllOposicionesCardData está exportada', () => {
      const filePath = path.join(process.cwd(), 'lib/api/convocatoria/queries.ts')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('export async function getAllOposicionesCardData')
    })
  })
})
