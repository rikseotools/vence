-- Provenance de la FUENTE EXACTA del epígrafe oficial (Paso 1 / clonación del epígrafe).
--
-- POR QUÉ: la clonación del epígrafe oficial → BD (Sistema 2) ya registra estado/fecha/
-- hash/convocatoria por tema, pero NO la URL exacta del documento del que se sacó ni un
-- comentario. Para re-verificar (convocatoria nueva o drift) hay que ir DIRECTO a la fuente,
-- sin re-buscarla — crítico para el ~30% de boletines GVA/DOGV no parseables (SPA/PDF).
--
-- Additivo, bajo riesgo (dos columnas nullable). Se escribe desde
-- verify-epigrafe-literality.cjs record y se muestra en el drill-down "Epígrafe" de
-- /admin/contenido.
ALTER TABLE public.topic_epigrafe_verification
  ADD COLUMN IF NOT EXISTS source_url   text,
  ADD COLUMN IF NOT EXISTS source_notes text;

COMMENT ON COLUMN public.topic_epigrafe_verification.source_url IS
  'URL exacta de la fuente oficial donde se localizó/confirmó este epígrafe (DOGV/BOE PDF, anexo del temario). Para re-verificación directa.';
COMMENT ON COLUMN public.topic_epigrafe_verification.source_notes IS
  'Comentario libre sobre el sourcing del epígrafe (p.ej. boletín no parseable, confirmado verbatim, PDF primario pendiente).';
