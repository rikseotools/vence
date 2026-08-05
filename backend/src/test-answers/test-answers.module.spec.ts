import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DRIZZLE, DRIZZLE_READ } from '../db/database.module';
import { HeartbeatRegistry } from '../heartbeat/heartbeat.registry';
import { ObservabilityService } from '../observability/observability.service';
import { TestAnswersModule } from './test-answers.module';
import { TestAnswersService } from './test-answers.service';

/**
 * Doble del módulo de BD. `DatabaseModule` es @Global y exporta DRIZZLE a toda la app; aquí
 * se reproduce ese hecho sin abrir conexiones. Importa que sea @Global: si se declarase
 * normal, este test pasaría por un motivo distinto del que hace que producción funcione, y
 * entonces no estaría comprobando lo que dice comprobar.
 */
@Global()
@Module({
  providers: [
    { provide: DRIZZLE, useValue: {} },
    { provide: DRIZZLE_READ, useValue: {} },
    // HeartbeatRegistry también es global en la app (app.module.ts) y lo pide el cron de
    // limpieza que vive dentro de ObservabilityModule. Se repone aquí por lo mismo.
    HeartbeatRegistry,
  ],
  exports: [DRIZZLE, DRIZZLE_READ, HeartbeatRegistry],
})
class DbFalsoGlobalModule {}

// ARRANQUE del módulo (T-559, 05/08/2026).
//
// POR QUÉ EXISTE. Al añadir `ObservabilityService` al constructor de TestAnswersService
// —para poder emitir cuando la ley no se resuelve— se introdujo un riesgo que NINGUNA de las
// capas existentes veía: los 31 tests unitarios del service lo instancian a mano
// (`new TestAnswersService(db)`), así que pasan en verde aunque la inyección de Nest no
// resuelva. Y no hay ningún test que compile un módulo: un fallo de DI solo se habría
// manifestado **al arrancar el contenedor en producción**, con el servicio sin estabilizar.
//
// Un parámetro de constructor marcado opcional en TypeScript (`observability?: X`) NO es
// opcional para Nest: si el provider no está disponible, el módulo no compila. Aquí se
// comprueba que de verdad lo está (ObservabilityModule es @Global y además se importa).
describe('TestAnswersModule — compila e inyecta de verdad', () => {
  it('resuelve TestAnswersService con la observabilidad inyectada', async () => {
    // La BD real no se toca: solo interesa que el grafo de dependencias CIERRE, que es lo
    // que decide si el contenedor arranca.
    const moduleRef = await Test.createTestingModule({
      imports: [DbFalsoGlobalModule, TestAnswersModule],
    }).compile();

    const service = moduleRef.get(TestAnswersService);
    expect(service).toBeInstanceOf(TestAnswersService);

    await moduleRef.close();
  });

  it('el service sigue funcionando SIN observabilidad (no puede ser motivo de no guardar)', () => {
    // Contrato deliberado: la observabilidad es fire-and-forget y opcional. Si algún día
    // deja de estar disponible, se pierde la señal — nunca la respuesta del usuario.
    const service = new TestAnswersService({} as never);
    const { row, decisionLaw } = service.buildTestAnswerRow(
      {
        sessionId: 's',
        questionData: {
          id: 'q1',
          question: 'texto',
          options: ['a', 'b', 'c', 'd'],
          tema: 1,
          questionType: 'legislative',
          article: { id: 'art-1', number: '190' },
        },
        answerData: {
          questionIndex: 0,
          selectedAnswer: 0,
          correctAnswer: 0,
          isCorrect: true,
          timeSpent: 5,
        },
        tema: 1,
      } as never,
      'user-1',
      { lawResueltaDesdeArticulo: 'Excel 365' },
    );

    expect(row.lawName).toBe('Excel 365');
    expect(decisionLaw.motivo).toBe('resuelta_desde_articulo');
    expect(decisionLaw.emitir).toBe(false);
  });

  it('🔒 con el artículo presente y la ley irresoluble: null y AVISA (nunca el relleno)', () => {
    const service = new TestAnswersService({} as never);
    const { row, decisionLaw } = service.buildTestAnswerRow(
      {
        sessionId: 's',
        questionData: {
          id: 'q1',
          question: 'texto',
          options: ['a', 'b'],
          tema: 1,
          questionType: 'legislative',
          // El cliente manda el relleno: antes ganaba y se persistía tal cual.
          article: { id: 'art-1', number: '190', law_short_name: 'unknown' },
        },
        answerData: {
          questionIndex: 0,
          selectedAnswer: 0,
          correctAnswer: 0,
          isCorrect: true,
          timeSpent: 5,
        },
        tema: 1,
      } as never,
      'user-1',
      { lawResueltaDesdeArticulo: null },
    );

    expect(row.lawName).toBeNull();
    expect(decisionLaw.emitir).toBe(true);
    expect(decisionLaw.motivo).toBe('irresoluble_con_articulo');
  });
});
