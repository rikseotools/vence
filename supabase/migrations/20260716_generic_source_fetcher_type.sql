-- Una fuente que el fetcher no sabe leer NO es una fuente: es un hueco con nombre.
--
-- HALLAZGO (16/07/2026, arreglando el sensor `generic_source`, mudo desde el 1 de junio): de sus 6
-- fuentes, 5 devuelven contenido real a fetch plano (66k, 51k, 48k, 36k, 5.7k chars) pero **La Moncloa
-- devuelve 2.428 caracteres de MENÚS**: su página de resúmenes del Consejo de Ministros es SharePoint
-- y carga la lista por JavaScript. El LLM nunca ve un solo resumen → jamás puede emitir una señal.
-- Llevaba meses en la lista fingiendo que vigilaba.
--
-- POR QUÉ NO SE RETIRA (que es la regla por defecto con las fuentes rotas, ver salud-radar.md): La
-- Moncloa NO es redundante con el boletín, es MÁS RÁPIDA. El Consejo de Ministros aprueba la OEP y
-- Moncloa la resume el MISMO día; el BOE la publica días después. Para un radar, ese adelanto es justo
-- el valor. Aquí sí compensa el headless.
--
-- `fetchPageHtml(url, timeout, fetcherType)` ya soporta 'headless' (Lambda vence-backend-headless-
-- fetcher, la misma que usa el resto del radar): faltaba poder decirlo POR FUENTE. Mismo campo y
-- mismos valores que `oposiciones.fetcher_type`, para no inventar un vocabulario nuevo.

BEGIN;

ALTER TABLE public.generic_source_checks
  ADD COLUMN IF NOT EXISTS fetcher_type text NOT NULL DEFAULT 'http'
  CHECK (fetcher_type IN ('http', 'headless'));

COMMENT ON COLUMN public.generic_source_checks.fetcher_type IS
  'Cómo leer esta fuente: http (fetch plano, el 90%) o headless (Lambda) si la página monta su contenido con JavaScript. Si una fuente solo devuelve el chrome del portal, el LLM no ve nada y NUNCA emitirá señal: o se marca headless, o se retira — pero no se deja fingiendo que vigila.';

-- La Moncloa: SharePoint, la lista de resúmenes la pinta JS. Verificado 16/07: 2.428 chars de menús.
UPDATE public.generic_source_checks
   SET fetcher_type = 'headless', updated_at = now()
 WHERE source_url LIKE '%lamoncloa.gob.es%';

COMMIT;
