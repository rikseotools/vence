import { Global, Injectable, Logger, Module } from '@nestjs/common';

/**
 * Configuración de heartbeat por cron.
 * - `thresholdMs`: si lleva más de este tiempo sin tick → unhealthy.
 *   Debe ser > 2× el interval del cron para tolerar latencia normal.
 * - `gracePeriodMs`: tras arrancar el proceso, durante este tiempo
 *   `lastTickAtMs=null` aún se considera healthy (warming up).
 *   Necesario para crons que tardan en disparar la primera vez.
 */
export interface HeartbeatConfig {
  thresholdMs: number;
  gracePeriodMs: number;
}

/**
 * Registro singleton de heartbeats de todos los crons del backend.
 *
 * Cada `CronWithHeartbeat` se auto-registra en el constructor. El
 * `HealthController` consulta este registro para responder /health/crons.
 * La ECS liveness probe pega contra ese endpoint y mata el container si
 * algún cron quedó silencioso (defensa en profundidad — el container es la
 * unidad de auto-recovery, no un watchdog en código).
 *
 * El registro es in-memory: no persiste entre reinicios. Tras restart, los
 * crons se re-registran al construir el módulo. El grace period evita falsos
 * positivos durante el bootstrap de NestJS (~30-60s con 30+ módulos).
 */
@Injectable()
export class HeartbeatRegistry {
  private readonly logger = new Logger(HeartbeatRegistry.name);
  private readonly registry = new Map<
    string,
    { getLastTickMsAgo: () => number | null; config: HeartbeatConfig }
  >();
  private readonly processStartedAtMs = Date.now();

  /** Tiempo desde el arranque del proceso (para grace period). */
  getProcessUptimeMs(): number {
    return Date.now() - this.processStartedAtMs;
  }

  /**
   * Registra un cron en el registro. Llamado por `CronWithHeartbeat`
   * en su constructor.
   */
  register(
    name: string,
    getLastTickMsAgo: () => number | null,
    config: HeartbeatConfig,
  ): void {
    if (this.registry.has(name)) {
      this.logger.warn(`Cron '${name}' ya registrado — sobreescribiendo`);
    }
    this.registry.set(name, { getLastTickMsAgo, config });
    this.logger.log(
      `Cron '${name}' registrado: threshold=${config.thresholdMs / 1000}s grace=${config.gracePeriodMs / 1000}s`,
    );
  }

  /**
   * Snapshot del estado actual de todos los crons.
   * Devuelve `null` para los que nunca tickearon.
   */
  getAllSnapshot(): Record<string, number | null> {
    const out: Record<string, number | null> = {};
    for (const [name, { getLastTickMsAgo }] of this.registry) {
      out[name] = getLastTickMsAgo();
    }
    return out;
  }

  /**
   * Devuelve la lista de crons que actualmente están silenciosos
   * (lleva más de su threshold sin tick AND fuera del grace period).
   */
  getStaleCrons(): Array<{
    name: string;
    lastTickMsAgo: number | null;
    thresholdMs: number;
  }> {
    const uptime = this.getProcessUptimeMs();
    const stale: Array<{
      name: string;
      lastTickMsAgo: number | null;
      thresholdMs: number;
    }> = [];

    for (const [name, { getLastTickMsAgo, config }] of this.registry) {
      const ago = getLastTickMsAgo();
      const tickRecent = ago !== null && ago <= config.thresholdMs;
      // Grace effective = MAX(gracePeriodMs, thresholdMs):
      //   - gracePeriodMs cubre el bootstrap inicial (~120s).
      //   - thresholdMs cubre crons cuyo próximo tick esperado es lejano
      //     (daily/weekly): si proceso arrancó hace 5min y cron es diario,
      //     que ago=null sea normal hasta que pase el threshold (~25h).
      // Sin esto, un task recién arrancado reporta 20+ crons "stale" porque
      // ninguno daily/weekly ha podido tickear todavía.
      const effectiveGraceMs = Math.max(
        config.gracePeriodMs,
        config.thresholdMs,
      );
      const inGracePeriod = ago === null && uptime < effectiveGraceMs;
      const healthy = tickRecent || inGracePeriod;
      if (!healthy) {
        stale.push({
          name,
          lastTickMsAgo: ago,
          thresholdMs: config.thresholdMs,
        });
      }
    }
    return stale;
  }

  /**
   * True si TODOS los crons registrados están healthy.
   * Usado por la ECS liveness probe.
   */
  isHealthy(): boolean {
    return this.getStaleCrons().length === 0;
  }
}

/**
 * Módulo global que provee `HeartbeatRegistry`. Cualquier cron puede
 * inyectar el registro sin necesidad de importar HeartbeatModule
 * explícitamente.
 */
@Global()
@Module({
  providers: [HeartbeatRegistry],
  exports: [HeartbeatRegistry],
})
export class HeartbeatModule {}
