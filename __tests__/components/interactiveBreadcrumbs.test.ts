// __tests__/components/interactiveBreadcrumbs.test.ts
// Tests para verificar que la lógica de detección de oposición en breadcrumbs
// es escalable y funciona para todas las oposiciones desde OPOSICIONES config.

import { OPOSICIONES, getBlockForTopic } from '@/lib/config/oposiciones'
import { hasCcaaFlag } from '@/components/CcaaFlag'

// Simular la lógica central del componente refactorizado
function detectOposicion(pathname: string) {
  const currentOpo = OPOSICIONES.find(o => pathname.includes('/' + o.slug))
  const isOposicion = !!currentOpo
  const isLeyes = pathname.includes('/leyes')
  const isTeoria = pathname.includes('/teoria')
  const isPsicotecnicos = pathname.includes('/psicotecnicos')
  const isInTests = pathname.includes('/test')
  const isInTemario = pathname.includes('/temario')
  const isStandaloneTest = pathname.startsWith('/test/') && !currentOpo
  const isInInfo = currentOpo ? pathname === '/' + currentOpo.slug : false

  return { currentOpo, isOposicion, isLeyes, isTeoria, isPsicotecnicos, isInTests, isInTemario, isStandaloneTest, isInInfo }
}

function getLabel(pathname: string) {
  const { currentOpo, isLeyes, isTeoria, isPsicotecnicos, isStandaloneTest } = detectOposicion(pathname)
  if (currentOpo) {
    if (hasCcaaFlag(currentOpo.id)) {
      return `[FLAG:${currentOpo.id}] ${currentOpo.shortName}`
    }
    return `${currentOpo.emoji} ${currentOpo.shortName}`
  }
  if (isLeyes) return '📚 Leyes'
  if (isTeoria) return '📖 Teoría'
  if (isPsicotecnicos) return '🧩 Psicotécnicos'
  if (isStandaloneTest) return '🎯 Tests'
  return ''
}

function getLinkHref(pathname: string) {
  const { currentOpo, isLeyes, isTeoria, isPsicotecnicos } = detectOposicion(pathname)
  if (currentOpo) return '/' + currentOpo.slug
  if (isLeyes) return '/leyes'
  if (isTeoria) return '/teoria'
  if (isPsicotecnicos) return '/psicotecnicos'
  return '#'
}

describe('InteractiveBreadcrumbs — detección dinámica de oposición', () => {

  test('OPOSICIONES tiene al menos 15 oposiciones', () => {
    expect(OPOSICIONES.length).toBeGreaterThanOrEqual(15)
  })

  test('todas las oposiciones se detectan por pathname', () => {
    for (const opo of OPOSICIONES) {
      const result = detectOposicion(`/${opo.slug}/test`)
      expect(result.currentOpo?.slug).toBe(opo.slug)
      expect(result.isOposicion).toBe(true)
    }
  })

  test('página principal de oposición detecta isInInfo', () => {
    for (const opo of OPOSICIONES) {
      const result = detectOposicion(`/${opo.slug}`)
      expect(result.isInInfo).toBe(true)
      expect(result.isOposicion).toBe(true)
    }
  })

  test('subpágina de oposición NO es isInInfo', () => {
    for (const opo of OPOSICIONES) {
      const result = detectOposicion(`/${opo.slug}/test`)
      expect(result.isInInfo).toBe(false)
    }
  })

  test('temario de oposición detecta isInTemario', () => {
    for (const opo of OPOSICIONES) {
      const result = detectOposicion(`/${opo.slug}/temario/tema-1`)
      expect(result.isInTemario).toBe(true)
      expect(result.isOposicion).toBe(true)
    }
  })

  test('test standalone sin oposición se detecta correctamente', () => {
    const result = detectOposicion('/test/rapido')
    expect(result.isStandaloneTest).toBe(true)
    expect(result.isOposicion).toBe(false)
    expect(result.currentOpo).toBeUndefined()
  })

  test('leyes se detecta correctamente', () => {
    const result = detectOposicion('/leyes/ley-39-2015')
    expect(result.isLeyes).toBe(true)
    expect(result.isOposicion).toBe(false)
  })

  test('psicotécnicos se detecta correctamente', () => {
    const result = detectOposicion('/psicotecnicos/test')
    expect(result.isPsicotecnicos).toBe(true)
  })

  test('página raíz no detecta nada', () => {
    const result = detectOposicion('/')
    expect(result.isOposicion).toBe(false)
    expect(result.isLeyes).toBe(false)
    expect(result.isStandaloneTest).toBe(false)
  })
})

describe('InteractiveBreadcrumbs — labels escalables', () => {

  test('oposiciones CCAA usan bandera + shortName', () => {
    const ccaaOpos = OPOSICIONES.filter(o => hasCcaaFlag(o.id))
    expect(ccaaOpos.length).toBeGreaterThan(0)

    for (const opo of ccaaOpos) {
      const label = getLabel(`/${opo.slug}/test`)
      expect(label).toContain(opo.shortName)
      expect(label).toContain(`[FLAG:${opo.id}]`)
    }
  })

  test('oposiciones nacionales usan emoji + shortName', () => {
    const nationalOpos = OPOSICIONES.filter(o => !hasCcaaFlag(o.id))
    expect(nationalOpos.length).toBeGreaterThan(0)

    for (const opo of nationalOpos) {
      const label = getLabel(`/${opo.slug}/test`)
      expect(label).toContain(opo.shortName)
      expect(label).toContain(opo.emoji)
    }
  })

  test('cada oposición tiene shortName definido', () => {
    for (const opo of OPOSICIONES) {
      expect(opo.shortName).toBeTruthy()
      expect(opo.shortName.length).toBeGreaterThan(0)
    }
  })
})

describe('InteractiveBreadcrumbs — links escalables', () => {

  test('link de cada oposición apunta a su slug', () => {
    for (const opo of OPOSICIONES) {
      const href = getLinkHref(`/${opo.slug}/temario/tema-3`)
      expect(href).toBe(`/${opo.slug}`)
    }
  })

  test('link de leyes apunta a /leyes', () => {
    expect(getLinkHref('/leyes/ley-39-2015')).toBe('/leyes')
  })

  test('link de teoría apunta a /teoria', () => {
    expect(getLinkHref('/teoria/constitucion-espanola')).toBe('/teoria')
  })

  test('link de psicotécnicos apunta a /psicotecnicos', () => {
    expect(getLinkHref('/psicotecnicos/test')).toBe('/psicotecnicos')
  })
})

describe('InteractiveBreadcrumbs — bloques de temas', () => {

  test('getBlockForTopic funciona para oposiciones con bloques', () => {
    const oposWithBlocks = OPOSICIONES.filter(o => o.blocks.length > 0)
    expect(oposWithBlocks.length).toBeGreaterThan(0)

    for (const opo of oposWithBlocks) {
      const firstTheme = opo.blocks[0].themes[0]
      if (firstTheme) {
        const block = getBlockForTopic(opo.slug, firstTheme.id)
        expect(block).not.toBeNull()
        expect(block?.blockTitle).toBeTruthy()
      }
    }
  })
})
