-- 20260617_detection_sources_universidad.sql
--
-- Añade el tipo de fuente 'universidad' al sistema de detección de OEPs.
--
-- Motivo (17/06/2026): la convocatoria de la Escala Administrativa (C1) de la
-- Universidad de León se publicó en el BOCYL el 17/06/2026 y NO fue detectada
-- por nuestros feeds. Causa raíz: `detection_sources` solo contemplaba los tipos
-- 'estado','ccaa','ayuntamiento','diputacion' y la única fuente de universidades
-- era genérica (buscador de administracion.gob.es), que no capta publicaciones
-- en boletines autonómicos. Las ~50 universidades públicas, cada una con sus
-- propias convocatorias de PAS, eran un punto ciego escalable.
--
-- Fix estructural: nuevo tipo 'universidad' + fuentes por universidad de catálogo.

ALTER TABLE detection_sources DROP CONSTRAINT detection_sources_source_type_check;
ALTER TABLE detection_sources ADD CONSTRAINT detection_sources_source_type_check
  CHECK (source_type IN ('estado', 'ccaa', 'ayuntamiento', 'diputacion', 'universidad'));
