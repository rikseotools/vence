import {
  ANSWER_SAVE_BUDGET_MS,
  COMPROBACIONES_MAX_MS,
  GUARDAR_MIN_MS,
  crearPresupuesto,
} from './presupuesto';

/**
 * Reloj de mentira: el presupuesto es tiempo, así que sin controlarlo estos
 * tests medirían la velocidad de la máquina de CI en vez del reparto.
 */
function relojFalso(t0 = 1_000_000) {
  let ahora = t0;
  return {
    ahora: () => ahora,
    avanzar: (ms: number) => {
      ahora += ms;
    },
  };
}

describe('presupuesto de answer-and-save', () => {
  describe('el reparto en el caso normal', () => {
    it('recién creado: comprobar recibe su techo y guardar casi todo el presupuesto', () => {
      const reloj = relojFalso();
      const p = crearPresupuesto(ANSWER_SAVE_BUDGET_MS, reloj.ahora);

      expect(p.gastadoMs()).toBe(0);
      expect(p.restanteMs()).toBe(ANSWER_SAVE_BUDGET_MS);
      expect(p.comprobacionesMs()).toBe(COMPROBACIONES_MAX_MS);
      expect(p.guardarMs()).toBe(ANSWER_SAVE_BUDGET_MS);
    });

    it('si comprobar tarda poco, guardar hereda el margen (lo que ANTES no pasaba)', () => {
      const reloj = relojFalso();
      const p = crearPresupuesto(ANSWER_SAVE_BUDGET_MS, reloj.ahora);

      reloj.avanzar(300); // comprobaciones en su tiempo normal (<500 ms)

      // El valor viejo era fijo: 15.000 ms pasara lo que pasara.
      expect(p.guardarMs()).toBe(ANSWER_SAVE_BUDGET_MS - 300);
      expect(p.guardarMs()).toBeGreaterThan(15_000);
    });
  });

  describe('comprobar no puede comerse el tiempo de guardar', () => {
    it('aunque comprobar agote su techo, guardar conserva los 15 s de antes', () => {
      const reloj = relojFalso();
      const p = crearPresupuesto(ANSWER_SAVE_BUDGET_MS, reloj.ahora);

      reloj.avanzar(COMPROBACIONES_MAX_MS); // el peor caso de la primera fase

      expect(p.guardarMs()).toBe(ANSWER_SAVE_BUDGET_MS - COMPROBACIONES_MAX_MS);
      expect(p.guardarMs()).toBeGreaterThanOrEqual(15_000);
    });

    it('el techo de comprobar no depende de cuánto quede: nunca supera su máximo', () => {
      const reloj = relojFalso();
      const p = crearPresupuesto(120_000, reloj.ahora); // presupuesto absurdo

      expect(p.comprobacionesMs()).toBe(COMPROBACIONES_MAX_MS);
    });
  });

  describe('el peor caso queda ATADO al presupuesto declarado', () => {
    it('la suma de las dos fases no supera el total (que era el defecto de origen)', () => {
      const reloj = relojFalso();
      const p = crearPresupuesto(ANSWER_SAVE_BUDGET_MS, reloj.ahora);

      const comprobar = p.comprobacionesMs();
      reloj.avanzar(comprobar);
      const guardar = p.guardarMs();

      expect(comprobar + guardar).toBeLessThanOrEqual(ANSWER_SAVE_BUDGET_MS);
    });

    it('el presupuesto cabe dentro de la ventana del proxy (25 s), no la desborda', () => {
      // Si el backend presupuesta lo mismo que el proxy, corta siempre el proxy
      // y el usuario recibe un abort sin causa en vez de nuestro 503.
      expect(ANSWER_SAVE_BUDGET_MS).toBeLessThan(25_000);
    });
  });

  describe('presupuesto agotado', () => {
    it('no reparte tiempo negativo a comprobar', () => {
      const reloj = relojFalso();
      const p = crearPresupuesto(ANSWER_SAVE_BUDGET_MS, reloj.ahora);

      reloj.avanzar(ANSWER_SAVE_BUDGET_MS + 5_000);

      expect(p.restanteMs()).toBe(0);
      expect(p.comprobacionesMs()).toBe(0);
    });

    it('guardar SIEMPRE conserva su suelo: es lo único que el usuario pierde', () => {
      const reloj = relojFalso();
      const p = crearPresupuesto(ANSWER_SAVE_BUDGET_MS, reloj.ahora);

      reloj.avanzar(ANSWER_SAVE_BUDGET_MS + 5_000);

      expect(p.guardarMs()).toBe(GUARDAR_MIN_MS);
    });

    it('con un presupuesto minúsculo, lo que se recorta es comprobar, no guardar', () => {
      const reloj = relojFalso();
      const p = crearPresupuesto(GUARDAR_MIN_MS, reloj.ahora);

      expect(p.comprobacionesMs()).toBe(0);
      expect(p.guardarMs()).toBe(GUARDAR_MIN_MS);
    });
  });
});
