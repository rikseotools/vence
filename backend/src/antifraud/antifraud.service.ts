import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
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
/**
 * Cache in-memory de results de registerAndCheckDevice. Evita ejecutar
 * la RPC en cada pregunta de un examen (un examen de 100 preguntas son
 * 100 RPCs sin cache → bug Paloma 30/04/2026 cascade 504s).
 */
interface DeviceCacheEntry {
  result: DeviceCheckResult;
  timestamp: number;
}

interface RegisterDeviceRpcRow {
  allowed: boolean;
  device_count: number;
  max_devices: number;
  is_new_device: boolean;
  is_premium: boolean;
  existing_devices: string | null;
}

@Injectable()
export class AntifraudService {
  private readonly logger = new Logger(AntifraudService.name);

  private readonly deviceCheckCache = new Map<string, DeviceCacheEntry>();
  private static readonly DEVICE_CHECK_TTL_MS = 60_000; // 60s, igual que Vercel

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
   * Helper puro estático — parsea User-Agent a label legible.
   * Mismo algoritmo que el frontend (port literal de `parseDeviceLabel`).
   *
   * Devuelve un string `"Browser / OS"` con detección rudimentaria pero
   * suficiente para mostrar al usuario qué dispositivos tiene conectados:
   *   - Browser: Chrome / Firefox / Safari / Edge / Unknown
   *   - OS: iOS / Android / Windows / Mac / Linux / Unknown
   *
   * Cuidado con el orden de los `if`: 'Edg' contiene 'Chrome' en algunos UAs.
   */
  static parseDeviceLabel(ua: string): string {
    let browser = 'Unknown';
    if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';

    let os = 'Unknown';
    if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS') || ua.includes('Macintosh')) os = 'Mac';
    else if (ua.includes('Linux')) os = 'Linux';

    return `${browser} / ${os}`;
  }

  /**
   * Registra device + verifica límite invocando la función SQL
   * `register_device(uuid, text, text, text)` vía Drizzle SQL puro.
   *
   * Cero `supabase.rpc(...)` — la función Postgres ya existe y es
   * agnóstica (CREATE FUNCTION estándar, no Supabase-specific). Si
   * mañana migramos Postgres a Neon/RDS/Aurora, la función sigue
   * funcionando igual.
   *
   * Cache 60s por `${userId}:${deviceId}` (igual que Vercel) — durante
   * un examen de 100 preguntas, solo 1 RPC real.
   *
   * Fail-open: si BD/RPC falla, devuelve FAIL_OPEN. Mejor permitir que
   * bloquear a un usuario legítimo por error de infra.
   */
  async registerAndCheckDevice(
    userId: string | null,
    deviceId: string | null,
    userAgent?: string | null,
    hwFingerprint?: string | null,
  ): Promise<DeviceCheckResult> {
    if (!userId || !deviceId) return FAIL_OPEN;

    const cacheKey = `${userId}:${deviceId}`;
    const cached = this.deviceCheckCache.get(cacheKey);
    if (
      cached &&
      Date.now() - cached.timestamp < AntifraudService.DEVICE_CHECK_TTL_MS
    ) {
      return cached.result;
    }

    try {
      const deviceLabel = userAgent
        ? AntifraudService.parseDeviceLabel(userAgent)
        : null;

      // Invocación SQL puro de la función Postgres.
      const rows = (await this.db.execute(sql`
        SELECT * FROM register_device(
          ${userId}::uuid,
          ${deviceId}::text,
          ${deviceLabel}::text,
          ${hwFingerprint ?? null}::text
        )
      `)) as unknown as RegisterDeviceRpcRow[];

      const row = rows[0];
      if (!row) return FAIL_OPEN;

      const result: DeviceCheckResult = {
        allowed: row.allowed ?? true,
        deviceCount: row.device_count ?? 0,
        maxDevices: row.max_devices ?? 2,
        isNewDevice: row.is_new_device ?? false,
        isPremium: row.is_premium ?? false,
        existingDevices: row.existing_devices ?? '',
      };

      this.deviceCheckCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (err) {
      this.logger.warn(
        `Error en register_device para user ${userId.slice(0, 8)} device ${deviceId.slice(0, 8)} — fail-open:`,
        err,
      );
      return FAIL_OPEN;
    }
  }

  /** Helper para tests — limpia el cache in-memory. */
  clearDeviceCheckCache(): void {
    this.deviceCheckCache.clear();
  }
}
