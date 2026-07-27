-- 20260727_explanation_data_fix_sobrecarga_hash.sql
--
-- ARREGLA un defecto introducido HOY por `20260727_explanation_data_estructurada.sql`.
--
-- ## Qué pasó
--
-- Esa migración añadió un parámetro a `compute_shuffle_safety_hash` con `CREATE OR REPLACE`. Pero
-- en PostgreSQL **cambiar la lista de parámetros NO reemplaza la función: crea una SOBRECARGA**.
-- Quedaron dos:
--   · `compute_shuffle_safety_hash(text,text,text,text,text,text,text)`            ← la vieja
--   · `compute_shuffle_safety_hash(text,text,text,text,text,text,text,text=NULL)`  ← la nueva
--
-- Y con ambas vivas, **toda llamada de 7 argumentos pasa a ser ambigua**:
--   ERROR 42725: function public.compute_shuffle_safety_hash(...) is not unique
--
-- Eso dejó ROTOS a los dos consumidores que llamaban con 7: `scripts/sweep-shuffle-safety-drift.ts`
-- —que alimenta el kind `shuffle_safe_regressed` del **barrido nocturno de salud**— y
-- `scripts/backfill-shuffle-safety.ts`. El trigger y `record_shuffle_safety` no se enteraron
-- porque la migración los actualizó a 8 argumentos.
--
-- ## Por qué se coló
--
-- La migración se verificó comprobando lo que podía romper de forma escandalosa —que los 134.646
-- hashes existentes siguieran cuadrando, que es lo que habría degradado el banco entero a
-- `stale`— y esa comprobación pasó en verde porque el trigger sí usaba la firma nueva. Nadie
-- llamó a la función con 7 argumentos hasta ir a comprobar otra cosa. Lección: al cambiar la
-- FIRMA de una función SQL, listar sus llamadores y ejecutarlos, no solo comprobar el efecto.
--
-- ## El arreglo
--
-- Se elimina la sobrecarga vieja. La nueva la cubre: su octavo parámetro tiene DEFAULT NULL, así
-- que una llamada de 7 sigue compilando — y produce **exactamente el mismo hash que antes** para
-- las filas sin explicación estructurada (el campo solo entra en el hash cuando NO es NULL).
-- Aun así, los dos scripts pasan a llamar con los 8: para una fila YA transcrita, omitir el
-- octavo daría un hash distinto del que calcula el trigger y la marcaría `stale` sin motivo.

DROP FUNCTION IF EXISTS public.compute_shuffle_safety_hash(text, text, text, text, text, text, text);

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_proc WHERE proname = 'compute_shuffle_safety_hash') <> 1 THEN
    RAISE EXCEPTION 'debe quedar EXACTAMENTE una compute_shuffle_safety_hash; hay %',
      (SELECT count(*) FROM pg_proc WHERE proname = 'compute_shuffle_safety_hash');
  END IF;
END $$;
