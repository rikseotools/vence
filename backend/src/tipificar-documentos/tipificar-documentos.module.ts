import { Module } from '@nestjs/common';
import { TipificarDocumentosCron } from './tipificar-documentos.cron';
import { TipificarDocumentosService } from './tipificar-documentos.service';

/**
 * T-147 — reclasificador recurrente del hub de provenance (`convocatoria_documentos`).
 * Ver tipificar-documentos.service.ts para el porqué: es el "arreglar el productor" de la
 * ficha, resuelto SIN tocar `detect-notas-convocatoria` (que necesita seguir insertando
 * 'nota' para conservar su historial de monitoreo).
 */
@Module({
  providers: [TipificarDocumentosService, TipificarDocumentosCron],
  exports: [TipificarDocumentosService],
})
export class TipificarDocumentosModule {}
