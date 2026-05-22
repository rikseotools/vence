import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { groupByDomain, runWithConcurrency } from './concurrency';
import {
  checkSeguimientoUrl,
  getOposicionesForSeguimientoCheck,
  saveSeguimientoCheck,
  type CheckResult,
  type OposicionToCheck,
  type SeguimientoCheckStats,
} from './seguimiento-queries';

const CONCURRENCY = 5;
const DELAY_PER_DOMAIN_MS = 1000; // pausa entre requests al mismo servidor

/**
 * Servicio que verifica cambios en páginas oficiales de seguimiento de
 * convocatorias de oposición. Para cada oposición activa con `seguimiento_url`:
 *  1. Descarga la página (30s timeout, con bypass TLS para hosts con cert incompleto)
 *  2. Limpia el HTML y calcula un SHA-256 del texto relevante
 *  3. Compara con el hash previo almacenado
 *  4. Guarda el resultado en `convocatoria_seguimiento_checks`
 *  5. Si hay cambio, actualiza `oposiciones.seguimiento_change_status = 'changed'`
 *     y genera una señal `hash_change` en `oep_detection_signals`
 *
 * Paralelización: dominios distintos se procesan en paralelo (concurrency=5)
 * pero dentro de un mismo dominio se procesan en secuencial con pausa 1s para
 * no saturar el mismo servidor.
 */
@Injectable()
export class CheckSeguimientoService {
  private readonly logger = new Logger(CheckSeguimientoService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<SeguimientoCheckStats> {
    const startTime = Date.now();
    this.logger.log('Iniciando verificación de páginas de seguimiento...');

    const oposiciones = await getOposicionesForSeguimientoCheck(this.db);
    this.logger.log(`${oposiciones.length} oposiciones con seguimiento_url`);

    if (!oposiciones.length) {
      return { total: 0, checked: 0, changed: 0, errors: 0, unchanged: 0 };
    }

    const results: CheckResult[] = [];
    const changes: Array<{ nombre: string; slug: string | null }> = [];
    const errors: Array<{ nombre: string; error: string }> = [];

    const pushResult = (result: CheckResult, opo: OposicionToCheck): void => {
      results.push(result);
      if (result.error) {
        errors.push({ nombre: opo.nombre, error: result.error });
      } else if (result.hasChanged) {
        changes.push({ nombre: opo.nombre, slug: opo.slug });
      }
    };

    // Agrupar por dominio para no martillear el mismo servidor.
    const domainGroups = groupByDomain(oposiciones, (opo) => opo.seguimientoUrl);
    this.logger.log(
      `${domainGroups.length} dominios distintos, concurrency=${CONCURRENCY}`,
    );

    await runWithConcurrency(domainGroups, CONCURRENCY, async (group) => {
      for (let i = 0; i < group.length; i++) {
        const opo = group[i];
        this.logger.debug(`Verificando: ${opo.shortName ?? opo.nombre}`);

        const result = await checkSeguimientoUrl(opo);
        pushResult(result, opo);

        if (result.error) {
          this.logger.warn(`Error ${opo.shortName ?? opo.nombre}: ${result.error}`);
        } else if (result.hasChanged) {
          this.logger.warn(`CAMBIO DETECTADO: ${opo.shortName ?? opo.nombre}`);
        } else {
          this.logger.debug(`Sin cambios: ${opo.shortName ?? opo.nombre}`);
        }

        // Guardar resultado; no abortar el cron si falla un save individual
        try {
          await saveSeguimientoCheck(this.db, result);
        } catch (saveErr) {
          this.logger.error(
            `Error guardando check de ${opo.nombre}: ${(saveErr as Error).message}`,
          );
        }

        // Pausa entre requests al MISMO dominio. Skip en último item.
        if (i < group.length - 1) {
          await new Promise<void>((resolve) =>
            setTimeout(resolve, DELAY_PER_DOMAIN_MS),
          );
        }
      }
    });

    const stats: SeguimientoCheckStats = {
      total: oposiciones.length,
      checked: results.length,
      changed: changes.length,
      errors: errors.length,
      unchanged: results.length - changes.length - errors.length,
    };

    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    this.logger.log(
      `Completado en ${duration}: ${stats.checked}/${stats.total} verificadas, ` +
        `${stats.changed} cambios, ${stats.errors} errores`,
    );

    if (changes.length > 0) {
      this.logger.warn(
        `${changes.length} cambios detectados: ${changes.map((c) => c.nombre).join(', ')}`,
      );
    }

    return stats;
  }
}
