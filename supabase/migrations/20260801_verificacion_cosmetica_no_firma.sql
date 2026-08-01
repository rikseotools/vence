-- 20260801_verificacion_cosmetica_no_firma.sql — quien REESCRIBE no firma que ha VERIFICADO [T-465].
--
-- ## Qué impide
--
-- Que una fila de `ai_verification_results` cuyo propósito declarado es COSMÉTICO (reescribir la
-- explicación, reformatearla, re-vincular) escriba `article_ok=true` o `answer_ok=true`.
--
-- ## Por qué en la BD y no en el código del pase
--
-- Porque los pases son muchos, los escribe quien haga falta en cada momento, y esto ya ocurrió sin
-- que nadie lo notara durante meses. Un guardarraíl que vive en el script del pase solo protege a
-- ese script; el siguiente lote lo vuelve a hacer. El punto de escritura es la tabla, y ahí llega
-- todo el mundo.
--
-- ## El caso que lo motiva (01/08/2026)
--
-- Un usuario premium impugnó ocho preguntas cuyo contenido no estaba en el artículo del temario. Las
-- siete de un mismo lote traían esta firma, del mismo día y con confianza ALTA:
--
--     «Revisión masiva uncited: explicación reescrita con formato didáctico, blockquote y análisis
--      por opción.»   ·   article_ok=true · answer_ok=true · explanation_ok=true
--
-- Ese pase no verificaba: reescribía explicaciones sin cita. Pero al firmar los flags de fondo dejó
-- las preguntas marcadas como comprobadas. Y como se le pidió añadir un blockquote y el artículo no
-- contenía la respuesta, citó el artículo real diciendo algo que no responde a la pregunta — o sea,
-- le puso apariencia de fundamento legal a una pregunta inestudiable. No solo no detectó el defecto:
-- lo camufló, y por eso ningún detector posterior lo vio.
--
-- Medido antes de escribir esto: 4.159 firmas cosméticas afirmando fondo y 1.713 preguntas activas
-- cuya ÚNICA verificación es un pase así.
--
-- ## Qué hace exactamente
--
-- NO rechaza la fila: eso tumbaría lotes en marcha por un error de etiquetado y empujaría a quitar
-- la palabra «reescrita» del texto para esquivarlo. Lo que hace es **poner esos dos flags a NULL**,
-- que es la verdad — `NULL` significa «no lo he mirado», y es distinto de `false` («lo he mirado y
-- está mal»). El pase sigue haciendo su trabajo y la explicación se reescribe igual; lo único que
-- pierde es la capacidad de afirmar algo que no ha comprobado.
--
-- `explanation_ok` NO se toca: quien reescribe la explicación SÍ está en posición de decir si quedó
-- bien. Es justo lo que acaba de hacer.
--
-- Deja traza en `observable_events` para poder medir cuántos pases lo intentan.

CREATE OR REPLACE FUNCTION public.tg_verificacion_cosmetica_no_firma()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cosmetico boolean;
BEGIN
  v_cosmetico := COALESCE(NEW.explanation, '') ~* '(revisi[oó]n masiva|explicaci[oó]n reescrita|reescrita al formato|fase2 relink|v2\.1 relink|needs_review v2\.1|formato did[aá]ctico)';

  IF v_cosmetico AND (NEW.article_ok IS TRUE OR NEW.answer_ok IS TRUE) THEN
    BEGIN
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'db:ai_verification_results', 'warn',
              'verificacion_cosmetica_firmaba_fondo',
              jsonb_build_object(
                'questionId', NEW.question_id,
                'aiModel', NEW.ai_model,
                'articleOk', NEW.article_ok,
                'answerOk', NEW.answer_ok,
                'proposito', left(COALESCE(NEW.explanation, ''), 120)),
              NOW());
    EXCEPTION WHEN OTHERS THEN
      -- La traza no puede tumbar la escritura: fail-open, igual que el resto de telemetría.
      NULL;
    END;

    NEW.article_ok := NULL;
    NEW.answer_ok  := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_verificacion_cosmetica_no_firma ON public.ai_verification_results;

CREATE TRIGGER tg_verificacion_cosmetica_no_firma
  BEFORE INSERT OR UPDATE ON public.ai_verification_results
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_verificacion_cosmetica_no_firma();

COMMENT ON FUNCTION public.tg_verificacion_cosmetica_no_firma() IS
  'T-465: un pase con propósito cosmético (reescribir/reformatear/re-vincular) no puede afirmar '
  'article_ok/answer_ok. Se ponen a NULL («no lo he mirado») y se emite verificacion_cosmetica_firmaba_fondo.';
