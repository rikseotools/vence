import { Injectable, Logger } from '@nestjs/common';

/**
 * Servicio AnswerSave — Fase 1 (esqueleto).
 *
 * Implementación REAL en Fases 3-4:
 *  - validateAndSaveAnswer: orquestador (cache validation + resolver tema en
 *    paralelo + insertTestAnswer + UPDATE tests.score)
 *  - markActiveStudentIfFirst: background (SELECT + UPDATE user_profiles)
 *
 * El Controller (con @UseGuards(JwtGuard) + Zod validation + quick-fail
 * timeouts) se añade en Fase 5.
 */
@Injectable()
export class AnswerSaveService {
  private readonly logger = new Logger(AnswerSaveService.name);
}
