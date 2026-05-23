import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { MedalsService } from './medals.service';

/**
 * Espejo de `/api/medals` (GET) de la app Next.js, primer endpoint del
 * Bloque 3 canary. Sin auth (el endpoint original también es público —
 * userId por query string).
 *
 * POST se queda en Vercel — esta primera versión solo proxiea el read path.
 */
@Controller('api/medals')
export class MedalsController {
  private readonly logger = new Logger(MedalsController.name);
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  constructor(private readonly medals: MedalsService) {}

  @Get()
  async get(
    @Query('userId') userId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean; medals?: unknown; error?: string }> {
    if (!userId || !MedalsController.UUID_REGEX.test(userId)) {
      throw new BadRequestException('userId invalido o faltante');
    }

    const { response, cacheStatus, httpStatus } =
      await this.medals.getUserMedals(userId);

    res.status(httpStatus);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('x-medals-cache', cacheStatus);
    res.setHeader('x-served-by', 'vence-backend');

    return response;
  }
}
