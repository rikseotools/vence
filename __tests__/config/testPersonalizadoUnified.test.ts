// __tests__/config/testPersonalizadoUnified.test.ts
// Tests para verificar que la ruta dinámica [oposicion]/test/test-personalizado
// funciona correctamente para todas las oposiciones.

import fs from 'fs'
import path from 'path'
import {
  OPOSICIONES,
  ALL_OPOSICION_SLUGS,
  SLUG_TO_POSITION_TYPE,
  getOposicion,
} from '@/lib/config/oposiciones'
import { OPOSICION_BLOCKS_CONFIG } from '@/lib/api/random-test/schemas'

describe('Test Personalizado - Ruta dinámica unificada', () => {

  describe('Ruta dinámica existe y es válida', () => {
    test('page.tsx existe en [oposicion]/test/test-personalizado', () => {
      const filePath = path.join(process.cwd(), 'app/[oposicion]/test/test-personalizado/page.tsx')
      expect(fs.existsSync(filePath)).toBe(true)
    })

    test('es un Client Component (use client)', () => {
      const filePath = path.join(process.cwd(), 'app/[oposicion]/test/test-personalizado/page.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain("'use client'")
    })

    test('usa SLUG_TO_POSITION_TYPE para derivar positionType', () => {
      const filePath = path.join(process.cwd(), 'app/[oposicion]/test/test-personalizado/page.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('SLUG_TO_POSITION_TYPE')
    })

    test('valida oposición con getOposicion y llama notFound si no existe', () => {
      const filePath = path.join(process.cwd(), 'app/[oposicion]/test/test-personalizado/page.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('getOposicion')
      expect(content).toContain('notFound')
    })

    test('pasa positionType a TestPageWrapper', () => {
      const filePath = path.join(process.cwd(), 'app/[oposicion]/test/test-personalizado/page.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('positionType={positionType}')
    })

    test('NO hardcodea ningún positionType', () => {
      const filePath = path.join(process.cwd(), 'app/[oposicion]/test/test-personalizado/page.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')
      // No debe tener positionType="auxiliar_administrativo_estado" ni similar hardcodeado
      expect(content).not.toMatch(/positionType=["']auxiliar_/)
      expect(content).not.toMatch(/positionType=["']administrativo_/)
      expect(content).not.toMatch(/positionType=["']tramitacion_/)
      expect(content).not.toMatch(/positionType=["']auxilio_/)
    })
  })

  describe('Config central soporta todas las oposiciones', () => {
    test.each(ALL_OPOSICION_SLUGS)('%s: SLUG_TO_POSITION_TYPE devuelve un valor', (slug) => {
      const pt = SLUG_TO_POSITION_TYPE[slug]
      expect(pt).toBeTruthy()
      expect(typeof pt).toBe('string')
    })

    test.each(ALL_OPOSICION_SLUGS)('%s: getOposicion devuelve config', (slug) => {
      const config = getOposicion(slug)
      expect(config).toBeTruthy()
      expect(config?.slug).toBe(slug)
    })

    test.each(ALL_OPOSICION_SLUGS)('%s: OPOSICION_BLOCKS_CONFIG tiene entrada', (slug) => {
      const blocksConfig = OPOSICION_BLOCKS_CONFIG[slug]
      expect(blocksConfig).toBeTruthy()
      expect(blocksConfig.blocks.length).toBeGreaterThan(0)
    })

    test.each(ALL_OPOSICION_SLUGS)('%s: positionType usa underscores, slug usa guiones', (slug) => {
      const pt = SLUG_TO_POSITION_TYPE[slug]
      expect(slug).not.toContain('_')
      expect(pt).not.toContain('-')
      expect(pt).toBe(slug.replace(/-/g, '_'))
    })
  })

  describe('Páginas individuales multi-tema eliminadas', () => {
    test.each(ALL_OPOSICION_SLUGS)('%s: NO tiene página individual en test/test-personalizado', (slug) => {
      const dir = path.join(process.cwd(), `app/${slug}/test/test-personalizado`)
      expect(fs.existsSync(dir)).toBe(false)
    })
  })

  describe('Ruta dinámica por tema [oposicion]/test/tema/[numero]/test-personalizado', () => {
    test('page.tsx existe', () => {
      const filePath = path.join(process.cwd(), 'app/[oposicion]/test/tema/[numero]/test-personalizado/page.tsx')
      expect(fs.existsSync(filePath)).toBe(true)
    })

    test('usa generateStaticParams para SSG', () => {
      const filePath = path.join(process.cwd(), 'app/[oposicion]/test/tema/[numero]/test-personalizado/page.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('generateStaticParams')
    })

    test('usa getOposicion para validar y notFound para slugs inválidos', () => {
      const filePath = path.join(process.cwd(), 'app/[oposicion]/test/tema/[numero]/test-personalizado/page.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('getOposicion')
      expect(content).toContain('notFound')
    })

    test('usa TestPersonalizadoPage (mismo componente que las individuales)', () => {
      const filePath = path.join(process.cwd(), 'app/[oposicion]/test/tema/[numero]/test-personalizado/page.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain('TestPersonalizadoPage')
    })

    test.each(ALL_OPOSICION_SLUGS)('%s: NO tiene página individual por tema', (slug) => {
      const dir = path.join(process.cwd(), `app/${slug}/test/tema/[numero]/test-personalizado`)
      expect(fs.existsSync(dir)).toBe(false)
    })
  })
})
