-- 20260728_topic_scope_history.sql
-- Auditoría append-only de `topic_scope` — quién cambió el TEMARIO, cuándo y por qué.
--
-- ## Por qué (medido 28/07/2026, T-222)
--
-- `topic_scope` decide **qué entra en cada tema**, es decir lo que el opositor estudia.
-- Tenía `created_at` y nada más: ni `updated_at`, ni `updated_by`, ni motivo. Sus dos
-- triggers no auditan (uno invalida la verificación, otro encola el PDF). Lo único
-- parecido, `topic_scope_verification_history`, registra quién lo **REVISÓ**, no quién lo
-- **CAMBIÓ**. Y el registro de herramientas cuenta **31 escritores** de `article_numbers`:
-- 31 puertas, cero rastro.
--
-- Caso que lo destapó: el Decreto 53/1989 del Tema 9 de `auxiliar_administrativo_sms`
-- tenía sus 32 artículos escopados cuando el epígrafe solo pide los Capítulos II y III
-- (arts. 5-25) — y **nadie podía saber quién los puso ni con qué criterio**. Una usuaria
-- (Luisa) lo cazó, se le dijo que no, y tenía razón exacta.
--
-- ## Diseño (mismo patrón que `question_lifecycle_history`, que ya resolvió esto)
--
-- Tabla append-only alimentada por TRIGGER, no por los escritores. Es deliberado: con 31
-- escritores, cualquier auditoría que dependa de que cada uno se acuerde de escribirla
-- nace incompleta. Por trigger, **lo que se captura no depende de nadie**: siempre queda
-- el ANTES, el DESPUÉS y el CUÁNDO.
--
-- `changed_by` / `change_reason` sí son opt-in (`SET LOCAL app.actor` / `app.change_reason`),
-- porque un trigger no puede adivinarlos. Que salgan NULL **no es un fallo, es la señal**:
-- dice que el cambio vino de un escritor que aún no se identifica, y eso se puede medir y
-- drenar. Preferimos un hueco VISIBLE a la ilusión de trazabilidad.
--
-- Aplicado en vivo a RDS el 28/07/2026; este fichero es el registro/repro.
-- Revertir: DROP TRIGGER tg_topic_scope_audit ON public.topic_scope; DROP TABLE public.topic_scope_history;

CREATE TABLE IF NOT EXISTS public.topic_scope_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id         uuid NOT NULL,
  law_id           uuid,
  operation        text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  -- Se guarda el ANTES y el DESPUÉS enteros: reconstruir el temario de una fecha es
  -- justo la pregunta que hoy no se puede responder.
  articles_before  text[],
  articles_after   text[],
  -- Cuántos artículos entran/salen. Redundante con lo de arriba a propósito: permite
  -- detectar de un vistazo un recorte masivo sin desplegar los arrays.
  delta_count      int GENERATED ALWAYS AS (
                     coalesce(array_length(articles_after, 1), 0)
                     - coalesce(array_length(articles_before, 1), 0)
                   ) STORED,
  changed_by       text,   -- SET LOCAL app.actor = '…'  (NULL = escritor no identificado)
  change_reason    text,   -- SET LOCAL app.change_reason = '…'
  -- `clock_timestamp()`, NO `now()`. `now()` es la hora de la TRANSACCIÓN: si un script
  -- cambia varios scopes en una sola transacción —que es lo normal en `verify:scope
  -- apply`— todas las filas salen con el MISMO instante y el historial deja de poder
  -- ordenarse justo cuando más falta hace. Lo cazó el test de integración (caso 3).
  changed_at       timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_topic_scope_history_topic
  ON public.topic_scope_history (topic_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_scope_history_changed_at
  ON public.topic_scope_history (changed_at DESC);

CREATE OR REPLACE FUNCTION public.fn_topic_scope_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_actor  text := nullif(current_setting('app.actor', true), '');
  v_reason text := nullif(current_setting('app.change_reason', true), '');
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.topic_scope_history
      (topic_id, law_id, operation, articles_before, articles_after, changed_by, change_reason)
    VALUES (OLD.topic_id, OLD.law_id, 'DELETE', OLD.article_numbers, NULL, v_actor, v_reason);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Solo se audita si CAMBIA el temario servido. Un UPDATE que toca `weight` u otra
    -- columna no ensucia el historial: si todo cambio quedara registrado, el ruido haría
    -- inservible la tabla justo cuando hace falta buscar el cambio que rompió algo.
    IF OLD.article_numbers IS NOT DISTINCT FROM NEW.article_numbers THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.topic_scope_history
      (topic_id, law_id, operation, articles_before, articles_after, changed_by, change_reason)
    VALUES (NEW.topic_id, NEW.law_id, 'UPDATE', OLD.article_numbers, NEW.article_numbers, v_actor, v_reason);
    RETURN NEW;
  END IF;

  INSERT INTO public.topic_scope_history
    (topic_id, law_id, operation, articles_before, articles_after, changed_by, change_reason)
  VALUES (NEW.topic_id, NEW.law_id, 'INSERT', NULL, NEW.article_numbers, v_actor, v_reason);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_topic_scope_audit ON public.topic_scope;
CREATE TRIGGER tg_topic_scope_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.topic_scope
  FOR EACH ROW EXECUTE FUNCTION public.fn_topic_scope_audit();

COMMENT ON TABLE public.topic_scope_history IS
  'Auditoría append-only de topic_scope (T-222, 28/07/2026). Alimentada por trigger, no por los 31 escritores. changed_by/change_reason en NULL = escritor no identificado, que es una señal medible, no un fallo.';
