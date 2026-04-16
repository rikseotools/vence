-- Elimina los 4 triggers de revalidación automática del cache de Next.js.
--
-- Motivo: cada UPDATE/INSERT en topics, oposicion_bloques, topic_scope u
-- oposiciones disparaba una llamada al webhook /api/admin/revalidate-temario,
-- que a su vez invalida el tag 'temario' (~1000 páginas pre-generadas).
-- En el último mes esto generó ~5M ISR Writes facturados por Vercel
-- ($20+/mes), de los cuales la mayoría provenía de:
--   - El cron diario check-seguimiento (41 UPDATEs/día en oposiciones, sin
--     que cambiara nada visible para el usuario).
--   - Scripts de import _tmp_*.cjs que iteran fila a fila (cada iteración
--     dispara un statement SQL = una invalidación completa).
--
-- A partir de ahora la invalidación es 100% manual via:
--   curl -X POST https://www.vence.es/api/admin/revalidate-temario
--   curl -X POST .../api/purge-cache (rutas ISR concretas)
--
-- Documentado en:
--   - docs/maintenance/cache-revalidation.md
--   - docs/maintenance/verificar-epigrafe-topic-scope.md
--
-- Mismo patrón ya aplicado a feedback (commit 166c1ddf) y disputes
-- (commit 3774509e), que fallaban en silencio por cold-start de Vercel.

DROP TRIGGER IF EXISTS trg_topics_revalidate ON topics;
DROP TRIGGER IF EXISTS trg_oposicion_bloques_revalidate ON oposicion_bloques;
DROP TRIGGER IF EXISTS trg_topic_scope_revalidate ON topic_scope;
DROP TRIGGER IF EXISTS trg_oposiciones_revalidate ON oposiciones;

-- Mantenemos la función por si en el futuro se quiere restablecer algún
-- trigger con WHEN clause (filtrado por columnas relevantes) o a través
-- de un patrón de debounce con tabla pending + pg_cron.
COMMENT ON FUNCTION public.notify_temario_change() IS
  'Llama al webhook /api/admin/revalidate-temario. NO hay triggers asociados '
  'actualmente — eliminados el 16/04/2026 por coste excesivo de ISR Writes. '
  'Ver docs/maintenance/cache-revalidation.md para flujo manual.';
