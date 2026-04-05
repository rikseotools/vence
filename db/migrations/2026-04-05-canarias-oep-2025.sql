-- Migración: Canarias OEP 2025 (BOC-A-2026-057-948)
-- Fecha: 2026-04-05
-- Motivo: Feedback de Helena (usuaria). Nueva convocatoria OEP 2025 publicada el 24/03/2026,
--   296 plazas (278 libre + 18 discapacidad), inscripción hasta 23/04/2026.
--   Siguiendo patrón Madrid: archivar OEP antigua con slug -YYYY y crear nueva con slug canónico.

-- 1) Archivar OEP 2024 (slug antiguo + flags)
UPDATE oposiciones
SET
  slug = 'auxiliar-administrativo-canarias-2024',
  is_active = false,
  is_convocatoria_activa = false,
  estado_proceso = 'resultados'
WHERE id = '9f552852-47a7-4740-bf22-39fd693b31ab';

-- 2) Nueva fila OEP 2025 con slug canónico
-- (insert ya ejecutado; id = 9a444f74-64b6-45c9-a2b7-8a17ae0aeda7)
-- Datos clave:
--   slug: auxiliar-administrativo-canarias
--   convocatoria_numero: BOC-A-2026-057-948
--   plazas_libres: 278, plazas_discapacidad: 18 (total 296)
--   inscription_deadline: 2026-04-23
--   estado_proceso: inscripcion_abierta
--   programa_url: https://www.gobiernodecanarias.org/boc/2026/057/948.html
--   seguimiento_url: https://www.gobiernodecanarias.org/administracionespublicas/funcionpublica/acceso/convocatorias-en-curso/

-- 3) Copiar y actualizar landing data de la fila antigua a la nueva
--   (landing_features, landing_requirements, landing_faqs, landing_estadisticas, examen_config)
--   landing_description actualizada para reflejar OEP 2025 (296 plazas, inscripción hasta 23/04/2026)
--   Arreglado formato double-encoded JSON (stored as string) → JSONB nativo en features y requirements.

-- 4) Hitos OEP 2025 creados (7 hitos):
--   [1] completed | 2026-03-24 | Convocatoria publicada en BOC
--   [2] completed | 2026-03-25 | Apertura plazo de inscripción
--   [3] current   | 2026-04-23 | Cierre plazo de inscripción
--   [4] upcoming  | 2026-06-15 | Publicación listas provisionales
--   [5] upcoming  | 2026-07-31 | Publicación listas definitivas
--   [6] upcoming  | 2026-11-30 | Examen
--   [7] upcoming  | 2027-03-31 | Publicación resultados

-- 5) SEO: redirects 301 en next.config.mjs para preservar equity de la URL antigua:
--   /auxiliar-administrativo-canarias-2024 → /auxiliar-administrativo-canarias (y :path*)
