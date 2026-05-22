import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { aiApiConfig } from './anthropic.schema';

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutos

/**
 * Servicio global que provee un cliente Anthropic SDK.
 *
 * La API key NO está en variables de entorno: se almacena en la tabla
 * `ai_api_config` cifrada en base64 (provider='anthropic', is_active=true).
 * El cliente se cachea 30 minutos para evitar consultas innecesarias a BD.
 */
@Injectable()
export class AnthropicService {
  private readonly logger = new Logger(AnthropicService.name);

  private cachedClient: Anthropic | null = null;
  private cachedApiKey: string | null = null;
  private cacheTimestamp = 0;

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Devuelve un cliente Anthropic listo para usar (con cache de 30 min). */
  async getClient(): Promise<Anthropic> {
    const now = Date.now();

    if (
      this.cachedClient !== null &&
      this.cachedApiKey !== null &&
      now - this.cacheTimestamp < CACHE_TTL_MS
    ) {
      return this.cachedClient;
    }

    const apiKey = await this.fetchApiKey();

    // Si la clave cambió, forzar nuevo cliente
    if (apiKey !== this.cachedApiKey || this.cachedClient === null) {
      this.cachedClient = new Anthropic({ apiKey });
      this.cachedApiKey = apiKey;
      this.logger.log('Cliente Anthropic creado/renovado');
    }

    this.cacheTimestamp = now;
    return this.cachedClient;
  }

  private async fetchApiKey(): Promise<string> {
    const rows = await this.db
      .select({ apiKeyEncrypted: aiApiConfig.apiKeyEncrypted })
      .from(aiApiConfig)
      .where(
        and(
          eq(aiApiConfig.provider, 'anthropic'),
          eq(aiApiConfig.isActive, true),
        ),
      )
      .limit(1);

    const encrypted = rows[0]?.apiKeyEncrypted;
    if (!encrypted) {
      throw new Error('Anthropic API key no configurada en ai_api_config');
    }

    return Buffer.from(encrypted, 'base64').toString('utf-8');
  }
}
