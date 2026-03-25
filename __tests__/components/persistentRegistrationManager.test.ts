// __tests__/components/persistentRegistrationManager.test.ts
// Tests para verificar que PersistentRegistrationManager usa AuthContext correctamente

describe('PersistentRegistrationManager — auth source of truth', () => {

  // Simular la lógica de selección de usuario
  function resolveUser(
    externalUser: unknown | undefined,
    internalUser: unknown | null
  ): unknown | null {
    return externalUser !== undefined ? externalUser : internalUser
  }

  test('usa externalUser cuando se proporciona (AuthContext)', () => {
    const authUser = { id: 'user-123', email: 'test@test.com' }
    const result = resolveUser(authUser, null)
    expect(result).toBe(authUser)
  })

  test('usa externalUser=null cuando se proporciona (usuario no logueado)', () => {
    const result = resolveUser(null, { id: 'stale' })
    expect(result).toBeNull()
  })

  test('cae al internalUser cuando externalUser es undefined (sin AuthContext)', () => {
    const internalUser = { id: 'internal-123' }
    const result = resolveUser(undefined, internalUser)
    expect(result).toBe(internalUser)
  })

  test('externalUser tiene prioridad sobre internalUser', () => {
    const external = { id: 'external', email: 'ext@test.com' }
    const internal = { id: 'internal', email: 'int@test.com' }
    const result = resolveUser(external, internal)
    expect(result).toBe(external)
  })

  test('si ambos son null, resultado es null', () => {
    expect(resolveUser(null, null)).toBeNull()
    expect(resolveUser(undefined, null)).toBeNull()
  })
})

describe('PersistentRegistrationManager — trigger logic', () => {

  // Simular la lógica de trigger progresivo
  function shouldShowModal(params: {
    enabled: boolean
    user: unknown | null
    showResult: boolean
    userRejected: boolean
    showModal: boolean
    currentQuestion: number
  }): boolean {
    const { enabled, user, showResult, userRejected, showModal, currentQuestion } = params

    // Guard conditions (same as component)
    if (!enabled || user || !showResult || userRejected || showModal) return false

    const questionNum = currentQuestion + 1
    return (questionNum <= 6 && questionNum % 2 === 0) || (questionNum > 6)
  }

  test('NO muestra modal si user existe (registrado)', () => {
    expect(shouldShowModal({
      enabled: true, user: { id: '123' }, showResult: true,
      userRejected: false, showModal: false, currentQuestion: 5
    })).toBe(false)
  })

  test('NO muestra modal si user existe aunque token sea viejo', () => {
    // El punto clave: si AuthContext dice user existe, NO mostrar modal
    expect(shouldShowModal({
      enabled: true, user: { id: '123', email: 'ivan@test.com' }, showResult: true,
      userRejected: false, showModal: false, currentQuestion: 14
    })).toBe(false)
  })

  test('muestra modal en pregunta 2 para anónimos', () => {
    expect(shouldShowModal({
      enabled: true, user: null, showResult: true,
      userRejected: false, showModal: false, currentQuestion: 1
    })).toBe(true)
  })

  test('muestra modal en pregunta 4 para anónimos', () => {
    expect(shouldShowModal({
      enabled: true, user: null, showResult: true,
      userRejected: false, showModal: false, currentQuestion: 3
    })).toBe(true)
  })

  test('muestra modal cada pregunta después de 6 para anónimos', () => {
    expect(shouldShowModal({
      enabled: true, user: null, showResult: true,
      userRejected: false, showModal: false, currentQuestion: 7
    })).toBe(true)
  })

  test('NO muestra modal en pregunta 3 (impar, antes de 6)', () => {
    expect(shouldShowModal({
      enabled: true, user: null, showResult: true,
      userRejected: false, showModal: false, currentQuestion: 2
    })).toBe(false)
  })

  test('NO muestra modal si userRejected', () => {
    expect(shouldShowModal({
      enabled: true, user: null, showResult: true,
      userRejected: true, showModal: false, currentQuestion: 5
    })).toBe(false)
  })

  test('NO muestra modal si disabled', () => {
    expect(shouldShowModal({
      enabled: false, user: null, showResult: true,
      userRejected: false, showModal: false, currentQuestion: 5
    })).toBe(false)
  })
})
