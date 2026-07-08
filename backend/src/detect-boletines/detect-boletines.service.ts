import { Injectable, Logger } from '@nestjs/common';
import { OepSignalsLlmService } from '../oep-signals/oep-signals-llm.service';
import {
  OepSignalsQueriesService,
  type ProgramaNormaRow,
} from '../oep-signals/oep-signals-queries.service';
import { baseScoreBySensor } from '../oep-signals/oep-signals.schemas';
import { BOLETIN_ADAPTERS, type BoletinAdapter, type BoletinHit } from './boletines';
import { CCAA_BOLETIN_ADAPTERS, CCAA_BOLETINES_PENDING } from './ccaa-boletines';

// BOE + BOCYL (por fecha, con convocatoria+temario) + los 17 boletines CCAA
// (temario-only, sumario vigente). Un único cron cubre todo.
const ALL_BOLETIN_ADAPTERS: BoletinAdapter[] = [
  ...BOLETIN_ADAPTERS,
  ...CCAA_BOLETIN_ADAPTERS,
];

export interface DetectBoletinesStats {
  boletines: number;
  daysScanned: number;
  candidatesDays: number;
  signals: number;
  /** Señales del sensor temario_change (2ª pasada sobre el mismo sumario). */
  temarioSignals: number;
  errors: number;
}

/**
 * Sensor `detect-boletines`: descubre convocatorias de ingreso C1/C2 NUEVAS
 * leyendo los SUMARIOS de los boletines oficiales (BOCYL HTML por fecha, BOE
 * API JSON). Sustituye funcionalmente al retirado `detect-regional-oeps`, que
 * leía webs institucionales JS y daba 56% de error.
 *
 * Por qué boletín y no la web institucional: la web de la universidad (caso ULE
 * Escala Administrativa, 17/06/2026) es JS paginada y un fetch no ve la
 * convocatoria; el SUMARIO del boletín es estático/API y SIEMPRE la contiene.
 *
 * Pipeline por (boletín × día de la ventana):
 *   1. adapter.scan(date) → texto pre-filtrado de candidatos (regex barata).
 *   2. llm.extractRegionalOeps() → afina y descarta ruido (resultados, A1/A2…).
 *   3. insertSignal() con dedupeKey idempotente → panel /admin/oep-signals.
 */
@Injectable()
export class DetectBoletinesService {
  private readonly logger = new Logger(DetectBoletinesService.name);

  constructor(
    private readonly queries: OepSignalsQueriesService,
    private readonly llm: OepSignalsLlmService,
  ) {}

  private lastDays(n: number, today: Date): Date[] {
    const out: Date[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      out.push(d);
    }
    return out;
  }

