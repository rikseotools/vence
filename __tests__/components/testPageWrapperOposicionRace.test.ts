/**
 * Race del contexto de oposición en TestPageWrapper (caso Laura/CARM, 18/06/2026).
 *
 * BUG: en rutas globales (/test/rapido, /test/aleatorio) la oposición del usuario
 * (`oposicionId`) se carga async desde el perfil. El `useEffect` que llama a
 * `loadQuestions()` NO esperaba a que cargara, así que `effectivePositionType`
 * caía al default 'auxiliar_administrativo_estado' y la API servía preguntas del
 * temario de Estado a usuarios de OTRA oposición (Laura, CARM, recibió CE art 134
 * "Presupuestos del Estado", que no está en su temario). El guard anti-double-fetch
 * (loadedForRef) luego "clavaba" ese resultado erróneo.
 *
 * FIX (TestPageWrapper.tsx):
 *   1. Gate en loadQuestions: `if (!positionType && (oposicionLoading || authLoading)) return`
 *      → no fetchea hasta conocer la oposición; NO marca loadedForRef.
 *   2. useEffect deps incluyen oposicionLoading/authLoading/oposicionId → re-dispara
 *      al resolverse → UN único fetch con el scope correcto.
 *
 * Estos tests SIMULAN la lógica real (gate + effectivePositionType + loadedForRef)
 * y verifican que no rompe las rutas con `positionType`, ni a anónimos, ni el guard.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const DEFAULT_PT = 'auxiliar_administrativo_estado'

type RenderState = {
  positionType?: string
  oposicionLoading: boolean
  authLoading: boolean
  oposicionId: string | null
  tema: number
  testType: string
  searchParamsKey: string
}

const effectivePositionType = (s: RenderState) =>
  s.positionType || s.oposicionId || DEFAULT_PT

// Réplica EXACTA del comportamiento de loadQuestions (con o sin el gate del fix).
function makeWrapperSim(withGate: boolean) {
  let loadedFor: string | null = null
  let loading = false
  const fetches: string[] = [] // positionType usado en cada fetch real

  async function loadQuestions(s: RenderState) {
    // GATE (el fix)
    if (withGate && !s.positionType && (s.oposicionLoading || s.authLoading)) {
      return { skipped: true, reason: 'waiting_oposicion' as const }
    }
    const loadKey = `${s.tema}-${s.testType}-${s.searchParamsKey}`
    if (loadedFor === loadKey) return { skipped: true, reason: 'already_loaded' as const }
    if (loading) return { skipped: true, reason: 'loading_in_progress' as const }
    try {
      loading = true
      const pt = effectivePositionType(s)
      await Promise.resolve()
      fetches.push(pt)
      loadedFor = loadKey
      return { skipped: false as const, positionType: pt }
    } finally {
      loading = false
    }
  }

  // Simula la secuencia de renders: el useEffect dispara loadQuestions en cada estado.
  async function renderSequence(states: RenderState[]) {
    for (const st of states) await loadQuestions(st)
  }

  return { loadQuestions, renderSequence, fetches: () => fetches }
}

const base = { tema: 0, testType: 'rapido', searchParamsKey: 'n=10' }

describe('TestPageWrapper — race del contexto de oposición', () => {
  describe('Reproducción del BUG (sin gate)', () => {
    test('ruta global + oposicion async → fetchea con el DEFAULT (Estado), no CARM', async () => {
      const sim = makeWrapperSim(false) // sin gate = comportamiento viejo
      await sim.renderSequence([
        // render 1: oposición aún cargando → CAE AL DEFAULT y se clava
        { ...base, oposicionLoading: true, authLoading: false, oposicionId: null },
        // render 2: ya cargó CARM, pero loadedForRef bloquea el refetch
        { ...base, oposicionLoading: false, authLoading: false, oposicionId: 'auxiliar_administrativo_carm' },
      ])
      // BUG: el único fetch fue con el temario de Estado (no el de Laura)
      expect(sim.fetches()).toEqual([DEFAULT_PT])
      expect(sim.fetches()).not.toContain('auxiliar_administrativo_carm')
    })
  })

  describe('FIX (con gate)', () => {
    test('ruta global CARM: espera y fetchea UNA vez con CARM, nunca con el default', async () => {
      const sim = makeWrapperSim(true)
      await sim.renderSequence([
        { ...base, oposicionLoading: true, authLoading: false, oposicionId: null },           // espera
        { ...base, oposicionLoading: false, authLoading: false, oposicionId: 'auxiliar_administrativo_carm' }, // fetch CARM
        { ...base, oposicionLoading: false, authLoading: false, oposicionId: 'auxiliar_administrativo_carm' }, // re-render: bloqueado
      ])
      expect(sim.fetches()).toEqual(['auxiliar_administrativo_carm'])
      expect(sim.fetches()).not.toContain(DEFAULT_PT)
    })

    test('authLoading también bloquea el fetch hasta que el usuario está listo', async () => {
      const sim = makeWrapperSim(true)
      await sim.renderSequence([
        { ...base, oposicionLoading: false, authLoading: true, oposicionId: null },            // espera (auth)
        { ...base, oposicionLoading: false, authLoading: false, oposicionId: 'tcae_sescam' },  // fetch real
      ])
      expect(sim.fetches()).toEqual(['tcae_sescam'])
    })

    test('NO rompe rutas /[oposicion]/… (positionType explícito): fetch inmediato aunque oposicionLoading=true', async () => {
      const sim = makeWrapperSim(true)
      await sim.renderSequence([
        { ...base, positionType: 'auxiliar_administrativo_carm', oposicionLoading: true, authLoading: true, oposicionId: null },
      ])
      // El gate se salta porque hay positionType → fetch inmediato con esa oposición
      expect(sim.fetches()).toEqual(['auxiliar_administrativo_carm'])
    })

    test('NO rompe anónimos / sin oposición: tras cargar (oposicionId null) cae al default como antes', async () => {
      const sim = makeWrapperSim(true)
      await sim.renderSequence([
        { ...base, oposicionLoading: true, authLoading: false, oposicionId: null },   // espera
        { ...base, oposicionLoading: false, authLoading: false, oposicionId: null },  // resuelto sin oposición
      ])
      expect(sim.fetches()).toEqual([DEFAULT_PT]) // comportamiento previo preservado
    })

    test('oposición ya cargada al montar: fetch inmediato con la correcta', async () => {
      const sim = makeWrapperSim(true)
      await sim.renderSequence([
        { ...base, oposicionLoading: false, authLoading: false, oposicionId: 'administrativo_andalucia' },
      ])
      expect(sim.fetches()).toEqual(['administrativo_andalucia'])
    })

    test('preserva el anti-double-fetch: misma config no re-fetchea', async () => {
      const sim = makeWrapperSim(true)
      const st: RenderState = { ...base, oposicionLoading: false, authLoading: false, oposicionId: 'auxiliar_administrativo_carm' }
      await sim.renderSequence([st, st, st])
      expect(sim.fetches()).toEqual(['auxiliar_administrativo_carm']) // una sola vez
    })
  })

  describe('Guard de arquitectura (anti-regresión del propio fix)', () => {
    const src = readFileSync(join(process.cwd(), 'components/TestPageWrapper.tsx'), 'utf8')

    test('loadQuestions tiene el gate que espera a la oposición', () => {
      expect(src).toMatch(/if\s*\(\s*!positionType\s*&&\s*\(\s*oposicionLoading\s*\|\|\s*authLoading\s*\)\s*\)/)
    })

    test('el useEffect de carga incluye oposicionLoading en sus deps', () => {
      // el array de deps del useEffect que llama loadQuestions debe listar oposicionLoading
      const m = src.match(/loadQuestions\(\)\s*\n\s*\},\s*\[([^\]]*)\]/)
      expect(m).not.toBeNull()
      expect(m![1]).toContain('oposicionLoading')
    })

    test('sigue existiendo el default fallback solo como último recurso (no para usuarios con oposición)', () => {
      // El default sigue ahí (anónimos), pero el gate impide usarlo durante la carga.
      expect(src).toContain("'auxiliar_administrativo_estado'")
    })
  })
})
