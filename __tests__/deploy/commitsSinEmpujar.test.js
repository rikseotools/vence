const { puedeResetear, motivoValido } = require('../../lib/deploy/commitsSinEmpujar.cjs')

describe('commitsSinEmpujar — el lanzador no puede resetear sobre commits ajenos (T-443 punto 6)', () => {
  describe('el caso que destruyó trabajo dos veces el 05/08/2026', () => {
    // Árbol LIMPIO (git status impecable) pero con commits que no están en origin/main.
    // La guarda de "árbol sucio" que ya existía no los ve, y el reset --hard los descarta.
    it('bloquea cuando hay commits por delante de origin/main', () => {
      const r = puedeResetear({ commitsPorDelante: 2 })
      expect(r.permite).toBe(false)
      expect(r.motivo).toBe('commits_sin_empujar')
      expect(r.mensaje).toContain('NO están en origin/main')
    })

    it('enseña CUÁLES son, para poder decidir si son tuyos', () => {
      const r = puedeResetear({
        commitsPorDelante: 2,
        resumenCommits: ['b3f9692 feat(T-443): …', 'a1b2c3d fix(T-427): …'],
      })
      expect(r.mensaje).toContain('b3f9692 feat(T-443)')
      expect(r.mensaje).toContain('a1b2c3d fix(T-427)')
    })

    it('propone las tres salidas: pushear, cambiar de árbol o escapar con motivo', () => {
      const { mensaje } = puedeResetear({ commitsPorDelante: 1 })
      expect(mensaje).toContain('git push origin HEAD:main')
      expect(mensaje).toContain('Despliega desde otro árbol')
      expect(mensaje).toContain('DEPLOY_RESET_OK')
    })
  })

  describe('el caso normal no se toca', () => {
    it.each([[0], [-0]])('deja pasar con %s commits por delante', (n) => {
      const r = puedeResetear({ commitsPorDelante: n })
      expect(r.permite).toBe(true)
      expect(r.motivo).toBe('limpio')
      expect(r.mensaje).toBe('')
    })
  })

  describe('no medir NO es motivo para parar un deploy', () => {
    // Es un `git rev-list` local: si falla, el problema es otro. Bloquear aquí pararía
    // deploys por una avería ajena a esto.
    it.each([[null], [undefined], [NaN]])('deja pasar avisando cuando el conteo es %s', (v) => {
      const r = puedeResetear({ commitsPorDelante: v })
      expect(r.permite).toBe(true)
      expect(r.motivo).toBe('sin_medir')
      expect(r.mensaje).toContain('no se pudo comprobar')
    })

    it('sin argumentos tampoco opina', () => {
      expect(puedeResetear().permite).toBe(true)
    })
  })

  describe('el escape exige un MOTIVO de verdad', () => {
    // T-496/T-497: un `=1` se vuelve un prefijo que se copia de un comando a otro y deja
    // de ser una decisión.
    it('deja pasar con motivo explicado, y lo deja dicho', () => {
      const r = puedeResetear({
        commitsPorDelante: 3,
        escape: 'son fixtures de un test que ya descarté',
      })
      expect(r.permite).toBe(true)
      expect(r.escapeUsado).toBe(true)
      expect(r.mensaje).toContain('son fixtures')
      expect(r.mensaje).toContain('3 commit(s)')
    })

    it.each([['1'], ['true'], ['si'], ['ok'], ['x'], ['   ']])(
      'NO acepta «%s» como motivo',
      (v) => {
        const r = puedeResetear({ commitsPorDelante: 3, escape: v })
        expect(r.permite).toBe(false)
      },
    )

    it('si el escape viene sin motivo válido, lo dice en vez de callar', () => {
      const r = puedeResetear({ commitsPorDelante: 1, escape: '1' })
      expect(r.motivo).toBe('escape_sin_motivo')
      expect(r.mensaje).toContain('necesita un MOTIVO')
    })
  })

  describe('motivoValido', () => {
    it.each([['1'], ['ok'], ['sí'], [''], [null], ['yes']])('rechaza %s', (v) => {
      expect(motivoValido(v)).toBe(false)
    })
    it('acepta una explicación real', () => {
      expect(motivoValido('descarto los fixtures del test de ayer')).toBe(true)
    })
  })
})
