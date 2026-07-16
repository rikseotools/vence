import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { AnthropicService } from '../anthropic/anthropic.service';
import { contentHealthFindings, convocatoriaDocumentos } from './convocatoria-documentos.schema';
import { parseNotasJson } from './notas-extract';
import {
  buildProcesoPrompt,
  hitosValidos,
  reconciliar,
  type ProcesoExtraction,
} from './proceso-extract';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const KIND = 'convocatoria_descuadre_oficial';

export interface ReconcileStats {
  convocatorias: number;
  conDocumentos: number;
  extraidas: number;
  descuadres: number;
  errores: number;
}

/**
 * Fase 2 — reconcilia lo que MOSTRAMOS contra el documento OFICIAL y emite hallazgos.
 *
 * Es la pieza que ESCALA: un sensor de cobertura dice "no lo has mirado" (necesita un humano por
 * convocatoria → no llega a 2.489); esto dice "el BOCM dice mayo y tú muestras noviembre".
 *
 * Lee del CORPUS (`convocatoria_documentos.extracted_text`), NO de la red: por eso guardar el texto
 * íntegro paga — re-reconciliar no re-descarga nada, y si el PDF desaparece del boletín la evidencia
 * sigue siendo nuestra.
 *
 * NUNCA auto-flip: el descuadre es un `content_health_finding` para revisar, jamás un UPDATE.
 * Lógica validada en runtime contra el BOCM real (Orden 1634/2026) por
 * `backend/scripts/sim-reconciliacion-convocatoria.ts` ANTES de aterrizar aquí — mismo camino que
 * siguió `notas-extract.ts`.
 */
@Injectable()
export class ReconcileConvocatoriaService {
  private readonly logger = new Logger(ReconcileConvocatoriaService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly anthropic: AnthropicService,
  ) {}

  async run(): Promise<ReconcileStats> {
    const stats: ReconcileStats = { convocatorias: 0, conDocumentos: 0, extraidas: 0, descuadres: 0, errores: 0 };

    // Solo convocatorias VIGENTES de oposiciones que PREPARAMOS, y con documentos en el corpus.
    // Priorizar por impacto no es un lujo: 2.489 hallazgos no es observabilidad, es ruido — y el
    // ruido es exactamente cómo se llegó al bug que originó este sistema.
    const filas = await this.db.execute<{
      slug: string; convocatoria_id: string; exam_date: string | null;
      plazas_libres: number | null; plazas_promocion_interna: number | null;
    }>(sql`
      SELECT o.slug, c.id AS convocatoria_id,
             s.exam_date::text, s.plazas_libres, s.plazas_promocion_interna
        FROM convocatorias c
        JOIN oposiciones o ON o.id = c.oposicion_id
        JOIN oposiciones_ssot s ON s.slug = o.slug
       WHERE c.is_current AND o.is_active
         AND EXISTS (SELECT 1 FROM convocatoria_documentos d
                      WHERE d.convocatoria_id = c.id AND coalesce(d.extracted_text,'') <> '')
    `);

    stats.convocatorias = filas.length;

    for (const f of filas) {
      try {
        const n = await this.reconcileUna(f);
        stats.conDocumentos += 1;
        if (n >= 0) stats.extraidas += 1;
        stats.descuadres += Math.max(n, 0);
      } catch (err) {
        stats.errores += 1;
        this.logger.warn(`Reconcile ${f.slug}: ${(err as Error).message}`);
      }
    }

    this.logger.log(
      `Reconciliación: ${stats.extraidas}/${stats.convocatorias} convocatorias extraídas, ` +
        `${stats.descuadres} descuadres, ${stats.errores} errores`,
    );
    return stats;
  }

  /** @returns nº de descuadres emitidos, o -1 si el LLM no pudo opinar. */
  private async reconcileUna(f: {
    slug: string; convocatoria_id: string; exam_date: string | null;
    plazas_libres: number | null; plazas_promocion_interna: number | null;
  }): Promise<number> {
    const docs = await this.db
      .select({
        titulo: convocatoriaDocumentos.titulo,
        texto: convocatoriaDocumentos.extractedText,
        url: convocatoriaDocumentos.url,
        id: convocatoriaDocumentos.id,
      })
      .from(convocatoriaDocumentos)
      .where(eq(convocatoriaDocumentos.convocatoriaId, f.convocatoria_id))
      .limit(6);

    const utiles = docs.filter((d) => (d.texto ?? '').trim().length > 200);
    if (!utiles.length) return -1;

    const client = await this.anthropic.getClient();
    const resp = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: buildProcesoPrompt(
            f.slug,
            utiles.map((d) => ({ titulo: d.titulo ?? d.url, texto: d.texto ?? '' })),
          ),
        },
      ],
    });
    const block = resp.content[0];
    const parsed = parseNotasJson(block && block.type === 'text' ? block.text : '') as unknown as ProcesoExtraction | null;
    if (!parsed) {
      this.logger.warn(`Reconcile ${f.slug}: el LLM no devolvió JSON parseable`);
      return -1;
    }

    // El LLM no define el modelo: se descartan tipos fuera del vocabulario y hitos sin cita.
    const ext: ProcesoExtraction = { ...parsed, hitos: hitosValidos(parsed.hitos ?? []) };

    // Guardar la extracción junto a su documento (auditable: qué se leyó y con qué confianza).
    await this.db
      .update(convocatoriaDocumentos)
      .set({ llmExtraction: ext as unknown as Record<string, unknown>, updatedAt: sql`now()` })
      .where(eq(convocatoriaDocumentos.id, utiles[0].id));

    const descuadres = reconciliar(ext, {
      exam_date: f.exam_date,
      plazas_libres: f.plazas_libres,
      plazas_promocion_interna: f.plazas_promocion_interna,
    });

    // Idempotente: este cron es la única fuente de este kind para esta oposición.
    await this.db
      .delete(contentHealthFindings)
      .where(and(eq(contentHealthFindings.kind, KIND), eq(contentHealthFindings.oposicionSlug, f.slug)));

    for (const d of descuadres) {
      await this.db.insert(contentHealthFindings).values({
        category: 'content',
        severity: d.severidad,
        oposicionSlug: f.slug,
        kind: KIND,
        message:
          d.severidad === 'error'
            ? `${d.campo}: mostramos "${d.db}" y el documento oficial dice "${d.oficial}"`
            : `${d.campo}: el documento oficial dice "${d.oficial}" y nosotros no lo mostramos`,
        detail: {
          campo: d.campo,
          db: d.db,
          oficial: d.oficial,
          cita_literal: d.cita, // la evidencia viaja CON el hallazgo: nunca una acusación sin prueba
          url: utiles[0].url,
          confianza: ext.confianza,
        },
      });
    }
    if (descuadres.length) {
      this.logger.warn(`Reconcile ${f.slug}: ${descuadres.length} descuadre(s) vs documento oficial`);
    }
    return descuadres.length;
  }
}
