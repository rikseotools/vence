-- CORRECCIÓN: marcar La Moncloa como `headless` NO la arregla. Se retira hasta que se pueda leer.
--
-- La migración anterior (20260716_generic_source_fetcher_type.sql) la marcó `headless` dando por
-- hecho que la Lambda resolvería su JavaScript. **Probado contra la Lambda real y es FALSO**:
--
--   fetch plano  → 2.428 chars · 0 fechas  (menús)
--   Lambda       → 4.204 chars · 0 fechas  (menús), render_time_ms ~1.500-2.300
--   y la Lambda IGNORA waitMs/waitUntil: da lo mismo pedirle 15s de espera.
--
-- Verificado también que NO es cosa de esa URL: /referencias/, /consejodeministros/ y una referencia
-- concreta (refc20260506) devuelven 1.2k-1.6k de menús. El sitio entero se pinta en cliente.
--
-- POR QUÉ SE RETIRA EN VEZ DE DEJARLA «headless»: una fuente que el fetcher no sabe leer NO es una
-- fuente, es un hueco con nombre — y dejarla activa fingiendo que vigila es peor que no tenerla,
-- porque el panel de salud la cuenta como cubierta. Llevaba meses así.
--
-- QUÉ HARÍA FALTA para recuperarla (merece la pena: Moncloa resume el Consejo de Ministros el MISMO
-- día que aprueba la OEP; el BOE la publica días después):
--   · que la Lambda espere a un selector real de la lista (hoy renderiza ~2s y devuelve), o
--   · encontrar el endpoint de datos de SharePoint que alimenta la lista, o
--   · una fuente equivalente que sí sirva HTML (el BOE cubre el hecho, con retraso).
--
-- El resto de fuentes NO se toca: las 5 devuelven contenido real (66k, 51k, 48k, 36k, 5.7k chars).

BEGIN;

UPDATE public.generic_source_checks
   SET is_active = false, updated_at = now()
 WHERE source_url LIKE '%lamoncloa.gob.es%';

COMMIT;
