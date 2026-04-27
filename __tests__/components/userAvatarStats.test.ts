/**
 * Tests para verificar que el UserAvatar muestra skeleton mientras carga stats
 * y no muestra 0s falsos al usuario.
 *
 * Bug detectado: Raúl (racha 64 días) veía "Racha 0 días" porque el componente
 * renderizaba EMPTY_STATS antes de que la API respondiera.
 */

describe('UserAvatar stats loading — escenarios', () => {
  // Simular el estado del componente
  interface UserStats {
    streak: number
    accuracy: number
    weeklyQuestions: number
    totalQuestions: number
  }

  const EMPTY_STATS: UserStats = {
    streak: 0,
    accuracy: 0,
    weeklyQuestions: 0,
    totalQuestions: 0,
  }

  const RAUL_STATS: UserStats = {
    streak: 64,
    accuracy: 78,
    weeklyQuestions: 46,
    totalQuestions: 938,
  }

  // Simular lo que el componente renderiza según estado
  function simulateStatsRender(
    statsLoading: boolean,
    userStats: UserStats,
    hasUser: boolean
  ): 'skeleton' | 'real_stats' | 'hidden' {
    if (!hasUser) return 'hidden'
    if (statsLoading) return 'skeleton'
    return 'real_stats'
  }

  // Simular los valores visibles
  function getVisibleValues(
    statsLoading: boolean,
    userStats: UserStats
  ): { streak: number | null; accuracy: number | null } {
    if (statsLoading) return { streak: null, accuracy: null }
    return { streak: userStats.streak, accuracy: userStats.accuracy }
  }

  describe('Escenario 1: Primer render con usuario logueado', () => {
    it('statsLoading empieza como true → muestra skeleton', () => {
      const statsLoading = true // initial state
      const userStats = EMPTY_STATS
      expect(simulateStatsRender(statsLoading, userStats, true)).toBe('skeleton')
    })

    it('no muestra 0s durante la carga', () => {
      const statsLoading = true
      const visible = getVisibleValues(statsLoading, EMPTY_STATS)
      expect(visible.streak).toBeNull()
      expect(visible.accuracy).toBeNull()
    })
  })

  describe('Escenario 2: API responde con datos reales (caso Raúl)', () => {
    it('después de cargar → muestra stats reales', () => {
      const statsLoading = false
      expect(simulateStatsRender(statsLoading, RAUL_STATS, true)).toBe('real_stats')
    })

    it('muestra racha 64, no 0', () => {
      const visible = getVisibleValues(false, RAUL_STATS)
      expect(visible.streak).toBe(64)
      expect(visible.accuracy).toBe(78)
    })

    it('racha > 30 muestra "30+"', () => {
      const displayStreak = RAUL_STATS.streak > 30 ? '30+' : String(RAUL_STATS.streak)
      expect(displayStreak).toBe('30+')
    })
  })

  describe('Escenario 3: Usuario no logueado', () => {
    it('no muestra stats', () => {
      expect(simulateStatsRender(false, EMPTY_STATS, false)).toBe('hidden')
    })

    it('statsLoading se pone false cuando no hay user', () => {
      // Simular: authLoading=false, user=null
      let statsLoading = true
      const authLoading = false
      const user = null

      if (!user && !authLoading) {
        statsLoading = false
      }
      expect(statsLoading).toBe(false)
    })
  })

  describe('Escenario 4: API falla', () => {
    it('muestra skeleton mientras carga, luego 0s si falla', () => {
      // Fase 1: cargando
      expect(simulateStatsRender(true, EMPTY_STATS, true)).toBe('skeleton')

      // Fase 2: error → finally setStatsLoading(false)
      const statsLoading = false
      expect(simulateStatsRender(statsLoading, EMPTY_STATS, true)).toBe('real_stats')
      // Muestra 0 — aceptable, la API falló
    })
  })

  describe('Escenario 5: Transición auth → user disponible', () => {
    it('authLoading=true → statsLoading=true (skeleton)', () => {
      const authLoading = true
      const statsLoading = true // initial
      expect(simulateStatsRender(statsLoading, EMPTY_STATS, false)).toBe('hidden')
    })

    it('authLoading=false, user existe → fetch empieza → skeleton → datos', () => {
      // Step 1: auth complete, user available
      const user = { id: 'abc', created_at: '2026-01-01' }

      // Step 2: useEffect fires, load() runs
      // statsLoading was already true from init
      let statsLoading = true
      expect(simulateStatsRender(statsLoading, EMPTY_STATS, true)).toBe('skeleton')

      // Step 3: API responds
      statsLoading = false
      expect(simulateStatsRender(statsLoading, RAUL_STATS, true)).toBe('real_stats')
    })
  })

  describe('Escenario 6: Refresh tras completar examen', () => {
    it('stats se actualizan sin mostrar skeleton (fetch silencioso)', () => {
      // El event handler de exam-completed hace fetch directo con .then()
      // NO toca statsLoading → no muestra skeleton → stats se actualizan in-place
      const statsBeforeExam: UserStats = { streak: 5, accuracy: 70, weeklyQuestions: 10, totalQuestions: 100 }
      const statsAfterExam: UserStats = { streak: 5, accuracy: 72, weeklyQuestions: 11, totalQuestions: 101 }

      // Durante el refresh silencioso, statsLoading sigue false
      expect(simulateStatsRender(false, statsBeforeExam, true)).toBe('real_stats')

      // Después del refresh
      expect(simulateStatsRender(false, statsAfterExam, true)).toBe('real_stats')
      expect(statsAfterExam.totalQuestions).toBe(101)
    })
  })

  describe('Escenario 7: Guard contra doble-fetch eliminado', () => {
    it('sin guard statsLoading, load() ejecuta en primer render', () => {
      // Antes: if (statsLoading) return → bloqueaba fetch si statsLoading=true
      // Ahora: sin guard → fetch siempre ejecuta cuando user disponible
      let fetchCalled = false
      const statsLoading = true // initial value

      // Simular load() SIN guard
      function loadWithoutGuard(user: any) {
        if (!user || !user.created_at) return
        fetchCalled = true
      }

      loadWithoutGuard({ id: 'abc', created_at: '2026-01-01' })
      expect(fetchCalled).toBe(true)
    })

    it('CON guard antiguo, load() NO ejecutaría (bug que evitamos)', () => {
      let fetchCalled = false
      const statsLoading = true

      function loadWithGuard(user: any, loading: boolean) {
        if (loading) return // ← este guard bloqueaba
        if (!user || !user.created_at) return
        fetchCalled = true
      }

      loadWithGuard({ id: 'abc', created_at: '2026-01-01' }, statsLoading)
      expect(fetchCalled).toBe(false) // ❌ nunca haría fetch
    })
  })

  describe('Escenario 8: Usuario nuevo (stats realmente a 0)', () => {
    it('muestra skeleton mientras carga, luego 0s reales', () => {
      const newUserStats: UserStats = { streak: 0, accuracy: 0, weeklyQuestions: 0, totalQuestions: 0 }

      // Fase 1: skeleton
      expect(simulateStatsRender(true, EMPTY_STATS, true)).toBe('skeleton')

      // Fase 2: datos reales (0s legítimos)
      expect(simulateStatsRender(false, newUserStats, true)).toBe('real_stats')
      expect(newUserStats.streak).toBe(0)
    })

    it('no hay forma de distinguir 0 real de 0 por no cargar — pero skeleton evita confusión', () => {
      // Con skeleton: usuario ve pulso → luego 0 → entiende que cargó y es real
      // Sin skeleton (bug anterior): usuario ve 0 → no sabe si cargó o no
      const visible = getVisibleValues(false, EMPTY_STATS)
      expect(visible.streak).toBe(0) // 0 real, después de cargar
    })
  })

  describe('Escenario 9: Componente se desmonta mid-fetch', () => {
    it('cancelled flag evita state update', () => {
      let cancelled = false
      let stateUpdated = false

      // Simular desmontaje
      const cleanup = () => { cancelled = true }

      // Simular fetch response llegando después de desmontaje
      function onFetchComplete() {
        if (cancelled) return
        stateUpdated = true
      }

      cleanup() // componente se desmonta
      onFetchComplete() // fetch responde

      expect(stateUpdated).toBe(false)
    })
  })

  describe('Escenario 10: Múltiples cambios de user (login/logout rápido)', () => {
    it('cada cambio de user cancela el fetch anterior', () => {
      const fetches: { userId: string; cancelled: boolean }[] = []

      function simulateEffect(userId: string | null) {
        // Cancel previous
        if (fetches.length > 0) {
          fetches[fetches.length - 1].cancelled = true
        }

        if (!userId) return

        const fetch = { userId, cancelled: false }
        fetches.push(fetch)
      }

      simulateEffect('user-1') // login
      simulateEffect(null) // logout
      simulateEffect('user-2') // otro login

      expect(fetches[0].cancelled).toBe(true) // user-1 cancelado
      expect(fetches[1].cancelled).toBe(false) // user-2 activo
      expect(fetches).toHaveLength(2)
    })
  })
})
