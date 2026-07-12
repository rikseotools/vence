/**
 * @jest-environment jsdom
 */
// Simulación + guardarraíl del fix del bug de navegación de flor (12/07/2026):
// en rutas globales (/test/articulo…) el "volver a mi oposición" caía al DEFAULT
// (Estado) mientras el perfil cargaba → un usuario de Valencia aterrizaba en Estado.
// Fix: useOposicionPaths usa `userProfile.target_oposicion` (AuthContext, cacheado)
// como fallback ANTES de DEFAULT_SLUG. Estos tests usan el hook REAL + config REAL.
import React from 'react'
import { readFileSync } from 'fs'
import { join } from 'path'
import { render, screen } from '@testing-library/react'
import { useOposicionPaths } from '@/hooks/useOposicionPaths'

const mockOpo: { oposicionId: string | null } = { oposicionId: null }
const mockAuth: { userProfile: { target_oposicion?: string | null } | null } = { userProfile: null }
jest.mock('@/contexts/OposicionContext', () => ({ useOposicion: () => mockOpo }))
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }))

function Probe() {
  const { slug, testUrl } = useOposicionPaths()
  return (
    <div>
      <span data-testid="slug">{slug}</span>
      <span data-testid="testUrl">{testUrl}</span>
    </div>
  )
}

beforeEach(() => { mockOpo.oposicionId = null; mockAuth.userProfile = null })

describe('useOposicionPaths — fallback robusto a target_oposicion (fix flor)', () => {
  it('A) contexto resuelto (Valencia) → slug Valencia', () => {
    mockOpo.oposicionId = 'auxiliar_administrativo_valencia'
    render(<Probe />)
    expect(screen.getByTestId('slug').textContent).toBe('auxiliar-administrativo-valencia')
  })

  it('B) FIX: oposicionId null + perfil target Valencia → slug Valencia (NO Estado)', () => {
    mockOpo.oposicionId = null
    mockAuth.userProfile = { target_oposicion: 'auxiliar_administrativo_valencia' }
    render(<Probe />)
    expect(screen.getByTestId('slug').textContent).toBe('auxiliar-administrativo-valencia')
    expect(screen.getByTestId('testUrl').textContent).toContain('auxiliar-administrativo-valencia')
  })

  it('C) sin oposición ni perfil → DEFAULT (Estado)', () => {
    render(<Probe />)
    expect(screen.getByTestId('slug').textContent).toBe('auxiliar-administrativo-estado')
  })

  it('D) target inválido/sucio → DEFAULT (no rompe la navegación)', () => {
    mockAuth.userProfile = { target_oposicion: 'no_existe_xyz' }
    render(<Probe />)
    expect(screen.getByTestId('slug').textContent).toBe('auxiliar-administrativo-estado')
  })
})

describe('guardarraíl — no regresar al fallback naive (anti-repetición)', () => {
  const src = readFileSync(join(__dirname, '..', '..', 'hooks', 'useOposicionPaths.ts'), 'utf-8')
  it('usa userProfile.target_oposicion como fallback antes del DEFAULT', () => {
    expect(src).toMatch(/userProfile\?\.target_oposicion/)
  })
  it('valida el id contra ALL_OPOSICION_IDS (no mete un slug sucio en la URL)', () => {
    expect(src).toMatch(/ALL_OPOSICION_IDS\.includes/)
  })
})
