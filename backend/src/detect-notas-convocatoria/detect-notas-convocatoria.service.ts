import { Inject, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { AnthropicService } from '../anthropic/anthropic.service';
import { OepSignalsLlmService } from '../oep-signals/oep-signals-llm.service';
import { convocatoriaNotas, oposiciones } from './convocatoria-notas.schema';
import {
  buildNotasPrompt,
  extractDocLinks,
  extractSublinks,
  hasActionableSignal,
  htmlToText,
  parseNotasJson,
  scanSignals,
  type NotaSignals,
} from './notas-extract';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const MAX_DOCS_PER_OPO = 8;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

export interface DetectNotasStats {
  total: number;
  scanned: number;
  notasFound: number;
  actionable: number;
  needsManual: number;
  errors: number;
}

/**
 * Sensor `detect-notas-convocatoria`: lee TODAS las notas informativas del
 * `seguimiento_url` de cada oposición (con fallback headless para páginas JS),
 * extrae señales de versión/fecha/criterio con el LLM y persiste cada nota en
 * `convocatoria_notas` como cola de triaje. No falla en silencio: si la página
 * renderiza pero no hay documentos, marca `needs_manual=true`.
 *
 * Lógica de extracción validada en runtime por scripts/sim-notas-pipeline.cjs.
 */
@Injectable()
export class DetectNotasConvocatoriaService {
  private readonly logger = new Logger(DetectNotasConvocatoriaService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly llm: OepSignalsLlmService,
    private readonly anthropic: AnthropicService,
  ) {}

  async run(): Promise<DetectNotasStats> {
    const opos = await this.db
      .select({
        id: oposiciones.id,
        nombre: oposiciones.nombre,
        slug: oposiciones.slug,
        seguimientoUrl: oposiciones.seguimientoUrl,
        fetcherType: oposiciones.fetcherType,
      })
      .from(oposiciones)
      .where(isNotNull(oposiciones.seguimientoUrl));

    const stats: DetectNotasStats = {
      total: opos.length,
      scanned: 0,
      notasFound: 0,
      actionable: 0,
      needsManual: 0,
      errors: 0,
    };

    for (const opo of opos) {
      try {
        const r = await this.processOposicion(opo);
        stats.scanned += 1;
        stats.notasFound += r.notasFound;
        stats.actionable += r.actionable;
        stats.needsManual += r.needsManual;
      } catch (err) {
        stats.errors += 1;
        this.logger.warn(`Error notas ${opo.slug}: ${(err as Error).message}`);
      }
    }

    this.logger.log(
      `Notas: ${stats.scanned}/${stats.total} oposiciones, ${stats.notasFound} notas, ` +
        `${stats.actionable} con versión/criterio, ${stats.needsManual} a revisión manual`,
    );
    return stats;
  }

  private async processOposicion(opo: {
    id: string;
    slug: string | null;
    seguimientoUrl: string | null;
    fetcherType: string | null;
  }): Promise<{ notasFound: number; actionable: number; needsManual: number }> {
    if (!opo.seguimientoUrl) return { notasFound: 0, actionable: 0, needsManual: 0 };

    const fetcher = opo.fetcherType === 'headless' ? 'headless' : 'http';
    const page = await this.llm.fetchPageHtml(opo.seguimientoUrl, 15000, fetcher);
    if (!page.html) throw new Error(page.error ?? 'fetch sin html');

    // 1. Documentos directos; si hay pocos, seguir sublinks de "documentación".
    let docs = extractDocLinks(page.html, opo.seguimientoUrl);
    if (docs.length < 2) {
      for (const sub of extractSublinks(page.html, opo.seguimientoUrl)) {
        const subPage = await this.llm.fetchPageHtml(sub, 15000, 'http');
        if (subPage.html) docs.push(...extractDocLinks(subPage.html, sub));
      }
      docs = [...new Set(docs)];
    }

    // 2. Página renderizó pero 0 documentos → revisión manual (no silencio).
    if (docs.length === 0) {
      await this.upsertNota(opo.id, opo.seguimientoUrl, 'Página sin documentos extraíbles', '', {} as NotaSignals, null, 'baja', true);
      return { notasFound: 0, actionable: 0, needsManual: 1 };
    }

    // 3. Leer cada documento (PDF → texto), escanear señales.
    const notas: Array<{ url: string; title: string; text: string; signals: NotaSignals }> = [];
    for (const url of docs.slice(0, MAX_DOCS_PER_OPO)) {
      const text = await this.fetchPdfText(url);
      if (text.trim().length < 100) continue;
      const title = decodeURIComponent(url.split('/').pop() ?? url).replace(/[-_]/g, ' ').slice(0, 90);
      notas.push({ url, title, text, signals: scanSignals(text) });
    }
    if (notas.length === 0) return { notasFound: 0, actionable: 0, needsManual: 0 };

    // 4. LLM: extracción estructurada con citas (una llamada por oposición).
    let llmExtraction: Record<string, unknown> | null = null;
    let confianza: string | null = null;
    try {
      const client = await this.anthropic.getClient();
      const prompt = buildNotasPrompt(opo.slug ?? '', htmlToText(page.html), notas);
      const resp = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = resp.content[0];
      const rawText = block && block.type === 'text' ? block.text : '';
      llmExtraction = parseNotasJson(rawText);
      confianza =
        typeof llmExtraction?.confianza === 'string' ? (llmExtraction.confianza as string) : null;
    } catch (err) {
      this.logger.warn(`LLM notas ${opo.slug}: ${(err as Error).message}`);
    }

    // 5. Persistir cada nota (UPSERT por oposición+url).
    let actionable = 0;
    for (const n of notas) {
      const act = hasActionableSignal(n.signals);
      if (act) actionable += 1;
      await this.upsertNota(opo.id, n.url, n.title, n.text, n.signals, llmExtraction, confianza, false);
    }
    return { notasFound: notas.length, actionable, needsManual: 0 };
  }

  /** Descarga un PDF y extrae su texto. Devuelve '' si no es PDF o falla. */
  private async fetchPdfText(url: string): Promise<string> {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'VenceBot/1.0' } });
      if (!res.ok) return '';
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_PDF_BYTES || buf.slice(0, 5).toString('latin1') !== '%PDF-') return '';
      // pdf-parse@1.1.1: importar la SUBRUTA lib evita el "debug-block" del index.js
      // que intenta leer un PDF de test y crashea al importarlo (módulo sin tipos).
      // @ts-expect-error: 'pdf-parse/lib/pdf-parse.js' no trae tipos.
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (b: Buffer) => Promise<{ text: string }>;
      const parsed = await pdfParse(buf);
      return parsed.text ?? '';
    } catch {
      return '';
    }
  }

  private async upsertNota(
    oposicionId: string,
    url: string,
    title: string,
    text: string,
    signals: NotaSignals,
    llmExtraction: Record<string, unknown> | null,
    confianza: string | null,
    needsManual: boolean,
  ): Promise<void> {
    const contentHash = crypto.createHash('sha256').update(text).digest('hex');
    await this.db
      .insert(convocatoriaNotas)
      .values({
        oposicionId,
        url,
        title,
        contentHash,
        signals,
        llmExtraction,
        confianza,
        needsManual,
      })
      .onConflictDoUpdate({
        target: [convocatoriaNotas.oposicionId, convocatoriaNotas.url],
        set: {
          title,
          contentHash,
          signals,
          llmExtraction,
          confianza,
          needsManual,
          lastSeen: sql`now()`,
        },
      });
  }
}
