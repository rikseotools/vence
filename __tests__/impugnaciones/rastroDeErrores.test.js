const {
  VENTANA_ANTES_MS,
  ventanaRastro,
  firmaEvento,
  agruparRastro,
  lineasRastro,
} = require('../../lib/impugnaciones/rastroDeErrores.cjs');

// El caso REAL que motiva el módulo (feedback e790c7bf, Lourdes). Los tres eventos que decidían
// el diagnóstico, con sus horas de verdad: el error de la cola de guardado llega 40 min ANTES de
// que escriba, y los dos 494 del configurador —con los que se le contestó— son POSTERIORES.
const CREADO = '2026-08-06T17:45:58.582Z';
const LOURDES = [
  {
    created_at: '2026-08-06T17:05:12.222Z', event_type: 'client_error', severity: 'error',
    endpoint: null, http_status: null,
    metadata: { component: 'answerSaveQueue syncOne network', url: '/…/test/tema/11/test-personalizado' },
  },
  {
    created_at: '2026-08-06T17:05:12.194Z', event_type: 'http_network_error', severity: 'warn',
    endpoint: null, http_status: null, metadata: { url: '/…/test/tema/11/test-personalizado' },
  },
  {
    created_at: '2026-08-06T17:50:48.520Z', event_type: 'http_4xx', severity: 'warn',
    endpoint: '/test/por-leyes', http_status: 494, metadata: { status: 494 },
  },
  {
    created_at: '2026-08-06T17:55:43.679Z', event_type: 'http_4xx', severity: 'warn',
    endpoint: '/test/por-leyes', http_status: 494, metadata: { status: 494 },
  },
];

describe('ventanaRastro', () => {
  it('mira 3 h hacia atrás y media hora hacia delante', () => {
    const { desde, hasta } = ventanaRastro(CREADO);
    expect(new Date(CREADO) - desde).toBe(VENTANA_ANTES_MS);
    expect(hasta - new Date(CREADO)).toBe(30 * 60 * 1000);
  });
});

describe('firmaEvento', () => {
  it('usa el component de metadata como identidad cuando lo hay', () => {
    const f = firmaEvento(LOURDES[0]);
    expect(f.componente).toBe('answerSaveQueue syncOne network');
    expect(f.firma).toContain('answerSaveQueue');
  });

  it('cae al endpoint y al status cuando el fallo es de servidor', () => {
    const f = firmaEvento(LOURDES[2]);
    expect(f.componente).toBeNull();
    expect(f.endpoint).toBe('/test/por-leyes');
    expect(f.http_status).toBe(494);
  });

  it('no revienta con metadata nula', () => {
    expect(() => firmaEvento({ event_type: 'x', metadata: null })).not.toThrow();
  });
});

describe('agruparRastro — separar ANTES de DESPUÉS es lo que evita el fallo', () => {
  const { antes, despues } = agruparRastro(LOURDES, CREADO);

  it('el error del momento que ella describe queda en ANTES', () => {
    expect(antes.map((g) => g.componente)).toContain('answerSaveQueue syncOne network');
  });

  it('los 494 del configurador quedan en DESPUÉS: no explican su aviso', () => {
    expect(despues).toHaveLength(1);
    expect(despues[0].http_status).toBe(494);
    expect(despues[0].n).toBe(2);
    expect(antes.some((g) => g.http_status === 494)).toBe(false);
  });

  it('un evento en el instante exacto del mensaje cuenta como ANTES (lo estaba sufriendo al escribir)', () => {
    const { antes: a } = agruparRastro([{ created_at: CREADO, event_type: 'x', metadata: {} }], CREADO);
    expect(a).toHaveLength(1);
  });

  it('agrupa repeticiones del mismo fallo y conserva primero/último', () => {
    expect(despues[0].primero.toISOString()).toBe('2026-08-06T17:50:48.520Z');
    expect(despues[0].ultimo.toISOString()).toBe('2026-08-06T17:55:43.679Z');
  });

  it('ordena por lo que más se repite', () => {
    const muchos = [
      ...LOURDES,
      ...Array.from({ length: 5 }, (_, i) => ({
        created_at: `2026-08-06T16:0${i}:00.000Z`, event_type: 'client_error', severity: 'warn',
        metadata: { component: 'ruido' },
      })),
    ];
    expect(agruparRastro(muchos, CREADO).antes[0].componente).toBe('ruido');
  });

  it('`error` gana a `warn` cuando el mismo fallo emite los dos', () => {
    const mixto = [
      { created_at: '2026-08-06T17:00:00Z', event_type: 'e', severity: 'warn', metadata: { component: 'c' } },
      { created_at: '2026-08-06T17:01:00Z', event_type: 'e', severity: 'error', metadata: { component: 'c' } },
    ];
    expect(agruparRastro(mixto, CREADO).antes[0].severity).toBe('error');
  });

  it('descarta lo que no se puede situar en el tiempo en vez de colocarlo mal', () => {
    const { antes: a, despues: d } = agruparRastro([{ created_at: null, event_type: 'x' }], CREADO);
    expect(a).toHaveLength(0);
    expect(d).toHaveLength(0);
  });

  it('no revienta sin eventos', () => {
    expect(agruparRastro(undefined, CREADO)).toEqual({ antes: [], despues: [] });
  });
});

describe('lineasRastro', () => {
  const texto = (evs) => lineasRastro(agruparRastro(evs, CREADO), { creado: CREADO }).join('\n');

  it('etiqueta lo posterior como que NO explica el aviso', () => {
    const t = texto(LOURDES);
    expect(t).toMatch(/ANTES del mensaje/);
    expect(t).toMatch(/DESPUÉS de escribir — NO explica su aviso/);
    expect(t).toMatch(/answerSaveQueue/);
  });

  it('dice en voz alta que no hay rastro en vez de callar', () => {
    // Un bloque que desaparece se lee igual que un bloque que nadie miró: ahí es donde vuelve
    // la suposición. Tiene que costar lo mismo leer «no hay nada» que leer los hallazgos.
    const t = lineasRastro({ antes: [], despues: [] }, { creado: CREADO });
    expect(t.join('\n')).toMatch(/SIN RASTRO/);
    expect(t.join('\n')).toMatch(/no es un permiso para suponer|no un permiso para suponer/);
  });

  it('avisa cuando SOLO hay eventos posteriores (la trampa exacta del caso)', () => {
    const t = texto(LOURDES.slice(2));
    expect(t).toMatch(/nada: ningún error suyo en las 3 h previas/);
    expect(t).toMatch(/tiene que salir de la columna ANTES/);
  });
});
