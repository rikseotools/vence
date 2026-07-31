// backend/src/law-source-watch/law-source-watch.service.ts
//
// Vigilancia diaria por HASH de las fuentes legales que `check-boe-changes` NO cubre. [T-380]
//
// ── QUÉ HUECO TAPA ────────────────────────────────────────────────────────────────────────
//
// `check-boe-changes` excluye a propósito tres grupos: leyes sin `boe_url`, las de URL
// `doc.php` (documento puntual, sin texto consolidado ni fecha de «última actualización», su
// extractor siempre falla ahí) y las de `scope='eu'`. Medido el 31/07: **160 leyes reales
// sirviendo 4.893 preguntas sin ningún vigilante**, el TUE entre ellas (807 preguntas, 39
// oposiciones).
//
// Aquí no se parsea articulado ni se interpreta nada: se descarga, se normaliza, se hashea y
// se compara con la última captura. El hash dice QUE cambió; el juicio sobre QUÉ cambió lo
// pone una sesión de Claude con la frase «revisa los cambios de fuentes legales». Sin LLM a
// propósito (decisión de Manuel, 31/07): comparar dos textos es exactamente lo que hace un
// hash, y un cron que depende del saldo de un proveedor no es un cron.

import { Inject, Injectable, Logger } from '@nestjs/common';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, rmSync, statSync } from 'fs';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { ObservabilityService } from '../observability/observability.service';
import { clasificarVigilancia } from './source-watch.core';

interface LeyVigilada {
  law_id: string;
  short_name: string;
  source_url: string;
  hash_previo: string | null;
  preg: number;
}

export interface ResumenVigilancia {
  revisadas: number;
  lineaBase: number;
  sinCambio: number;
  cambiadas: number;
  inaccesibles: number;
  cambios: { shortName: string; url: string; preguntas: number }[];
}

@Injectable()
export class LawSourceWatchService {
  private readonly logger = new Logger(LawSourceWatchService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly observability: ObservabilityService,
  ) {}

