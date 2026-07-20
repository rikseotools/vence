import { Injectable, Logger } from '@nestjs/common';
import { OepSignalsQueriesService } from '../oep-signals/oep-signals-queries.service';
import { baseScoreBySensor, buildDedupeKey } from '../oep-signals/oep-signals.schemas';

export interface TimelineSilenceStats {
  candidates: number;
  signals: number;
}

/**
 * Sensor 3: detector de silencio en timeline de convocatorias.
 *
 * Busca hitos con status='current' cuya fecha ya pasó hace más de 3 días
 * sin haberse actualizado a 'completed'. Genera señales `timeline_silence`
 * para alertar al admin de que se esperaba un evento y no ha ocurrido.
 *
 * Portado de `app/api/cron/detect-timeline-silence/route.ts`.
 */
@Injectable()
export class DetectTimelineSilenceService {
  private readonly logger = new Logger(DetectTimelineSilenceService.name);

  private readonly GRACE_DAYS = 3;

  /**
   * Gracia del 2º modo (timeline AGOTADO). Más larga que la del modo `current`: aquí no se
   * incumple ninguna fecha anunciada, solo se lleva un tiempo sin noticias. Medido el
   * 20/07/2026, el volumen es plano entre 14 y 45 días (48/47/47/44 candidatos), señal de que
   * esto es un STOCK acumulado y no un flujo → el umbral no es la palanca. 21 días da 3
   * semanas de gracia sin ruido en procesos que van a su ritmo normal.
   */
  private readonly EXHAUSTED_GRACE_DAYS = 21;

  /**
   * El 2º modo arranca APAGADO a propósito. En el momento de escribirlo había 47 oposiciones
   * que ya cumplían la condición: encenderlo de golpe volcaría 47 señales el primer día, y una
   * bandeja que grita se aprende a ignorar — que es exactamente como se murió `hash_change`
   * (32 aciertos de 835 señales). Orden correcto: drenar el stock a mano contra fuente oficial
   * y DESPUÉS encender, para que el sensor solo vea el goteo real.
   */
  private exhaustedEnabled(): boolean {
    return process.env.TIMELINE_EXHAUSTED_ENABLED === 'true';
  }

  constructor(private readonly queries: OepSignalsQueriesService) {}

  async run(): Promise<TimelineSilenceStats> {
    const startTime = Date.now();
    this.logger.log('Buscando hitos retrasados...');

    const current = await this.queries.findTimelineSilences(this.GRACE_DAYS);
    const exhausted = this.exhaustedEnabled()
      ? await this.queries.findExhaustedTimelines(this.EXHAUSTED_GRACE_DAYS)
      : [];
    if (!this.exhaustedEnabled()) {
      this.logger.log(
        'modo "timeline agotado" APAGADO (TIMELINE_EXHAUSTED_ENABLED=true para activarlo)',
      );
    } else {
      // El tope de 1 año se REPORTA, no se calla: un recorte silencioso se lee como
      // "cubierto todo" cuando no lo está.
      const abandonadas = await this.queries.countAbandonedTimelines();
      if (abandonadas > 0) {
        this.logger.warn(
          `${abandonadas} oposiciones excluidas por llevar >1 año calladas: NO son silencio ` +
            `a la espera de noticias sino registros abandonados → higiene de datos/rollover.`,
        );
      }
    }
    // Una oposición podría salir por los dos modos; el dedupeKey va por hito, así que se
    // filtra aquí para no emitir dos señales del mismo hito por caminos distintos.
    const vistos = new Set(current.map((c) => c.hitoId));
    const candidates = [
      ...current.map((c) => ({ ...c, agotado: false })),
      ...exhausted
        .filter((c) => !vistos.has(c.hitoId))
        .map((c) => ({ ...c, agotado: true })),
    ];
    this.logger.log(
      `${candidates.length} candidatos encontrados (${current.length} hito vencido + ${exhausted.length} timeline agotado)`,
    );

    let signalsInserted = 0;

    for (const c of candidates) {
      const baseScore = baseScoreBySensor('timeline_silence');
      // Más retraso = más urgente (max +30).
      // En modo `agotado` la escala tiene que ser otra: como solo entran a partir de 21 días,
      // `diasRetraso * 2` saturaría el bonus SIEMPRE y las 47 saldrían con urgencia máxima,
      // que es tanto como no priorizar. Se cuenta el exceso sobre el umbral y a mitad de ritmo,
      // así una callada de 6 meses sí pesa más que una de 3 semanas.
      const urgencyBonus = c.agotado
        ? Math.min(20, Math.floor((c.diasRetraso - this.EXHAUSTED_GRACE_DAYS) / 7))
        : Math.min(30, c.diasRetraso * 2);
      const score = Math.min(100, baseScore + urgencyBonus);

      const year = new Date(c.hitoFecha).getFullYear();
      const dedupeKey = buildDedupeKey({
        sensorType: 'timeline_silence',
        oposicionId: c.oposicionId,
        year,
        bocRef: c.hitoId, // único por hito
      });

      // El texto NO puede ser el mismo en los dos modos: en `current` se incumplió una fecha
      // ANUNCIADA (hay retraso real); en `agotado` no se ha incumplido nada, simplemente el
      // timeline lleva N días sin noticias y la oposición sigue sin fecha de examen. Decir
      // "retraso" ahí sería falso y mandaría al admin a buscar un incumplimiento inexistente.
      const summary = c.agotado
        ? `Sin novedades desde "${c.hitoTitulo}" (${c.hitoFecha}, hace ${c.diasRetraso} días) y sigue sin fecha de examen. Revisar página oficial por si ya hay listas definitivas o fecha del 1er ejercicio.`
        : `Hito "${c.hitoTitulo}" esperado ${c.hitoFecha} (+${c.diasRetraso} días retraso). Revisar página oficial.`;

      const { inserted } = await this.queries.insertSignal({
        oposicionId: c.oposicionId,
        sensorType: 'timeline_silence',
        sourceUrl: null,
        detectedYear: year,
        confidenceScore: score,
        isNovel: false,
        signalSummary: summary,
        rawExtraction: {
          hitoId: c.hitoId,
          hitoTitulo: c.hitoTitulo,
          hitoFecha: c.hitoFecha,
          diasRetraso: c.diasRetraso,
        } as Record<string, unknown>,
        dedupeKey,
      });

      if (inserted) {
        signalsInserted++;
        this.logger.warn(
          `${c.oposicionNombre}: hito "${c.hitoTitulo}" +${c.diasRetraso}d retraso (score=${score})`,
        );
      }
    }

    const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    const stats = { candidates: candidates.length, signals: signalsInserted };
    this.logger.log(`Completado en ${duration}: ${JSON.stringify(stats)}`);

    return stats;
  }
}
