// backend/src/radar/orchestrator.ts
//
// Orquestador ÚNICO del radar multi-capa. Corre las 3 capas EN CASCADE por
// prioridad, con aislamiento total por adapter (fail-open) y telemetría de todo
// lo que pasa. Ningún adapter puede tumbar la pasada.
//
//   Capa 1 boletines → Capa 2 agregadores → Capa 3 competidores
//   dedup cross-capa por REF OFICIAL (en persist) · gap-audit al final
//
// Diseño: docs/roadmap/radar-multicapa.md

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { OepSignalsLlmService } from '../oep-signals/oep-signals-llm.service';
import { OepSignalsQueriesService } from '../oep-signals/oep-signals-queries.service';
import { RadarTelemetry } from './core/telemetry';
import { BOLETIN_ADAPTERS } from './layers/boletines/registry';
import { AGGREGATOR_ADAPTERS } from './layers/aggregators/registry';
import { COMPETITOR_ADAPTERS } from './layers/competitors/registry';
import {
  AdapterRunResult,
  RawCandidate,
  ScanContext,
  SourceAdapter,
} from './core/types';

const ADAPTER_TIMEOUT_MS = 60_000;

@Injectable()
export class RadarOrchestrator {
  private readonly logger = new Logger(RadarOrchestrator.name);

  constructor(
    private readonly llm: OepSignalsLlmService,
    private readonly queries: OepSignalsQueriesService,
    private readonly telemetry: RadarTelemetry,
  ) {}

