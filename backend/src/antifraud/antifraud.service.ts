import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

export interface DeviceCheckResult {
  allowed: boolean;
  deviceCount: number;
  maxDevices: number;
  isNewDevice: boolean;
  isPremium: boolean;
  existingDevices: string;
}

const FAIL_OPEN: DeviceCheckResult = {
  allowed: true,
  deviceCount: 0,
  maxDevices: 2,
  isNewDevice: false,
  isPremium: false,
  existingDevices: '',
};

/**
 * Servicio de anti-fraud — Fase 1 (esqueleto).
 *
 * Implementación REAL en Fase 3 del port answer-and-save. Hoy solo
 * define el contrato + métodos placeholder con FAIL_OPEN.
 *
 * Funciones a implementar (port de lib/api/deviceLimit.ts):
 *  - registerAndCheckDevice (RPC register_device vía SQL puro)
 *  - getAccountsOnDevice (RPC get_accounts_on_device vía SQL puro)
 *  - extractDeviceId (header x-device-id)
 *  - extractHwFingerprint (header x-hw-fingerprint)
 *  - parseDeviceLabel (lógica pura User-Agent → "Chrome / Mac")
 *
 * Cache in-memory 60s por `${userId}:${deviceId}` se replicará para
 * evitar 100 RPCs en exámenes de 100 preguntas.
 */
@Injectable()
export class AntifraudService {
  private readonly logger = new Logger(AntifraudService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Extrae el deviceId de un header HTTP request. */
  static extractDeviceId(headers: Record<string, string | string[] | undefined>): string | null {
    const v = headers['x-device-id'];
    if (typeof v === 'string') return v;
    if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
    return null;
  }

  /** Extrae el hardware fingerprint de un header HTTP request. */
  static extractHwFingerprint(headers: Record<string, string | string[] | undefined>): string | null {
    const v = headers['x-hw-fingerprint'];
    if (typeof v === 'string') return v;
    if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
    return null;
  }

  /**
   * Registra device + verifica límite. Fase 1: stub que devuelve FAIL_OPEN.
   * Fase 3 implementará la lógica real vía SQL puro.
   */
  async registerAndCheckDevice(
    userId: string | null,
    deviceId: string | null,
    _userAgent?: string | null,
    _hwFingerprint?: string | null,
  ): Promise<DeviceCheckResult> {
    if (!userId || !deviceId) return FAIL_OPEN;
    // TODO Fase 3: invocar register_device vía db.execute(sql`SELECT * FROM register_device(...)`)
    return FAIL_OPEN;
  }
}
