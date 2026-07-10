-- content_health_findings — snapshot de hallazgos de SALUD que escribe el sweep
-- nocturno (scripts/health-sweep.cjs, EventBridge → ECS de madrugada), y que LEEN
-- las tres superficies de "enterarse": el email-digest, el badge del nav de admin y
-- la pestaña de /admin/salud-sistema.
--
-- POR QUÉ una tabla y no calcular en vivo: el badge/panel se abren en horas de
-- usuarios; recalcular la auditoría (canary + coherencia sobre todo el catálogo) en
-- cada carga machacaría la BD. El sweep computa UNA vez de madrugada y lo guarda aquí;
-- todas las superficies leen este snapshot → cero carga extra en admin.
--
-- Separación explícita app vs contenido (decisión de producto):
--   category='app'      → FALLOS (usuario topa con error): HTTP≠200, 5xx, render-error,
--                         webhook roto, tema publicado sin preguntas. URGENTE.
--   category='content'  → CALIDAD (dato mal, app funciona): tarjetas de plazas/temas
--                         incoherentes, dual-write incompleto, cobertura fina. A REVISAR.
--
-- El sweep hace TRUNCATE + INSERT en cada run → la tabla es siempre el estado ACTUAL.

CREATE TABLE IF NOT EXISTS content_health_findings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text NOT NULL CHECK (category IN ('app', 'content')),
  severity      text NOT NULL CHECK (severity IN ('error', 'warn')),
  oposicion_slug text,
  kind          text NOT NULL,          -- http_down | empty_topic | render_error | http_5xx | webhook_unhealthy | plaza_card | temas_card | dual_write | low_coverage | no_hitos
  message       text NOT NULL,
  detail        jsonb,
  computed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_health_cat_sev ON content_health_findings (category, severity);

COMMENT ON TABLE content_health_findings IS 'Snapshot (truncate+insert por run) de hallazgos de salud app+contenido del sweep nocturno; leído por email-digest, badge de nav y panel /admin/salud-sistema. Runbook: docs/runbooks/salud-contenido.md';