  /** Todos los adapters de las 3 capas, ordenados por prioridad (cascada). */
  private adapters(): SourceAdapter[] {
    return [
      ...BOLETIN_ADAPTERS,
      ...AGGREGATOR_ADAPTERS,
      ...COMPETITOR_ADAPTERS,
    ].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Una pasada completa del radar.
   * @param daysBack ventana de días (boletines cubren fin de semana en L-V).
   */
  async run(daysBack = 4, today: Date = new Date()): Promise<{ runId: string }> {
    const runId = randomUUID();
    const adapters = this.adapters();
    await this.telemetry.runStarted(runId, adapters.length);

    const totals = { candidates: 0, signalsNew: 0, failed: 0, gaps: 0 };
    // Acumula, por capa, las refs oficiales vistas → base del gap-audit.
    const officialSeen = { byOfficial: new Set<string>(), competitorOnly: [] as RawCandidate[] };

    for (const adapter of adapters) {
      const startedAt = new Date();
      const ctx: ScanContext = { today, daysBack };
      let result: AdapterRunResult;

      try {
        const candidates = await this.withTimeout(adapter.scan(ctx), ADAPTER_TIMEOUT_MS);
        totals.candidates += candidates.length;

        const { signalsNew, signalsDupe } = await this.processCandidates(
          runId,
          adapter,
          candidates,
        );
        totals.signalsNew += signalsNew;

        // Registro para el gap-audit (§4.2): qué refs oficiales vio cada capa.
        for (const c of candidates) {
          if (c.officialUrl) officialSeen.byOfficial.add(normalizeRef(c.officialUrl));
          if (adapter.layer === 'competitor') officialSeen.competitorOnly.push(c);
        }

        result = {
          runId,
          layer: adapter.layer,
          adapterKey: adapter.key,
          status: candidates.length === 0 ? 'empty' : 'ok',
          startedAt,
          durationMs: Date.now() - startedAt.getTime(),
          itemsScanned: candidates.length,
          candidates: candidates.length,
          signalsNew,
          signalsDupe,
        };
      } catch (err) {
        totals.failed++;
        const msg = err instanceof Error ? err.message : String(err);
        result = {
          runId,
          layer: adapter.layer,
          adapterKey: adapter.key,
          status: msg.includes('timeout') ? 'timeout' : 'failed',
          startedAt,
          durationMs: Date.now() - startedAt.getTime(),
          itemsScanned: 0,
          candidates: 0,
          signalsNew: 0,
          signalsDupe: 0,
          errorMessage: msg,
        };
        this.logger.warn(`[${adapter.key}] ${msg}`);
      }

      await this.telemetry.adapterFinished(result); // ← fail-open: nunca lanza
    }

    // Gap-audit: lo que solo vio un competidor y ninguna capa oficial.
    totals.gaps = await this.gapAudit(runId, officialSeen);

    await this.telemetry.runFinished(runId, totals);
    return { runId };
  }

  /**
   * Pipeline compartido por candidato: filtro de nicho → extracción LLM →
   * guardarraíl de grupo (¡ahora TODOS los grupos, Fase 0!) → dedupeKey por ref
   * oficial → insertSignal idempotente.
   *
   * NOTA (Fase 1): esta lógica reproduce la de `detect-boletines.service.ts`
   * generalizada al contrato `RawCandidate`. Se factoriza a `core/pipeline.ts`
   * cuando se migren los adapters de boletines/PAG. Para competidores añade,
   * antes de persistir, el paso de VERIFICAR contra `officialUrl` (Fase 3).
   */
  private async processCandidates(
    runId: string,
    adapter: SourceAdapter,
    candidates: RawCandidate[],
  ): Promise<{ signalsNew: number; signalsDupe: number }> {
    let signalsNew = 0;
    let signalsDupe = 0;

    for (const c of candidates) {
      // Fuentes ya estructuradas (PAG) saltan el LLM; el resto lo usan sobre `text`.
      const oeps =
        c.preExtracted ??
        (await this.llm.extractRegionalOeps(
          c.text,
          c.regionName ?? adapter.regionName ?? 'España',
        ))?.oeps ??
        [];
      if (oeps.length === 0) continue;

      for (const oep of oeps) {
        // Fase 0: catalogar TODO → sin guardarraíl de grupo excluyente.
        // Solo se registra el grupo para poder priorizar/triar por él.
        const dedupeKey = c.dedupeKey ?? buildDedupeKey(adapter, c, oep);
        try {
          const { inserted } = await this.queries.insertSignal({
            oposicionId: null,
            sensorType: sensorTypeFor(adapter),
            sourceUrl: c.officialUrl ?? c.sourceUrl,
            regionName: c.regionName ?? adapter.regionName ?? null,
            detectedOposicionName: oep.name,
            detectedYear: oep.year ?? null,
            detectedPlazasLibre: oep.plazas ?? null,
            detectedBocRef: oep.bocRef ?? null,
            detectedFechaInscripcionFin: oep.fechaInscripcionFin ?? null,
            detectedEstado: oep.estado ?? null,
            confidenceScore: 50,
            isNovel: true,
            signalSummary: `[${adapter.key}] ${oep.name}${oep.plazas ? ` (${oep.plazas} plazas)` : ''}`,
            rawExtraction: { adapter: adapter.key, layer: adapter.layer, officialUrl: c.officialUrl, oep },
            dedupeKey,
          } as never);
          if (inserted) {
            signalsNew++;
            await this.telemetry.signalNew(runId, adapter.layer, adapter.key, oep.name, oep.bocRef ?? null);
          } else {
            signalsDupe++;
          }
        } catch (err) {
          this.logger.error(`insertSignal [${adapter.key}]: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    return { signalsNew, signalsDupe };
  }

  /**
   * Reconciliación anti-gaps: por cada convocatoria vista SOLO por un competidor
   * cuya ref oficial no la vio ninguna capa oficial → gap-alert con el boletín
   * que falta. Es el mecanismo que hace que el sistema se autocomplete.
   */
  private async gapAudit(
    runId: string,
    seen: { byOfficial: Set<string>; competitorOnly: RawCandidate[] },
  ): Promise<number> {
    let gaps = 0;
    for (const c of seen.competitorOnly) {
      if (!c.officialUrl) continue;
      const ref = normalizeRef(c.officialUrl);
      // Si además de este competidor lo vio alguien más, no es gap. (Aproximación
      // de la Fase 2: el chequeo definitivo cruza contra oep_detection_signals.)
      const boletin = boletinFromUrl(c.officialUrl);
      const alsoOfficial = [...seen.byOfficial].filter((r) => r === ref).length > 1;
      if (!alsoOfficial) {
        await this.telemetry.gapDetected(runId, c.rawName ?? c.text, boletin, c.officialUrl);
        gaps++;
      }
    }
    return gaps;
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
    ]);
  }
}

/** `sensor_type` válido (CHECK) según el adapter o su capa. */
function sensorTypeFor(adapter: SourceAdapter): string {
  if (adapter.sensorType) return adapter.sensorType;
  return adapter.layer === 'competitor'
    ? 'competitor'
    : adapter.layer === 'aggregator'
      ? 'pag_empleo'
      : 'regional_scan';
}

/** Dedup por REF OFICIAL normalizada (no por URL de origen). */
function buildDedupeKey(adapter: SourceAdapter, c: RawCandidate, oep: { bocRef?: string | null; name: string }): string {
  const ref = oep.bocRef ? normalizeRef(oep.bocRef) : c.officialUrl ? normalizeRef(c.officialUrl) : slug(oep.name);
  return `oficial:${ref}`;
}

function normalizeRef(s: string): string {
  return s.toLowerCase().replace(/https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
}

function slug(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 80);
}

function boletinFromUrl(url: string): string | null {
  const map: Record<string, string> = {
    'boe.es': 'BOE', 'gencat': 'DOGC', 'dogc': 'DOGC', 'caib': 'BOIB', 'borm.es': 'BORM',
    'jcyl': 'BOCYL', 'xunta': 'DOG', 'gva': 'DOGV', 'juntadeandalucia': 'BOJA', 'navarra': 'BON',
    'euskadi': 'BOPV', 'larioja': 'BOR', 'gobcan': 'BOC-Canarias', 'cantabria': 'BOC-Cantabria',
  };
  for (const k of Object.keys(map)) if (url.includes(k)) return map[k];
  return null;
}
