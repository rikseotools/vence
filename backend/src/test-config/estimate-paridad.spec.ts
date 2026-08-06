import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { CacheService } from '../cache/cache.service';
import { CacheVersioningService } from '../cache/cache-versioning.service';
import { TestConfigController } from './test-config.controller';
import { TestConfigService } from './test-config.service';
import type { EstimateQuestionsRequest } from './test-config.types';

/**
 * GET y POST de `/estimate` tienen que contar EXACTAMENTE LO MISMO. (T-623, 06/08/2026)
 *
 * ── POR QUÉ ESTE TEST Y NO OTRO ────────────────────────────────────────────────────────────
 * El POST nace porque la selección de artículos no cabe en una URL: al url-encodificar el JSON
 * se triplica y a partir de 8 KB nginx corta con 414/494 y devuelve HTML, que el cliente parsea
 * como JSON y revienta. Medido contra producción: 7.514 bytes → 200, 8.914 → 414, 41.114 → 494.
 *
 * El riesgo del arreglo NO es que el POST no funcione — eso se ve enseguida. Es que los dos
 * verbos DIVERJAN: que una selección grande se cuente con un criterio y una pequeña con otro, y
 * entonces el número que ve el usuario dependa de cuántos artículos haya elegido. Esta familia
 * ya pagó ese modo de fallo TRES veces (T-326: la lógica solo en el frontend; T-551: la guarda
 * en un camino y no en su gemelo; y el re-arreglo de T-551, aplicado otra vez solo al gemelo).
 *
 * Por eso lo que se comprueba no es «el POST responde», sino que **los dos llegan al servicio
 * con los MISMOS parámetros y piden la MISMA clave de caché**. Si alguien añade un campo a uno
 * y se olvida del otro, esto se pone rojo — que es justo lo que no pasó las tres veces anteriores.
 */
describe('[T-623] /estimate — GET y POST cuentan lo mismo', () => {
  let controller: TestConfigController;
  let recibidos: EstimateQuestionsRequest[];
  let claves: string[];

  const resDoble = () =>
    ({ setHeader: jest.fn(), status: jest.fn() }) as unknown as Response;

  beforeEach(async () => {
    recibidos = [];
    claves = [];
    const moduleRef = await Test.createTestingModule({
      controllers: [TestConfigController],
      providers: [
        {
          provide: TestConfigService,
          useValue: {
            estimateAvailableQuestions: jest.fn((p: EstimateQuestionsRequest) => {
              recibidos.push(p);
              return Promise.resolve({ success: true, count: 42 });
            }),
          },
        },
        // Caché siempre en miss: interesa QUÉ clave se pide, no reutilizar nada.
        {
          provide: CacheService,
          useValue: { getCached: jest.fn().mockResolvedValue(null), setCached: jest.fn() },
        },
        {
          provide: CacheVersioningService,
          useValue: {
            buildKey: jest.fn((_tag: string, sub: string) => {
              claves.push(sub);
              return Promise.resolve(`v1:${sub}`);
            }),
          },
        },
      ],
    }).compile();
    controller = moduleRef.get(TestConfigController);
  });

  // La selección REAL que rompe, con el tamaño MEDIDO y no inventado: LECrim tiene 995 artículos
  // servidos, y esa selección produce una URL de 12.340 bytes contra producción (HTTP 414). Una
  // primera versión de este test usaba 400 artículos «que parecían muchos» y daban 4.716 bytes —
  // por debajo del techo, así que habría pasado en verde sin ejercitar el caso que motiva el POST.
  // Lo cazó el propio test al exigirse el umbral, que es justo para lo que está esa comprobación.
  const articulos = Array.from({ length: 995 }, (_, i) => String(i + 1));
  const seleccion = { LECrim: articulos };

  it('los dos llegan al servicio con los mismos parámetros', async () => {
    await controller.estimate(
      {
        positionType: 'auxiliar_administrativo_estado',
        selectedLaws: 'LECrim',
        selectedArticlesByLaw: JSON.stringify(seleccion),
        onlyOfficialQuestions: 'false',
        difficultyMode: 'random',
        focusEssentialArticles: 'false',
        scopeToPosition: 'true',
      },
      resDoble(),
    );
    await controller.estimatePost(
      {
        positionType: 'auxiliar_administrativo_estado',
        selectedLaws: ['LECrim'],
        selectedArticlesByLaw: seleccion,
        onlyOfficialQuestions: false,
        difficultyMode: 'random',
        focusEssentialArticles: false,
        scopeToPosition: true,
      },
      resDoble(),
    );

    expect(recibidos).toHaveLength(2);
    expect(recibidos[1]).toEqual(recibidos[0]);
  });

  it('...y piden la MISMA clave de caché (si no, la misma selección se contaría dos veces)', async () => {
    await controller.estimate(
      {
        positionType: 'auxiliar_administrativo_estado',
        selectedLaws: 'LECrim',
        selectedArticlesByLaw: JSON.stringify(seleccion),
        difficultyMode: 'random',
      },
      resDoble(),
    );
    await controller.estimatePost(
      {
        positionType: 'auxiliar_administrativo_estado',
        selectedLaws: ['LECrim'],
        selectedArticlesByLaw: seleccion,
        difficultyMode: 'random',
      },
      resDoble(),
    );
    expect(claves).toHaveLength(2);
    expect(claves[1]).toBe(claves[0]);
  });

  // El POST existe PARA las selecciones grandes: que acepte uno pequeño no demuestra nada.
  it('acepta una selección que en la URL pasaría de los 8 KB de nginx', async () => {
    const enUrl = encodeURIComponent(JSON.stringify(seleccion)).length;
    expect(enUrl).toBeGreaterThan(8 * 1024);   // el caso reproduce el techo real
    const r = (await controller.estimatePost(
      { positionType: 'auxiliar_administrativo_estado', selectedArticlesByLaw: seleccion },
      resDoble(),
    )) as { success?: boolean };
    expect(r.success).toBe(true);
  });

  it('sin positionType contesta 400, igual que el GET (no cuenta a ciegas)', async () => {
    const res = resDoble();
    const r = (await controller.estimatePost({}, res)) as { success?: boolean };
    expect(r.success).toBe(false);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('un cuerpo vacío no revienta: contesta 400 en vez de tumbar el endpoint', async () => {
    const res = resDoble();
    const r = (await controller.estimatePost(undefined, res)) as { success?: boolean };
    expect(r.success).toBe(false);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
