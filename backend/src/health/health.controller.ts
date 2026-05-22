import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

/**
 * Endpoint de salud para el health check de Fargate / balanceadores.
 * Etapa 1: liveness simple. La comprobación de conectividad con la BD se
 * añadirá junto con el módulo de base de datos.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'vence-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