  /**
   * Descarga el texto de una fuente. Mismo procedimiento que el CLI a propósito
   * (`lib/laws/fetchSourceText.cjs`): `curl` + detección por magic-bytes + `pdftotext -layout`.
   * Las dos mitades TIENEN que extraer igual o los hashes no comparan lo mismo — por eso el
   * Dockerfile del backend instala `poppler-utils` y `curl` en vez de usar una librería JS.
   */
  private descargar(url: string): string | null {
    const tmp = `/tmp/lawsrc_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    try {
      // execFileSync (no execSync): la URL viene de la BD y no debe pasar por una shell.
      execFileSync('curl', ['-skL', '--max-time', '45', '-A', 'Mozilla/5.0', url, '-o', `${tmp}.bin`], {
        stdio: 'ignore',
      });
      if (!existsSync(`${tmp}.bin`) || statSync(`${tmp}.bin`).size < 500) return null;
      const head = readFileSync(`${tmp}.bin`).slice(0, 5).toString('latin1');
      if (head.startsWith('%PDF')) {
        execFileSync('pdftotext', ['-layout', `${tmp}.bin`, `${tmp}.txt`], { stdio: 'ignore' });
        return existsSync(`${tmp}.txt`) ? readFileSync(`${tmp}.txt`, 'utf8') : null;
      }
      const html = readFileSync(`${tmp}.bin`, 'utf8');
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/[ \t]+/g, ' ');
    } catch {
      return null;
    } finally {
      try {
        rmSync(`${tmp}.bin`, { force: true });
        rmSync(`${tmp}.txt`, { force: true });
      } catch {
        /* limpieza best-effort */
      }
    }
  }

  async run(): Promise<ResumenVigilancia> {
    // La fuente puede estar en DOS registros según qué herramienta verificó la ley, y mirar
    // solo uno deja ciega a la otra mitad (el TUE quedó sin vigilar por eso). La línea base de
    // la vigilancia, en cambio, es SUYA: vive en el historial con `verified_by='vigilancia-hash'`,
    // porque `verified_source_hash` usa otro criterio (sha256 del texto CRUDO, truncado a 32) y
    // compararlos da «cambiada» siempre.
    const res = await this.db.execute(sql`
      SELECT l.id AS law_id, l.short_name,
             COALESCE(v.source_url, NULLIF(l.boe_url, '')) AS source_url,
             (SELECT h.source_hash FROM law_source_verification_history h
               WHERE h.law_id = l.id AND h.verified_by = 'vigilancia-hash'
               ORDER BY h.created_at DESC LIMIT 1) AS hash_previo,
             (SELECT count(*)::int FROM questions q
                JOIN articles a ON a.id = q.primary_article_id
               WHERE a.law_id = l.id AND q.is_active) AS preg
        FROM laws l
        LEFT JOIN law_source_verification v
               ON v.law_id = l.id AND v.source_url IS NOT NULL AND v.source_url <> ''
       WHERE l.is_active
         AND COALESCE(l.is_virtual, false) = false
         AND COALESCE(v.source_url, NULLIF(l.boe_url, '')) IS NOT NULL
         AND (v.source_url IS NOT NULL OR l.boe_url LIKE '%/doc.php%' OR l.scope = 'eu')
       ORDER BY preg DESC`);

    const leyes = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as LeyVigilada[];
    const out: ResumenVigilancia = {
      revisadas: leyes.length, lineaBase: 0, sinCambio: 0, cambiadas: 0, inaccesibles: 0, cambios: [],
    };

    for (const ley of leyes) {
      const texto = this.descargar(ley.source_url);
      const v = clasificarVigilancia({ hashPrevio: ley.hash_previo, textoDescargado: texto });

      if (v.estado === 'linea_base') out.lineaBase++;
      else if (v.estado === 'sin_cambio') out.sinCambio++;
      else if (v.estado === 'inaccesible') out.inaccesibles++;
      else {
        out.cambiadas++;
        out.cambios.push({ shortName: ley.short_name, url: ley.source_url, preguntas: ley.preg });
      }

      if (v.estado === 'cambiada' || v.estado === 'linea_base') {
        // Append-only. La referencia NO se pisa cuando cambia: la buena sigue siendo la última
        // capturada hasta que alguien revise y re-verifique. Pisarla aquí haría que el aviso se
        // auto-silenciara al día siguiente, que es la forma más silenciosa de perder una señal.
        await this.db
          .execute(sql`
            INSERT INTO law_source_verification_history (law_id, state, source_hash, verdict, verified_by, findings)
            VALUES (${ley.law_id}, ${v.estado === 'cambiada' ? 'changed' : 'baseline'}, ${v.hash},
                    ${v.estado === 'cambiada' ? 'source_changed' : 'baseline'}, 'vigilancia-hash',
                    ${JSON.stringify({ source_url: ley.source_url, motivo: v.motivo, preguntas: ley.preg })}::jsonb)`)
          .catch((e: Error) => this.logger.warn(`historial no escrito (${ley.short_name}): ${e.message}`));
      }

      await this.observability
        .emit({
          source: 'fargate',
          severity: v.estado === 'cambiada' ? 'error' : v.estado === 'inaccesible' ? 'warn' : 'info',
          eventType:
            v.estado === 'cambiada'
              ? 'law_source_changed'
              : v.estado === 'inaccesible'
                ? 'law_source_unreachable'
                : 'law_source_checked',
          endpoint: 'law-source-watch',
          metadata: {
            law_id: ley.law_id, short_name: ley.short_name, url: ley.source_url,
            preguntas: ley.preg, motivo: v.motivo,
          },
        })
        .catch(() => undefined);
    }

    this.logger.log(
      `Vigilancia de fuentes legales: ${out.revisadas} revisadas · ${out.sinCambio} sin cambio · ` +
        `${out.cambiadas} CAMBIADAS · ${out.inaccesibles} inaccesibles · ${out.lineaBase} línea base`,
    );
    return out;
  }
}
