// canary-registry.boot.ts — Verifica el invariante de cota AL ARRANCAR (además del
// guardarraíl de CI): si un write-canary quedara sin declarar su cota, el proceso
// NestJS **no arranca** en vez de fallar en silencio en producción. Defensa en
// profundidad (CI + runtime). Ver docs/roadmap/canary-framework.md.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CANARY_REGISTRY, assertRegistryBounding } from './canary-registry';

@Injectable()
export class CanaryRegistryBootCheck implements OnModuleInit {
  private readonly logger = new Logger(CanaryRegistryBootCheck.name);

  onModuleInit(): void {
    assertRegistryBounding(); // lanza si algún writesToProd no declara cota → aborta el arranque
    const writers = CANARY_REGISTRY.filter((c) => c.writesToProd).length;
    this.logger.log(
      `CANARY_REGISTRY OK — ${CANARY_REGISTRY.length} canaries, ${writers} write-canaries acotados (invariante verificado al arrancar).`,
    );
  }
}
