-- Ciclo de convocatoria INMUTABLE + historial append-only.
--
-- PROBLEMA (16/07/2026): el procedimiento de rollover MUTA la fila viva en vez de abrir un ciclo nuevo,
-- y el de alta prescribía DELETE de la vigente. Con `convocatoria_hitos ON DELETE CASCADE`, ese DELETE se
-- llevaba el TIMELINE ENTERO en silencio — junto con la verificación y su historial "append-only".
-- Eso está VERIFICADO en la estructura (FKs + los dos manuales), y es lo que arregla esta migración.
--
-- EVIDENCIA (precisa, sin adornos):
--  1. El repropósito in-place está DOCUMENTADO como caso de referencia en `rollover-oposiciones.md` §4:
--     "Aux. Admin. del Estado — examen 23/05 pasado … estado_proceso='oep_aprobada' … exam_date=null".
--     A una fila cuyo examen YA se celebró se le borró la fecha de examen y se le retrocedió el estado:
--     el hecho central del ciclo 2025 (cuándo fue su examen) ya no está en ninguna parte. Eso es pérdida
--     de datos real, y el manual la ORDENA. Hoy la fila sigue así: año=2025, exam_date=null, oep_aprobada.
--  2. Las CASCADAS son un riesgo verificado en la estructura (FK + el DELETE que prescribía
--     `crear-nueva-oposicion.md`): se llevaban el timeline entero, la verificación y su historial.
--
-- LO QUE **NO** ESTÁ PROBADO (no inventar):
--  - Se afirmó que la fila de AGE "describe la OEP 2026 con RD 387/2026": FALSO como dato — la fila dice
--    `oep_decreto='RD 1052/2025'` (dic-2025), que probablemente ES el decreto de la OEP 2026 (se aprueban
--    en diciembre del año anterior). Aquel número salió de una nota de memoria, no de la BD.
--  - Que solo 2 de 2.490 oposiciones tengan >1 ciclo NO prueba destrucción masiva: la mayoría son
--    catalogadas sin proceso seguido.
--  - El historial arranca HOY: no alcanza al pasado. El alcance real del daño histórico es desconocido.
--
-- Descuadre REAL detectado de paso (para el sistema de VERIFICACIÓN, no para ciclos): la fila de AGE dice
-- `RD 1052/2025` y su hito dice "OEP 2026 aprobada" (may-2026). Uno de los dos miente; resolver con el BOE.
--
-- CAUSA RAÍZ: no es el modelo — el modelo YA es correcto (UNIQUE(oposicion_id, año), archived_at,
-- tg_convocatorias_single_current). Es el PROCEDIMIENTO: `rollover-oposiciones.md` §2.2 prescribe
-- literalmente "UPDATE convocatorias (fila is_current)" y "oep_decreto/plazas → de la PRÓXIMA OEP".
-- Quien machacó AGE estaba siguiendo el manual.
--
-- POR QUÉ IMPORTA MÁS QUE LA HISTORIA: la provenance sobre una fila mutable MUERE en el rollover. Si
-- convocatoria_documentos y sus citas cuelgan de una fila que se sobrescribe cada año, la cadena de
-- evidencia se destruye sola (la fila pasa a describir otro ciclo; la cita apunta a un documento que ya
-- no habla de ella). Sin ciclo inmutable, todo el sistema de verificación es decorado.
--
-- DOCTRINA (calcada al lifecycle de preguntas): historial append-only como fuente de verdad temporal +
-- única vía legítima de cambio de ciclo = función + guardarraíl físico sobre la identidad del ciclo.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Historial append-only: NADA se pierde, ni siquiera un DELETE.
--    SIN FK a convocatorias A PROPÓSITO: el historial debe sobrevivir al borrado de su fila.
CREATE TABLE IF NOT EXISTS public.convocatorias_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convocatoria_id  uuid NOT NULL,                       -- sin FK: sobrevive al DELETE
  oposicion_id     uuid,
  "año"            integer,
  operation        text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  changed_fields   text[],                              -- qué columnas cambiaron (solo UPDATE)
  old_data         jsonb,                               -- fila COMPLETA antes
  new_data         jsonb,                               -- fila COMPLETA después
  changed_by       text,
  changed_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conv_hist_conv ON public.convocatorias_history(convocatoria_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_hist_opo  ON public.convocatorias_history(oposicion_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_hist_op   ON public.convocatorias_history(operation, changed_at DESC);

COMMENT ON TABLE public.convocatorias_history IS
  'Append-only. Toda mutación de convocatorias queda aquí con la fila completa antes/después. Sin FK: sobrevive al DELETE.';

CREATE OR REPLACE FUNCTION public.tg_convocatorias_history()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_changed text[];
  v_actor   text := coalesce(nullif(current_setting('app.actor', true), ''), session_user);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(e.key ORDER BY e.key) INTO v_changed
      FROM jsonb_each(to_jsonb(NEW)) e
     WHERE e.value IS DISTINCT FROM (to_jsonb(OLD) -> e.key);
    -- ruido puro (solo el touch de updated_at) no se registra
    IF v_changed IS NULL OR v_changed = ARRAY['updated_at'] THEN
      RETURN NULL;
    END IF;
    INSERT INTO public.convocatorias_history
      (convocatoria_id, oposicion_id, "año", operation, changed_fields, old_data, new_data, changed_by)
    VALUES (NEW.id, NEW.oposicion_id, NEW."año", 'UPDATE', v_changed, to_jsonb(OLD), to_jsonb(NEW), v_actor);
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.convocatorias_history
      (convocatoria_id, oposicion_id, "año", operation, changed_fields, old_data, new_data, changed_by)
    VALUES (NEW.id, NEW.oposicion_id, NEW."año", 'INSERT', NULL, NULL, to_jsonb(NEW), v_actor);
  ELSE
    INSERT INTO public.convocatorias_history
      (convocatoria_id, oposicion_id, "año", operation, changed_fields, old_data, new_data, changed_by)
    VALUES (OLD.id, OLD.oposicion_id, OLD."año", 'DELETE', NULL, to_jsonb(OLD), NULL, v_actor);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tg_convocatorias_history ON public.convocatorias;
CREATE TRIGGER tg_convocatorias_history
  AFTER INSERT OR UPDATE OR DELETE ON public.convocatorias
  FOR EACH ROW EXECUTE FUNCTION public.tg_convocatorias_history();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. La IDENTIDAD del ciclo es inmutable: cambiar el `año` de una fila = destruir un ciclo.
--    Seguro: ningún writer del repo escribe `año` en UPDATE (verificado por grep 16/07); solo en INSERT.
CREATE OR REPLACE FUNCTION public.tg_convocatorias_anio_inmutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."año" IS DISTINCT FROM OLD."año" THEN
    RAISE EXCEPTION
      'El año de una convocatoria es INMUTABLE (intento %→% en %). Un ciclo nuevo se abre con rollover_convocatoria(), NUNCA mutando la fila viva.',
      OLD."año", NEW."año", OLD.id
      USING HINT = 'SELECT public.rollover_convocatoria(oposicion_id, nuevo_año, estado, actor);';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_convocatorias_anio_inmutable ON public.convocatorias;
CREATE TRIGGER tg_convocatorias_anio_inmutable
  BEFORE UPDATE OF "año" ON public.convocatorias
  FOR EACH ROW EXECUTE FUNCTION public.tg_convocatorias_anio_inmutable();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Única vía legítima para abrir ciclo: archiva el vigente e INSERTA uno nuevo.
--
--    NO copia hechos del proceso anterior (exam_date, plazas_*, oep_*, boe_*, inscription_*,
--    estado real): son verdades del ciclo VIEJO. Un ciclo nuevo nace VACÍO y se rellena desde
--    fuente verificada. Copiar las plazas del ciclo anterior "de referencia" es exactamente el bug
--    de Marta: un dato viejo presentado como el del ciclo nuevo.
--
--    Sí copia la CONFIGURACIÓN estable (temario/examen/requisitos), que no es un hecho del proceso.
CREATE OR REPLACE FUNCTION public.rollover_convocatoria(
  p_oposicion_id   uuid,
  p_nuevo_anio     integer,
  p_estado_proceso text DEFAULT 'sin_oep',
  p_changed_by     text DEFAULT 'rollover'
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_old convocatorias%ROWTYPE;
  v_new_id uuid;
BEGIN
  PERFORM set_config('app.actor', p_changed_by, true);

  SELECT * INTO v_old FROM public.convocatorias
   WHERE oposicion_id = p_oposicion_id AND is_current = true;

  IF FOUND AND v_old."año" = p_nuevo_anio THEN
    RAISE EXCEPTION 'La convocatoria vigente de esta oposición YA es del año % — no hay ciclo nuevo que abrir (¿querías un UPDATE normal?)', p_nuevo_anio;
  END IF;

  -- archivar el ciclo saliente (su verdad se conserva INTACTA: nada se sobrescribe)
  IF FOUND THEN
    UPDATE public.convocatorias
       SET is_current = false, archived_at = now()
     WHERE id = v_old.id;
  END IF;

  INSERT INTO public.convocatorias (
    oposicion_id, "año", is_current, estado_proceso,
    programa_url, examen_config, requisitos_especiales, sistema_selectivo
  ) VALUES (
    p_oposicion_id, p_nuevo_anio, true, p_estado_proceso,
    v_old.programa_url, v_old.examen_config, v_old.requisitos_especiales, v_old.sistema_selectivo
  ) RETURNING id INTO v_new_id;

  -- La landing lee oposiciones_ssot = COALESCE(c.campo, o.campo). Si el ciclo nuevo nace vacío y las
  -- columnas LEGACY de `oposiciones` conservan los datos del ciclo viejo, la vista cae al fallback y
  -- SIGUE MOSTRANDO el ciclo anterior (gotcha documentado en rollover-oposiciones.md §2).
  -- Abrir ciclo = dejar de afirmar los hechos del anterior.
  UPDATE public.oposiciones
     SET exam_date = NULL, exam_date_approximate = NULL
   WHERE id = p_oposicion_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.rollover_convocatoria IS
  'Única vía legítima para abrir un ciclo. Archiva el vigente (is_current=false, archived_at) e INSERTA uno nuevo VACÍO de hechos. Nunca muta la fila viva.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Detección de la deuda existente (no repara: los findings los trata un humano/Claude).
--    a) hitos cuyo título cita un año distinto al de su convocatoria → ciclos mezclados (55 medidos)
--    b) convocatoria vigente cuyo año es ANTERIOR al año que cita su propio hito de OEP → fila
--       repropósitada (patrón AGE: año=2025 describiendo la OEP 2026)
CREATE OR REPLACE VIEW public.convocatoria_ciclo_incoherente AS
SELECT
  o.slug,
  c.id                AS convocatoria_id,
  c."año"             AS anio_convocatoria,
  h.id                AS hito_id,
  h.titulo            AS hito_titulo,
  substring(h.titulo from '20[0-9][0-9]')::int AS anio_citado_en_hito,
  CASE
    WHEN substring(h.titulo from '20[0-9][0-9]')::int > c."año" THEN 'fila_repropositada'
    ELSE 'hito_de_ciclo_anterior'
  END                 AS clase
FROM public.convocatoria_hitos h
JOIN public.convocatorias c ON c.id = h.convocatoria_id
JOIN public.oposiciones  o ON o.id = c.oposicion_id
WHERE h.titulo ~ '20[0-9][0-9]'
  AND substring(h.titulo from '20[0-9][0-9]')::int IS DISTINCT FROM c."año";

COMMENT ON VIEW public.convocatoria_ciclo_incoherente IS
  'Deuda de ciclo: hitos atribuidos a una convocatoria de otro año. clase=fila_repropositada → la fila viva describe un ciclo posterior al suyo (patrón AGE).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CASCADAS ASESINAS: un solo `DELETE FROM convocatorias` destruía en silencio
--    (a) el timeline entero, (b) la verificación y (c) su historial "append-only".
--    Y `crear-nueva-oposicion.md:621` documenta que el flujo de alta `_*_fase23.cjs` hace
--    "INSERT (con DELETE previo de la vigente)" → la bomba estaba armada y documentada.

-- 5a. Un historial append-only que se borra en cascada NO es append-only. Defecto introducido por
--     20260716_convocatoria_verification.sql (mío, esta misma mañana): el FK llevaba ON DELETE CASCADE.
--     Se elimina el FK (como en convocatorias_history): la evidencia sobrevive a su sujeto.
ALTER TABLE public.convocatoria_verification_history
  DROP CONSTRAINT IF EXISTS convocatoria_verification_history_convocatoria_id_fkey;

COMMENT ON COLUMN public.convocatoria_verification_history.convocatoria_id IS
  'SIN FK a propósito: el historial debe sobrevivir al borrado de la convocatoria (un audit trail que cascadea no es un audit trail).';

-- 5b. Los hitos son DATOS DEL USUARIO (983 filas escritas a mano, el timeline que ve el opositor).
--     CASCADE los borraba sin traza. Pasa a RESTRICT: borrar una convocatoria con hitos ahora FALLA
--     de forma RUIDOSA. Un ciclo no se borra — se ARCHIVA (is_current=false, archived_at).
--     Si de verdad hay que borrar: borrar los hitos explícitamente primero (acto deliberado, no efecto colateral).
ALTER TABLE public.convocatoria_hitos
  DROP CONSTRAINT IF EXISTS convocatoria_hitos_convocatoria_id_fkey;
ALTER TABLE public.convocatoria_hitos
  ADD CONSTRAINT convocatoria_hitos_convocatoria_id_fkey
  FOREIGN KEY (convocatoria_id) REFERENCES public.convocatorias(id) ON DELETE RESTRICT;

-- 5c. `convocatoria_verification` (ESTADO) sí puede cascadear: sin su convocatoria no significa nada,
--     y su verdad temporal ya vive en el historial, que ahora sobrevive. Estado efímero, evidencia durable.

-- NOTA sobre archived_at (decisión Manuel 15/07, oeps-convocatorias-seguimiento.md §4e-ter):
--   `is_current=false` + `archived_at IS NULL` = ciclo VIVO pero no primario (dos procesos coexistiendo).
--   `is_current=false` + `archived_at` puesto  = ciclo TERMINADO.
--   rollover_convocatoria() archiva porque es el caso "examen pasado". Para coexistencia NO se usa
--   rollover: se INSERTA la segunda convocatoria y se decide cuál es `is_current`. (Hoy: 0 filas así.)

COMMIT;
