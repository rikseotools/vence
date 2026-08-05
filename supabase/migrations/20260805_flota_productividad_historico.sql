-- T-486 — la serie de productividad de la flota, para poder ver si mejora o empeora.
--
-- ── POR QUÉ UNA TABLA Y NO `observable_events`, QUE YA LA RECIBE ────────────────────────────
-- El parte ya emite `flota_productividad` al bus, y lo seguirá haciendo: eso es para ALERTAR. Pero
-- el bus no sirve como HISTORIA, y se comprobó antes de decidirlo: **10,8 millones de filas y solo
-- 32 días** (04/07 → 05/08), o sea que se poda. Una serie que se borra sola al mes no puede
-- responder a «¿vamos mejor que hace tres semanas?», que es justo la pregunta.
--
-- Y es barata: una fila por medida, unas pocas al día. No es un silo — se alimenta del MISMO
-- cálculo (`lib/sessions/productividad.cjs`), no de otro contador paralelo.
--
-- ── LO QUE SE GUARDA, Y POR QUÉ CADA COSA ───────────────────────────────────────────────────
-- No se guarda el veredicto y ya: se guardan **las entradas del cálculo**. Si mañana se recalibran
-- los umbrales, la historia se puede volver a juzgar con el criterio nuevo — con solo el color
-- guardado, no. Es la misma razón por la que las adjudicaciones guardan su evidencia.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.flota_productividad_historico (
  id                bigserial PRIMARY KEY,
  medido_at         timestamptz NOT NULL DEFAULT now(),
  -- La ventana sobre la que se midió el ritmo: sin ella dos filas no son comparables.
  horas_ventana     numeric NOT NULL,
  dias_cerradas     integer NOT NULL,

  -- El tamaño de lo que queda
  pendientes        integer NOT NULL,
  criticas          integer,
  trabajadores      integer NOT NULL,

  -- Lo producido y lo revisado
  cerradas          integer NOT NULL,
  cerradas_flota    integer NOT NULL DEFAULT 0,
  entregas_ventana  integer NOT NULL DEFAULT 0,
  entregas_en_cola  integer NOT NULL DEFAULT 0,
  espera_mediana_h  numeric,

  -- El ritmo y lo que sale de él
  entregas_por_hora numeric,
  cerradas_por_hora numeric,
  -- 'produccion' | 'revision' — cuál de los dos manda el plazo. Es EL dato accionable: si manda la
  -- revisión, añadir trabajadores no acorta nada.
  manda             text CHECK (manda IN ('produccion', 'revision')),
  horas_estimadas   integer,

  veredicto         text NOT NULL CHECK (veredicto IN ('verde', 'ambar', 'rojo')),
  razon             text
);

COMMENT ON TABLE public.flota_productividad_historico IS
  'T-486 — una fila por medida de `npm run flota -- productividad`. Guarda las ENTRADAS del cálculo, no solo el veredicto, para poder re-juzgar la historia si se recalibran los umbrales.';

-- Se consulta siempre «las últimas N»: un índice descendente por fecha es todo lo que hace falta.
CREATE INDEX IF NOT EXISTS idx_flota_prod_hist_fecha
  ON public.flota_productividad_historico (medido_at DESC);
