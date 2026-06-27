-- Sensor `detect-notas-convocatoria` (27/06/2026)
-- Persiste cada nota informativa/aclaratoria leída del seguimiento_url de una
-- oposición, con las señales que el LLM extrae (versiones de software, fechas,
-- criterio…). Cola de triaje para Claude/admin: nada se pierde y nada se cierra
-- en silencio. Origen: incidente Aragón (nota IAAP fijaba Windows 11 y teníamos
-- preguntas en Windows 10).

CREATE TABLE IF NOT EXISTS public.convocatoria_notas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oposicion_id      uuid NOT NULL REFERENCES public.oposiciones(id) ON DELETE CASCADE,
  url               text NOT NULL,
  title             text,
  -- hash del texto de la nota: detecta cuándo una nota cambia de contenido.
  content_hash      text,
  -- señales por regex (versiones/fechas/criterio/material/penalización).
  signals           jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- extracción estructurada del LLM (software_versions, citas, confianza…).
  llm_extraction    jsonb,
  confianza         text,                      -- 'alta' | 'media' | 'baja'
  -- true cuando la página renderizó pero no se pudo extraer ningún documento
  -- (p.ej. SPA tras buscador): exige revisión manual, NO se da por "todo OK".
  needs_manual      boolean NOT NULL DEFAULT false,
  -- true cuando un humano ya revisó esta nota/versión y actuó.
  triada            boolean NOT NULL DEFAULT false,
  first_seen        timestamptz NOT NULL DEFAULT now(),
  last_seen         timestamptz NOT NULL DEFAULT now(),
  -- una fila por (oposición, documento): re-ejecuciones hacen UPSERT.
  CONSTRAINT convocatoria_notas_oposicion_url_key UNIQUE (oposicion_id, url)
);

-- Cola de triaje: notas con señal accionable sin triar.
CREATE INDEX IF NOT EXISTS idx_convocatoria_notas_triaje
  ON public.convocatoria_notas (triada, last_seen DESC)
  WHERE triada = false;

CREATE INDEX IF NOT EXISTS idx_convocatoria_notas_oposicion
  ON public.convocatoria_notas (oposicion_id);

COMMENT ON TABLE public.convocatoria_notas IS
  'Notas informativas/aclaratorias de cada oposición (sensor detect-notas-convocatoria). Cola de triaje de versiones de software y otras aclaraciones de examen.';
