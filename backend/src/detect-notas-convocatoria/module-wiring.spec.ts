import { Test } from '@nestjs/testing';
import { DetectNotasConvocatoriaService } from './detect-notas-convocatoria.service';
import { ReconcileConvocatoriaService } from './reconcile-convocatoria.service';
import { DRIZZLE } from '../db/database.module';
import { AnthropicService } from '../anthropic/anthropic.service';
import { OepSignalsLlmService } from '../oep-signals/oep-signals-llm.service';

// Guardarraíl de CABLEADO: que los providers se resuelven con sus dependencias reales.
// Sin esto, un import mal puesto solo se ve al desplegar (y el cron no arranca en silencio).
describe('cableado del módulo (DI)', () => {
  it('DetectNotas y Reconcile se instancian con sus dependencias', async () => {
    const mod = await Test.createTestingModule({
      providers: [
        DetectNotasConvocatoriaService,
        ReconcileConvocatoriaService,
        { provide: DRIZZLE, useValue: {} },
        { provide: AnthropicService, useValue: {} },
        { provide: OepSignalsLlmService, useValue: {} },
      ],
    }).compile();
    expect(mod.get(DetectNotasConvocatoriaService)).toBeDefined();
    expect(mod.get(ReconcileConvocatoriaService)).toBeDefined();
  });
});
