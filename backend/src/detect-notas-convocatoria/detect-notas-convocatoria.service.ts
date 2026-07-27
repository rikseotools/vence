import { Inject, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { OepSignalsLlmService } from '../oep-signals/oep-signals-llm.service';
import { convocatoriaNotas, oposiciones } from './convocatoria-notas.schema';
import { convocatoriaDocumentos } from './convocatoria-documentos.schema';
import {
  extractDocLinks,
  extractSublinks,
  hasActionableSignal,
  htmlToText,
  scanSignals,
  type NotaSignals,
} from './notas-extract';

const MAX_DOCS_PER_OPO = 8;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

export interface DetectNotasStats {
  total: number;
  scanned: number;
  notasFound: number;
  actionable: number;
  needsManual: number;
  errors: number;
  /** Llamadas reales al LLM (documento nuevo/cambiado o análisis caducado). */
  /** Oposiciones servidas con la extracción guardada, sin gastar tokens. */
}

const sha256 = (text: string): string =>
  crypto.createHash('sha256').update(text).digest('hex');

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
      // SOLO las oposiciones que preparamos. Antes recorría el catálogo entero (464+ con
      // seguimiento_url) y, medido el 26/07, el **96% de los documentos clonados en 7 días
      // (5.244 de 5.437) eran de procesos que nadie estudia en Vence**: 750 documentos/día de
      // ruido. Con este filtro quedan ~25/día, que es una bandeja que una sesión puede atender.
      .where(and(isNotNull(oposiciones.seguimientoUrl), eq(oposiciones.isActive, true)));

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
        // Drizzle envuelve los errores de BD en "Failed query: <sql>" y esconde
        // el mensaje REAL del driver dentro de `cause`. Sin desenvolverlo, un
        // fallo de inserción se ve como un muro de SQL sin causa y no se puede
        // diagnosticar sin reproducir a mano — pasó el 27/07 al triar estos
        // errores (T-175) y es el mismo defecto que se corrigió esa mañana en
        // `alerts.cron.ts`.
        const msg = err instanceof Error ? err.message : String(err);
        const causa =
          err instanceof Error && err.cause instanceof Error
            ? err.cause.message
            : undefined;
        this.logger.warn(
          `Error notas ${opo.slug}: ${msg}${causa ? ` | causa: ${causa}` : ''}`,
        );
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
  }): Promise<{
    notasFound: number;
    actionable: number;
    needsManual: number;
  }> {
    const vacio = {
      notasFound: 0,
      actionable: 0,
      needsManual: 0,
    };
    if (!opo.seguimientoUrl) return vacio;

    const fetcher = opo.fetcherType === 'headless' ? 'headless' : 'http';
    const page = await this.llm.fetchPageHtml(
      opo.seguimientoUrl,
      15000,
      fetcher,
    );
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
      await this.upsertNota(
        opo.id,
        opo.seguimientoUrl,
        'Página sin documentos extraíbles',
        sha256(''),
        {} as NotaSignals,
        null,
        'baja',
        true,
        false,
      );
      return { ...vacio, needsManual: 1 };
    }

    // 3. Leer cada documento (PDF → texto), escanear señales.
    const notas: Array<{
      url: string;
      title: string;
      text: string;
      hash: string;
      signals: NotaSignals;
    }> = [];
    for (const url of docs.slice(0, MAX_DOCS_PER_OPO)) {
      const text = await this.fetchPdfText(url);
      if (text.trim().length < 100) continue;
      const title = decodeURIComponent(url.split('/').pop() ?? url)
        .replace(/[-_]/g, ' ')
        .slice(0, 90);
      notas.push({
        url,
        title,
        text,
        hash: sha256(text),
        signals: scanSignals(text),
      });
    }
    if (notas.length === 0) return vacio;

    // 3-bis. CORPUS (Fase 2): guardar el texto ÍNTEGRO. Es lo que permite re-verificar sin red y
    // sobrevivir al link-rot; sin esto, la Fase 2 tendría que re-descargar los PDF en cada pase.
    const nuevosDocs = await this.persistirCorpus(opo.id, notas);
    if (nuevosDocs)
      this.logger.log(`Corpus ${opo.slug}: +${nuevosDocs} documento(s)`);

    // 4. LLM: extracción estructurada con citas (una llamada por oposición) — SOLO si hace falta.
    //
    // ── El análisis lo hace una SESIÓN, no el cron (26/07/2026) ─────────────────────────────
    // Aquí había una llamada a Haiku que pre-masticaba cada documento en un JSON de seis campos.
    // Se quitó con los datos delante: **6.886 extracciones generadas y CERO triadas** —nadie miró
    // ni una— por ~17 USD, el 56% del saldo de LLM. No era mala: era redundante. El documento se
    // clona igual en `convocatoria_documentos` con su texto y su hash, y quién decide qué se
    // publica en la landing es una sesión leyendo la FUENTE (`npm run docs:bandeja`), con criterio
    // y dual-write. Se elimina en vez de dejarla tras un flag: código muerto que alguien puede
    // encender es una factura esperando a que la enciendan.
    //
    // Efecto secundario que importa: el cron ya no depende del proveedor. El 26/07 Anthropic
    // estuvo 10 horas sin saldo y este pipeline no se habría enterado.
    //
    // Lo que SÍ se conserva: el hash por nota (detecta cambios sin gastar nada) y `scanSignals`,
    // el detector determinista que marca qué documentos merecen mirada humana primero.
    const llmExtraction: Record<string, unknown> | null = null;
    const confianza: string | null = null;
    const sellarAnalisis = false;

    // 5. Persistir cada nota (UPSERT por oposición+url).
    let actionable = 0;
    for (const n of notas) {
      const act = hasActionableSignal(n.signals);
      if (act) actionable += 1;
      await this.upsertNota(
        opo.id,
        n.url,
        n.title,
        n.hash,
        n.signals,
        llmExtraction,
        confianza,
        false,
        sellarAnalisis,
      );
    }
    return {
      notasFound: notas.length,
      actionable,
      needsManual: 0,
    };
  }

  /**
   * Vuelca los documentos leídos al CORPUS (`convocatoria_documentos`), colgados de la convocatoria
   * VIGENTE. Hasta ahora el texto se TIRABA: `convocatoria_notas` solo guarda hash y señales, así que
   * volver a mirar un documento obligaba a re-descargar el PDF — y si el boletín lo retira, la
   * evidencia se pierde. Medido: 90 KB/boletín; todo lo que preparamos ≈ 10 MB (la BD pesa 30 GB).
   *
   * Si la oposición no tiene convocatoria vigente NO se cuelga nada: un documento pertenece a un
   * CICLO, no a una oposición. Inventar el vínculo sería justo lo que rompe la provenance.
   *
   * Idempotente por (convocatoria_id, url, content_hash): un documento enmendado tiene hash nuevo →
   * fila nueva. Eso es lo que queremos para las correcciones de errores (frecuentes en BOCM/BOE).
   */
  private async persistirCorpus(
    oposicionId: string,
    notas: Array<{ url: string; title: string; text: string; hash: string }>,
  ): Promise<number> {
    const conv = await this.db.execute<{ id: string }>(
      sql`SELECT id FROM convocatorias WHERE oposicion_id = ${oposicionId} AND is_current LIMIT 1`,
    );
    const convocatoriaId = conv[0]?.id;
    if (!convocatoriaId) return 0;

    let n = 0;
    for (const nota of notas) {
      const contentHash = nota.hash;
      // .returning() devuelve SOLO las filas realmente insertadas: con onConflictDoNothing, un
      // documento ya conocido (mismo hash) devuelve [] → cuenta 0. Así el log dice la verdad.
      const insertadas = await this.db
        .insert(convocatoriaDocumentos)
        .values({
          convocatoriaId,
          tipo: 'nota',
          url: nota.url,
          // Identidad canónica del documento, para agrupar las notas por su fuente. Las notas
          // NO deduplican por doc_key (son historial de monitoreo, append por content_hash — el
          // índice único ux_…_conv_dockey excluye tipo='nota'); esto solo evita el doc_key NULL.
          docKey: sql`boletin_doc_key(${nota.url})` as unknown as string,
          titulo: nota.title,
          contentHash,
          extractedText: nota.text,
          fuente: 'detect-notas',
          fetchedAt: sql`now()`,
        })
        .onConflictDoNothing()
        .returning({ id: convocatoriaDocumentos.id });
      n += insertadas.length;
    }
    return n;
  }

  /**
   * Descarga un PDF y extrae su texto. Devuelve '' si no es PDF o falla.
   *
   * ⚠️ NO tragarse los errores (corregido 16/07/2026). El `catch {}` mudo original hacía
   * INDISTINGUIBLES tres cosas muy distintas: "la URL no es un PDF" (normal), "el boletín nos
   * bloquea" (accionable) y "falta la dependencia pdf-parse" (rotura total). Las tres devolvían '' y
   * el sensor reportaba tranquilamente "0 documentos" — mintiendo en silencio y sin una sola línea
   * de log. Se descubrió al portar la Fase 2: tres PDF del BOCM daban "ilegible" cuando en realidad
   * el módulo no resolvía. Un sensor que no puede fallar ruidosamente no es un sensor, es un adorno.
   */
  private async fetchPdfText(url: string): Promise<string> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'VenceBot/1.0' },
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 429) {
          this.logger.warn(
            `PDF bloqueado por el boletín (${res.status}): ${url}`,
          );
        }
        return '';
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_PDF_BYTES) {
        this.logger.warn(
          `PDF > ${MAX_PDF_BYTES / 1024 / 1024} MB, omitido: ${url}`,
        );
        return '';
      }
      if (buf.slice(0, 5).toString('latin1') !== '%PDF-') return ''; // no es PDF: normal, sin ruido
      // pdf-parse@1.1.1: importar la SUBRUTA lib evita el "debug-block" del index.js
      // que intenta leer un PDF de test y crashea al importarlo (módulo sin tipos).
      // @ts-expect-error: 'pdf-parse/lib/pdf-parse.js' no trae tipos.
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (
        b: Buffer,
      ) => Promise<{ text: string }>;
      const parsed = await pdfParse(buf);
      return parsed.text ?? '';
    } catch (err) {
      const msg = (err as Error).message;
      if (/Cannot find (module|package)/i.test(msg)) {
        this.logger.error(
          `ROTURA: pdf-parse no resuelve — el sensor está CIEGO. ${msg}`,
        );
      } else {
        this.logger.warn(`PDF ilegible (${msg}): ${url}`);
      }
      return '';
    }
  }

  /**
   * UPSERT de una nota. Dos matices que sostienen el gate de re-análisis:
   *  - `sellarAnalisis` marca `llm_analyzed_at=now()` SOLO cuando la extracción viene de una
   *    llamada real y correcta; si se reutilizó la caché, el sello viejo se conserva (así el TTL
   *    cuenta desde el análisis de verdad y no se renueva solo).
   *  - Si el LLM falló (`llmExtraction=null`) NO se pisa la extracción anterior con NULL. Antes sí,
   *    y eso borraba una extracción buena por un timeout puntual.
   */
  private async upsertNota(
    oposicionId: string,
    url: string,
    title: string,
    contentHash: string,
    signals: NotaSignals,
    llmExtraction: Record<string, unknown> | null,
    confianza: string | null,
    needsManual: boolean,
    sellarAnalisis: boolean,
  ): Promise<void> {
    const conservar = <T>(col: string): T =>
      sql.raw(`convocatoria_notas.${col}`) as unknown as T;

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
        llmAnalyzedAt: sellarAnalisis ? sql`now()` : null,
      })
      .onConflictDoUpdate({
        target: [convocatoriaNotas.oposicionId, convocatoriaNotas.url],
        set: {
          title,
          contentHash,
          signals,
          llmExtraction:
            llmExtraction ??
            conservar<Record<string, unknown>>('llm_extraction'),
          confianza: confianza ?? conservar<string>('confianza'),
          needsManual,
          llmAnalyzedAt: sellarAnalisis
            ? sql`now()`
            : conservar<string>('llm_analyzed_at'),
          lastSeen: sql`now()`,
        },
      });
  }
}
