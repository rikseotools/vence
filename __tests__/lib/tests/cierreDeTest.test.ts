import {
  ESPERA_DRENADO_MS,
  avisoDeCierre,
} from '@/lib/tests/cierreDeTest'

/**
 * [T-315] — el cierre de un test no puede dejar a la persona sin las acciones
 * que espera (revisar sus fallos, encadenar otro test) mientras el servidor se
 * recupera. Estos tests fijan las dos decisiones que se toman ahí: cuánto se
 * espera y cuándo se deja rastro.
 */
describe('cierre de test: espera de drenado', () => {
  it('la espera es CORTA: cubre el caso común sin castigar el malo', () => {
    // El caso común drena en <1 s. El valor viejo (20 s) solo se pagaba entero
    // cuando algo iba mal, que es cuando el usuario menos puede permitírselo.
    expect(ESPERA_DRENADO_MS).toBeLessThanOrEqual(5_000)
    // Y NO es 0: si el safety-net rellenara siempre, el camino excepcional se
    // volvería el normal y dejaría de distinguir nada.
    expect(ESPERA_DRENADO_MS).toBeGreaterThan(0)
  });

  describe('cuándo se deja rastro', () => {
    it('si la cola drenó, NO emite nada (una señal que se emite siempre no distingue nada)', () => {
      expect(avisoDeCierre(true, 0)).toBeNull()
      // Aunque queden pendientes de OTRA sesión, si ésta drenó no es su caso.
      expect(avisoDeCierre(true, 4)).toBeNull()
    });

    it('si NO drenó, emite con las pendientes y sin contarlo como error de cliente', () => {
      const aviso = avisoDeCierre(false, 3)

      expect(aviso).not.toBeNull()
      expect(aviso!.eventType).toBe('test_cierre_sin_drenar')
      // `warn` a propósito: no es un error del navegador, es una consecuencia
      // del servidor. Contarlo como error de cliente lo enterraría entre el
      // ruido de navegación y dispararía la alerta equivocada.
      expect(aviso!.severity).toBe('warn')
      expect(aviso!.metadata.pendientes).toBe(3)
      expect(aviso!.metadata.rellenaraServidor).toBe(true)
    });

    it('dice cuánto se esperó, en vez de clavar el número en el texto', () => {
      const aviso = avisoDeCierre(false, 1, 3_000)
      expect(aviso!.errorMessage).toContain('3000')
      expect(aviso!.metadata.esperaMs).toBe(3_000)
    });

    it('un contador que llega a 0 entre la comprobación y la emisión no emite un número imposible', () => {
      const aviso = avisoDeCierre(false, -2)
      expect(aviso!.metadata.pendientes).toBe(0)
    });
  });
});
