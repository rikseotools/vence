import { Injectable, Logger } from '@nestjs/common';
import { signCanaryToken } from '../canary-shared/canary-token';

/**
 * Canary POR-LEYES SCOPE — verifica en prod que el "test por leyes" ACOTADO a la
 * oposición (scopeToPosition=true) NO trae artículos fuera del temario. Fixture:
 * administrativo_gva + LCSP (Ley 9/2017): el temario entra hasta el art 130; la ley
 * completa llega a >300. Regresión = el modo acotado devuelve arts >130 (scope roto,
 * la confusión de Ana). Self-verifying: además confirma que SIN acotar sí trae >130
 * (baseline), para que la comparación pruebe algo.
 *
 * AUTH: `/api/questions/filtered` reta (challenge anti-scraping) a peticiones
 * anónimas de volumen; un request AUTENTICADO lo bypasea (verificado 09/07). Por eso
 * firma un token de canary (mismo patrón que canary-save-contract) con SMOKE_USER_ID
 * + SUPABASE_JWT_SECRET; si faltan, el canary se SALTA (no falso rojo).
 */
export interface CanaryPorLeyesScopeResult {
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
  step?: string;
  errorMessage?: string;
  httpStatus?: number;
  durationMs: number;
  scopedMax?: number;
  fullMax?: number;
}

@Injectable()
export class CanaryPorLeyesScopeService {
  private readonly logger = new Logger(CanaryPorLeyesScopeService.name);
  private readonly SITE = process.env.SMOKE_TARGET_URL ?? 'https://www.vence.es';
  private readonly POS = 'administrativo_gva';
  private readonly LAW = 'Ley 9/2017';
  private readonly BOUND = 130; // GVA Tema 106: LCSP entra 1-130

  private body(scopeToPosition: boolean) {
    return {
      topicNumber: 0,
      positionType: this.POS,
      selectedLaws: [this.LAW],
      numQuestions: 60,
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      difficultyMode: 'random',
      scopeToPosition,
    };
  }

  private async fetchArts(scoped: boolean, token: string): Promise<number[]> {
    const res = await fetch(`${this.SITE}/api/questions/filtered`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vence-canary': '1',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(this.body(scoped)),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status !== 200) {
      throw Object.assign(new Error(`HTTP ${res.status}`), { httpStatus: res.status });
    }
    const j = (await res.json()) as { questions?: Array<{ article?: { number?: string } }> };
    return (j.questions ?? [])
      .map((q) => Number(q.article?.number))
      .filter((n) => !isNaN(n));
  }

  async run(): Promise<CanaryPorLeyesScopeResult> {
    const started = Date.now();
    const dur = () => Date.now() - started;

    // Token de canary (autenticado → bypasea el challenge). Skip si faltan credenciales.
    const userId = process.env.SMOKE_USER_ID;
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!userId || !jwtSecret) {
      return { skipped: true, reason: 'credentials_not_configured', durationMs: dur() };
    }
    const token = signCanaryToken(userId, { ttlSeconds: 300, email: 'smoke@vence.es', secret: jwtSecret });
    if (!token) {
      return { ok: false, step: 'sign_token', errorMessage: 'signCanaryToken devolvió null', durationMs: dur() };
    }

    let scoped: number[];
    let full: number[];
    try {
      scoped = await this.fetchArts(true, token);
    } catch (err) {
      const e = err as Error & { httpStatus?: number };
      return { ok: false, step: 'fetch_scoped', httpStatus: e.httpStatus, errorMessage: e.message, durationMs: dur() };
    }
    try {
      full = await this.fetchArts(false, token);
    } catch (err) {
      const e = err as Error & { httpStatus?: number };
      return { ok: false, step: 'fetch_full', httpStatus: e.httpStatus, errorMessage: e.message, durationMs: dur() };
    }

    if (scoped.length === 0) {
      return { ok: false, step: 'empty_scoped', errorMessage: 'scopeToPosition=true devolvió 0 preguntas', durationMs: dur() };
    }
    const scopedMax = Math.max(...scoped);
    const fullMax = full.length ? Math.max(...full) : 0;

    const leak = scoped.filter((n) => n > this.BOUND);
    if (leak.length > 0) {
      return {
        ok: false,
        step: 'scope_leak',
        errorMessage: `Test por-leyes ACOTADO (GVA/LCSP) devolvió arts fuera del temario (>${this.BOUND}): ${leak.slice(0, 10).join(',')} — SCOPE ROTO (regresión confusión Ana)`,
        durationMs: dur(),
        scopedMax,
        fullMax,
      };
    }
    // Baseline: sin acotar DEBE traer >130; si no, la comparación no valida nada.
    if (fullMax <= this.BOUND) {
      return {
        ok: false,
        step: 'no_baseline',
        errorMessage: `scopeToPosition=false no trajo arts >${this.BOUND} (fullMax=${fullMax}) — no se puede validar el scope (¿dato cambiado?)`,
        durationMs: dur(),
        scopedMax,
        fullMax,
      };
    }
    return { ok: true, durationMs: dur(), scopedMax, fullMax };
  }
}
