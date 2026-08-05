import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../db/database.module';
import { ObservabilityService } from '../observability/observability.service';
import { TestConfigService } from './test-config.service';

/**
 * Que el módulo del configurador REALMENTE se resuelve.
 *
 * POR QUÉ (05/08/2026): al arreglar [T-551] en el camino que de verdad sirve se añadió
 * `ObservabilityService` al constructor de `TestConfigService`, para poder emitir
 * `filtered_questions_unbuilt_oposicion_degrade` desde Fargate. Que eso funcione depende
 * de que su módulo sea `@Global()` — lo es, pero eso era un razonamiento, no una
 * comprobación.
 *
 * Y equivocarse aquí no se parece a los otros fallos de esta tarea: aquéllos fallaban
 * hacia el lado tonto (un contador que dice 0). Un fallo de INYECCIÓN no: Nest aborta el
 * arranque y el backend entero se queda sin levantar — con la familia `test-config`
 * enrutada aquí, eso es el configurador caído para todo el mundo.
 *
 * Ni `tsc` ni `nest build` ven esto: la resolución de dependencias es en runtime.
 */
describe('TestConfigModule — cableado de dependencias', () => {
  it('el servicio se instancia con todas sus dependencias', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TestConfigService,
        // Dobles de las dependencias externas: aquí no se prueba la lógica, se prueba
        // que el grafo de inyección CIERRA.
        { provide: DRIZZLE, useValue: { execute: jest.fn().mockResolvedValue([]) } },
        {
          provide: ObservabilityService,
          useValue: { emitFireAndForget: jest.fn() },
        },
      ],
    }).compile();

    expect(moduleRef.get(TestConfigService)).toBeInstanceOf(TestConfigService);
  });
});