  /**
   * @param daysBack ventana hacia atrás (default 4: cubre fin de semana en cron L-V).
   * @param today    inyectable para tests (default ahora).
   */
  async run(daysBack = 4, today: Date = new Date()): Promise<DetectBoletinesStats> {
    const dates = this.lastDays(daysBack, today);
    const stats: DetectBoletinesStats = {
      boletines: ALL_BOLETIN_ADAPTERS.length,
      daysScanned: 0,
      candidatesDays: 0,
      signals: 0,
      temarioSignals: 0,
      errors: 0,
    };

    // Registro de norma-fuente del temario (para auto-vincular señales temario_change
    // a la oposición cuya Orden de programas se modifica). Se carga 1× por pasada.
    let normas: ProgramaNormaRow[] = [];
    try {
      normas = await this.queries.getProgramaNormas();
    } catch (err) {
      this.logger.warn(
        `No se pudo cargar oposicion_programa_normas: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const normaIndex = buildNormaIndex(normas);

    // Catálogo para el matcher (1× por pasada). ANTES este servicio insertaba
    // SIEMPRE oposicionId=null → todo novel → señales huérfanas que no se
    // auto-vinculan. Ahora corre el matcher (como el orchestrator del radar):
    // boe_api → Estatal, regional → Autonómica. El matcher tiene guardas de
    // región/nivel, así que no casa cross-región.
    let matchCatalog: Awaited<
      ReturnType<typeof this.queries.loadOposicionesForMatch>
    > = [];
    try {
      matchCatalog = await this.queries.loadOposicionesForMatch();
    } catch (err) {
      this.logger.warn(
        `No se pudo cargar catálogo para matcher: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    for (const adapter of ALL_BOLETIN_ADAPTERS) {
      for (let di = 0; di < dates.length; di++) {
        const date = dates[di];
        // Adapters sin fecha (sumario vigente): se leen 1× por pasada (día 0).
        if (adapter.dateless && di > 0) break;
        stats.daysScanned++;
        let hit;
        try {
          hit = await adapter.scan(date);
        } catch (err) {
          stats.errors++;
          this.logger.warn(
            `${adapter.key} ${date.toISOString().slice(0, 10)}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          continue;
        }
        if (!hit) continue;

        const ymd = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(
          date.getUTCDate(),
        ).padStart(2, '0')}`;

        // --- 2ª pasada: cambios de temario/programa (independiente de convocatorias) ---
        if (hit.temarioText.trim()) {
          await this.processTemario(hit, adapter, ymd, normaIndex, stats);
        }

        // --- 1ª pasada: convocatorias de ingreso ---
        if (!hit.candidatesText.trim()) continue;
        stats.candidatesDays++;

        const extraction = await this.llm.extractRegionalOeps(
          hit.candidatesText,
          adapter.regionName,
        );
        if (!extraction || extraction.oeps.length === 0) continue;

        for (const oep of extraction.oeps) {
          // Fase 0 "catalogar TODO" (04/07/2026): SIN guardarraíl de grupo
          // excluyente. Se catalogan todos los grupos (A1/A2/B/C1/C2/AP); el
          // grupo solo se REGISTRA para priorizar/triar, no para descartar.
          // (Antes se descartaban A1/A2/B; misión = BD más grande sin gaps.)

          const nameKey = oep.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 80);
          const dedupeKey = `boletin:${adapter.key}:${ymd}:${nameKey}`;

          // Auto-vinculación: correr el matcher (antes: oposicionId=null siempre).
          let match: { matched: boolean; oposicionId: string | null } = {
            matched: false,
            oposicionId: null,
          };
          try {
            match = await this.queries.matchDetectedOepToOposicion(
              {
                cuerpo: oep.name,
                regionName: adapter.regionName,
                grupo: oep.positionGroup ?? null,
                admin:
                  adapter.sensorType === 'boe_api' ? 'Estatal' : 'Autonómica',
                organismo: null,
                bocRef: oep.bocRef ?? null,
              },
              matchCatalog,
            );
          } catch {
            // matcher best-effort: si falla, cae a novel (comportamiento previo)
          }
          const score = Math.min(
            100,
            baseScoreBySensor(adapter.sensorType) +
              (oep.plazas ? 10 : 0) +
              (match.matched ? 10 : 0),
          );

          try {
            const { inserted } = await this.queries.insertSignal({
              oposicionId: match.oposicionId,
              sensorType: adapter.sensorType,
              sourceUrl: oep.url ?? hit.url,
              regionName: adapter.regionName,
              detectedOposicionName: oep.name,
              detectedYear: oep.year ?? null,
              detectedPlazasLibre: oep.plazas ?? null,
              detectedBocRef: oep.bocRef ?? null,
              detectedFechaInscripcionFin: oep.fechaInscripcionFin ?? null,
              detectedEstado: oep.estado ?? null,
              confidenceScore: score,
              isNovel: !match.matched,
              signalSummary: `[${adapter.regionName}] ${oep.name}${
                oep.plazas ? ` (${oep.plazas} plazas)` : ''
              }`,
              rawExtraction: { boletin: adapter.key, fecha: ymd, oep },
              dedupeKey,
            });
            if (inserted) {
              stats.signals++;
              this.logger.warn(`SEÑAL ${adapter.key} ${ymd}: ${oep.name}`);
            }
          } catch (err) {
            stats.errors++;
            this.logger.error(
              `insertSignal falló: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    }

    this.logger.log(
      `detect-boletines: ${stats.signals} señales convocatoria + ${stats.temarioSignals} temario ` +
        `(${stats.candidatesDays} días con candidatos de ${stats.daysScanned} escaneados). ` +
        `Boletines temario pendientes (headless/PDF, no cubiertos aún): ` +
        CCAA_BOLETINES_PENDING.map((p) => p.key).join(', '),
    );
    return stats;
  }

  /**
   * 2ª pasada: sobre el `temarioText` ya pre-filtrado del sumario, extrae con LLM
   * las Ordenes que modifican/aprueban un temario y emite señales `temario_change`.
   * Si la Orden modifica una norma-fuente registrada, auto-vincula la oposición.
   */
  private async processTemario(
    hit: BoletinHit,
    adapter: BoletinAdapter,
    ymd: string,
    normaIndex: Map<string, { oposicionId: string; nombre: string }>,
    stats: DetectBoletinesStats,
  ): Promise<void> {
    const extraction = await this.llm.extractTemarioChanges(
      hit.temarioText,
      adapter.regionName,
    );
    if (!extraction || extraction.changes.length === 0) return;

    for (const change of extraction.changes) {
      // Auto-vinculación: ¿la Orden modificada (o la propia) es una norma-fuente nuestra?
      const match =
        normaIndex.get(normaCore(change.modificaNorma)) ??
        normaIndex.get(normaCore(change.normaRef));
      const oposicionId = match?.oposicionId ?? null;
      const score = Math.min(100, baseScoreBySensor('temario_change') + (match ? 10 : 0));

      const refSlug = (change.normaRef ?? change.cuerpo ?? 'temario')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 60);
      // Dedup por (boletín, norma) SIN fecha: una Orden = una señal, aunque el
      // sumario "vigente" se relea varios días de la ventana (adapters dateless).
      const dedupeKey = `temario:${adapter.key}:${refSlug}`;

      try {
        const { inserted } = await this.queries.insertSignal({
          oposicionId,
          sensorType: 'temario_change',
          sourceUrl: change.url ?? hit.url,
          regionName: change.ambito ?? adapter.regionName,
          detectedOposicionName: match?.nombre ?? change.cuerpo,
          detectedBocRef: change.normaRef ?? change.modificaNorma ?? null,
          detectedFechaPublicacion: change.fecha ?? null,
          confidenceScore: score,
          isNovel: true,
          signalSummary: `[TEMARIO ${change.ambito ?? adapter.regionName}] ${change.cuerpo}: ${change.resumen}`.slice(
            0,
            500,
          ),
          rawExtraction: {
            boletin: adapter.key,
            fecha: ymd,
            change,
            matchedOposicionId: oposicionId,
          },
          dedupeKey,
        });
        if (inserted) {
          stats.temarioSignals++;
          this.logger.warn(`SEÑAL temario ${adapter.key} ${ymd}: ${change.cuerpo} (${change.normaRef ?? '—'})`);
        }
      } catch (err) {
        stats.errors++;
        this.logger.error(
          `insertSignal (temario) falló: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}

/**
 * Núcleo canónico de una referencia normativa: `TIPO NN/AAAA` → `pre-76-2024`.
 * Permite emparejar "Orden PRE/76/2024" con "la Orden PRE/76/2024, de 29 de agosto".
 * Devuelve '' si no encuentra el patrón (nunca hace match espurio con '').
 */
export function normaCore(ref: string | null | undefined): string {
  if (!ref) return '';
  const m = ref.match(/([A-Za-zÁÉÍÓÚÑ]{2,5})?\s*[\/-]?\s*(\d{1,4})\s*\/\s*(\d{4})/);
  if (!m) return '';
  const prefix = (m[1] ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return `${prefix}-${m[2]}-${m[3]}`;
}

/** Índice normalizado norma-core → oposición, para auto-vincular señales de temario. */
export function buildNormaIndex(
  normas: ProgramaNormaRow[],
): Map<string, { oposicionId: string; nombre: string }> {
  const idx = new Map<string, { oposicionId: string; nombre: string }>();
  for (const n of normas) {
    const key = normaCore(n.norma_ref);
    if (key) idx.set(key, { oposicionId: n.oposicion_id, nombre: n.oposicion_nombre });
  }
  return idx;
}
