import { Injectable, Logger } from '@nestjs/common';
import { CanaryProbe, CanaryBounding } from '../canary-shared/canary-probe';
import { CanaryResult, CanaryResults } from '../canary-shared/canary-result';

/**
 * Canary sintético EXTERNO — Nivel 4. Comprueba, desde fuera (Fargate → egress
 * público → CloudFront), lo que los canarios internos NO ven:
 *   1. La home carga por CloudFront (200) y su HTML referencia chunks.
 *   2. Un chunk `_next/static` carga (200) → valida assets/S3/CloudFront/origin-group.
 *      (Cierra el gap de la clase "app congelada / ChunkLoadError" 05/07.)
 *   3. El backend responde en `api.vence.es/health` (200).
 *
 * Corre pase lo que pase (no depende de tráfico real), así que caza roturas de
 * madrugada. El guardado autenticado end-to-end lo cubren `canary-answer-save`
 * (POST real al edge) + `RULE_SAVE_RECONCILIATION` (respondidas vs guardadas);
 * los 502/edge sostenidos, `RULE_CLIENT_EDGE_SUSTAINED`.
 *
 * HTTP-only, sin escrituras a BD → cero polución, cero riesgo de alert-fatigue.
 */
export interface CanarySyntheticResult {
  ok: boolean;
  step?: string;
  errorMessage?: string;
  durationMs: number;
  details: Record<string, unknown>;
}

@Injectable()
export class CanarySyntheticExternalService implements CanaryProbe {
  private readonly logger = new Logger(CanarySyntheticExternalService.name);
  private readonly SITE = process.env.SMOKE_TARGET_URL ?? 'https://www.vence.es';
  private readonly API = process.env.CANARY_API_URL ?? 'https://api.vence.es';

  // ── Contrato CanaryProbe (ver canary-registry.ts) ──
  readonly name = 'synthetic-external';
  readonly eventBase = 'synthetic_external';
  readonly cadence = '*/5 * * * *';
  readonly writesToProd = false; // HTTP-only (home + chunk + health), sin escrituras
  readonly bounding: CanaryBounding = 'read-only';

  /** Adaptador al contrato: preserva `details` en metadata (como emitía el cron). */
  async execute(): Promise<Omit<CanaryResult, 'durationMs'>> {
    const r = await this.run();
    return r.ok
      ? CanaryResults.ok({ metadata: r.details })
      : CanaryResults.failed(r.step ?? 'exception', r.errorMessage ?? 'fallo sin mensaje', { metadata: r.details });
  }

  async run(): Promise<CanarySyntheticResult> {
    const startedAt = Date.now();
    const details: Record<string, unknown> = {};
    const dur = () => Date.now() - startedAt;
    const headers = {
      'User-Agent': 'Vence-Canary-Synthetic/1.0',
      'x-vence-canary': '1',
    };

    try {
      // ─── 1. Home por CloudFront ───
      const homeRes = await fetch(`${this.SITE}/`, {
        headers,
        signal: AbortSignal.timeout(12_000),
      });
      details.homeStatus = homeRes.status;
      if (homeRes.status !== 200) {
        return { ok: false, step: 'home', errorMessage: `home devolvió ${homeRes.status}`, durationMs: dur(), details };
      }
      const html = await homeRes.text();
      const chunkMatch = html.match(/\/_next\/static\/chunks\/[^"']+\.js/);
      if (!chunkMatch) {
        return { ok: false, step: 'home_no_chunk', errorMessage: 'la home no referencia ningún chunk (¿render/SSR roto?)', durationMs: dur(), details };
      }
      const chunkPath = chunkMatch[0];
      details.chunk = chunkPath;

      // ─── 2. Chunk de assets (S3 → CloudFront origin group) ───
      const chunkRes = await fetch(`${this.SITE}${chunkPath}`, {
        headers,
        signal: AbortSignal.timeout(12_000),
      });
      details.chunkStatus = chunkRes.status;
      if (chunkRes.status !== 200) {
        return {
          ok: false,
          step: 'assets',
          errorMessage: `chunk ${chunkPath} devolvió ${chunkRes.status} — assets/S3/CloudFront rotos (clase ChunkLoadError/app congelada)`,
          durationMs: dur(),
          details,
        };
      }

      // ─── 3. Backend health por su edge ───
      const healthRes = await fetch(`${this.API}/health`, {
        headers,
        signal: AbortSignal.timeout(12_000),
      });
      details.healthStatus = healthRes.status;
      if (healthRes.status !== 200) {
        return { ok: false, step: 'backend_health', errorMessage: `api.vence.es/health devolvió ${healthRes.status}`, durationMs: dur(), details };
      }

      return { ok: true, durationMs: dur(), details };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, step: 'exception', errorMessage: `canary sintético reventó: ${msg}`, durationMs: dur(), details };
    }
  }
}
