// backend/src/tipificar-documentos/tipificar-documentos.service.ts
//
// T-147 — "arreglar el productor" SIN tocar el productor. `detect-notas-convocatoria` clona
// TODO documento como `tipo='nota'` A PROPÓSITO: las notas son el historial de monitoreo
// (append por content_hash) y tipar en el INSERT las haría deduplicar por doc_key, perdiendo
// ese historial (hallazgo de diseño de la ficha, 27/07/2026). Tocar el insert es arriesgado;
// no tocarlo y dejar que el 96% del hub se quede sin tipo para siempre tampoco es aceptable —
// es lo que hace que `landing_cifra_sin_respaldo` no pueda subir a nocturno.
//
// La solución: un SEGUNDO paso, recurrente, que reclasifica en el sitio las filas YA
// insertadas como 'nota' — exactamente el mismo criterio que
// `scripts/convocatoria/sim-tipo-documento.cjs --apply` (paso 1 de esta tarea, manual y
// on-demand), ahora automatizado para que el backlog no se rellene solo cada noche.
//
// Por qué UPDATE por `id`, no un upsert por doc_key: la fila YA EXISTE (viene de una SELECT
// concreta). No hay nada que insertar — solo cambiarle el `tipo` a la fila que ya tiene el
// texto. Eso evita la complejidad (y el riesgo) de decidir INSERT-vs-UPDATE contra el índice
// único parcial `ux_convocatoria_documentos_conv_dockey` (WHERE doc_key IS NOT NULL AND
// tipo <> 'nota'): mientras la fila siga siendo 'nota' es INVISIBLE para ese índice, así que el
// UPDATE que le cambia el tipo es la primera vez que "entra" — y si ya había OTRA fila tipada
// con el mismo doc_key en la misma convocatoria (un duplicado real, el caso que resolvió
// `merge-dup-docs.cjs` en el paso 1), Postgres lo rechaza con un unique_violation: se registra
// y se deja como estaba, en vez de fusionar a ciegas.

import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { clasificarTipoDocumento } from './tipo-documento-mirror';

// Documentos 'nota' revisados por ejecución. El backlog medido (05/08) es ~6.400 filas de
// texto corto (regex puro, sin red ni LLM) — un lote de 1000/noche lo despeja en ~1 semana y
// sigue sobrando margen para el goteo diario (~35-40 notas/día) de detect-notas-convocatoria.
const LOTE = 1000;

export interface TipificarDocumentosResult {
  revisados: number;
  promovidos: number;
  bloqueadosPorDuplicado: number;
  seQuedanEnNota: number;
  porTipo: Record<string, number>;
}

type DocumentoCandidato = {
  id: string;
  url: string;
  titulo: string | null;
  extracted_text: string | null;
};

@Injectable()
export class TipificarDocumentosService {
  private readonly logger = new Logger(TipificarDocumentosService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async run(): Promise<TipificarDocumentosResult> {
    const candidatos = await this.db.execute<DocumentoCandidato>(sql`
      SELECT id, url, titulo, extracted_text
        FROM convocatoria_documentos
       WHERE tipo = 'nota'
       ORDER BY created_at ASC
       LIMIT ${LOTE}
    `);

    const result: TipificarDocumentosResult = {
      revisados: candidatos.length,
      promovidos: 0,
      bloqueadosPorDuplicado: 0,
      seQuedanEnNota: 0,
      porTipo: {},
    };

    for (const doc of candidatos) {
      const clasificacion = clasificarTipoDocumento({
        titulo: doc.titulo,
        url: doc.url,
        texto: doc.extracted_text,
      });
      if (clasificacion.tipo === 'nota') {
        result.seQuedanEnNota += 1;
        continue;
      }

      try {
        const promovida = await this.db.execute<{ id: string }>(sql`
          UPDATE convocatoria_documentos
             SET tipo = ${clasificacion.tipo}, updated_at = now()
           WHERE id = ${doc.id} AND tipo = 'nota'
           RETURNING id
        `);
        if (promovida.length) {
          result.promovidos += 1;
          result.porTipo[clasificacion.tipo] =
            (result.porTipo[clasificacion.tipo] || 0) + 1;
        }
      } catch (err) {
        // 23505 = unique_violation: ya hay OTRA fila tipada con el mismo doc_key en esta
        // convocatoria (duplicado real, no un fallo). Se deja como 'nota' — la fusión la hace
        // `scripts/provenance/merge-dup-docs.cjs --notas`, que decide qué texto conservar.
        result.bloqueadosPorDuplicado += 1;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `No se tipa ${doc.id} como ${clasificacion.tipo} (probable duplicado de doc_key): ${msg}`,
        );
      }
    }

    this.logger.log(
      `Tipificación: ${result.revisados} revisados, ${result.promovidos} promovidos, ` +
        `${result.bloqueadosPorDuplicado} bloqueados por duplicado, ${result.seQuedanEnNota} sin señal`,
    );
    return result;
  }
}
