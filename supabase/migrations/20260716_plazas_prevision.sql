-- Una previsión es una previsión: la BD debe saber decir si unas plazas son un HECHO o un pronóstico.
--
-- REGLA DE PRODUCTO (Manuel, 16/07/2026): «se activa siempre la vendible; si el examen pasó, se activa
-- la siguiente OEP y convocatoria si hay, y si no, una previsión» + «pero debe indicarse si es
-- previsión o son datos reales, las previsiones son previsiones».
--
-- EL HUECO: el esquema sabía marcar `exam_date_approximate` (la FECHA es aproximada) pero no tenía nada
-- para las PLAZAS. Y las plazas son lo que vende la landing. Al pivotar una oposición hacia delante
-- (rollover) hay tres situaciones y solo dos estaban representables:
--   1. OEP publicada        → plazas REALES, con su decreto y su cita.        ✔ representable
--   2. Convocatoria abierta → plazas REALES, con su resolución y su cita.     ✔ representable
--   3. Ni OEP ni convocatoria → si aun así ponemos una cifra (la del ciclo anterior «de referencia»,
--      una estimación de plazas), era INDISTINGUIBLE de un hecho publicado.   ✘ no representable
-- El caso 3 es exactamente el bug de Marta: un dato viejo o estimado presentado como el del ciclo
-- nuevo. `rollover_convocatoria()` ya nace vacío para no caer en él, pero si luego alguien rellena una
-- previsión, la BD no podía distinguirla de un hecho.
--
-- NOT NULL DEFAULT false: lo que hay hoy son datos tomados de documentos (o NULL). Afirmar es el caso
-- normal; declararse previsión es el acto deliberado. Y una previsión SIN documento es legítima —es lo
-- que la distingue—, por eso esto es una columna y no un CHECK contra el corpus: lo que el corpus
-- exige es que un dato REAL tenga su documento, y de eso se encarga el auditor.

BEGIN;

ALTER TABLE public.convocatorias
  ADD COLUMN IF NOT EXISTS plazas_prevision boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.convocatorias.plazas_prevision IS
  'true = las plazas de esta fila son una PREVISIÓN nuestra (ni OEP ni convocatoria publicadas todavía), no un hecho. La landing debe decirlo («plazas previstas»), nunca venderlas como confirmadas. false = son un hecho publicado y DEBEN tener su documento en convocatoria_documentos + su cita. Espejo de exam_date_approximate, que hace lo mismo con la fecha.';

-- `motivo` a propósito: una previsión sin explicar de dónde sale es una invención. Igual que un dato
-- real necesita su cita, una previsión necesita su razonamiento («OEP 2025 tuvo 1.450 y el hito del
-- IAAP prevé convocatoria en otoño»).
ALTER TABLE public.convocatorias
  ADD COLUMN IF NOT EXISTS plazas_prevision_motivo text;

COMMENT ON COLUMN public.convocatorias.plazas_prevision_motivo IS
  'De dónde sale la previsión (base de la estimación). Obligatorio si plazas_prevision=true: una previsión sin razonamiento es una invención.';

ALTER TABLE public.convocatorias
  ADD CONSTRAINT chk_plazas_prevision_motivo
  CHECK (NOT plazas_prevision OR coalesce(plazas_prevision_motivo, '') <> '');

COMMIT;
