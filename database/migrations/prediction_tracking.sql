-- =====================================================
-- SISTEMA DE TRACKING DE PREDICCIONES
-- Para medir precisión de cada método de proyección
-- Creado: 2026-01-12
-- =====================================================

-- 1. TABLA: Predicciones guardadas diariamente
CREATE TABLE IF NOT EXISTS prediction_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Fecha de la predicción
  prediction_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Método de predicción
  method_name TEXT NOT NULL CHECK (method_name IN ('by_registrations', 'by_active_users', 'by_historic', 'combined')),

  -- Valores predichos (ventas por mes)
  predicted_sales_per_month NUMERIC(10, 2) NOT NULL,
  predicted_revenue_per_month NUMERIC(10, 2) NOT NULL,

  -- Inputs usados para la predicción (para análisis)
  prediction_inputs JSONB DEFAULT '{}',

  -- Valores reales (se llenan después de 30 días)
  actual_sales INTEGER,
  actual_revenue NUMERIC(10, 2),

  -- Precisión calculada
  error_percent NUMERIC(6, 2),  -- Ej: -17.5 significa 17.5% menos de lo predicho
  absolute_error NUMERIC(6, 2), -- Error absoluto en %

  -- Estado de verificación
  verified_at TIMESTAMPTZ,

  -- Metadatos
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Evitar duplicados del mismo método en el mismo día
  UNIQUE (prediction_date, method_name)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_prediction_tracking_date ON prediction_tracking(prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_tracking_method ON prediction_tracking(method_name);
CREATE INDEX IF NOT EXISTS idx_prediction_tracking_verified ON prediction_tracking(verified_at) WHERE verified_at IS NOT NULL;

-- 2. FUNCIÓN: Guardar predicciones del día
CREATE OR REPLACE FUNCTION save_daily_predictions(
  p_predictions JSONB  -- Array de {method_name, predicted_sales, predicted_revenue, inputs}
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_prediction JSONB;
BEGIN
  FOR v_prediction IN SELECT * FROM jsonb_array_elements(p_predictions)
  LOOP
    INSERT INTO prediction_tracking (
      prediction_date,
      method_name,
      predicted_sales_per_month,
      predicted_revenue_per_month,
      prediction_inputs
    ) VALUES (
      CURRENT_DATE,
      v_prediction->>'method_name',
      (v_prediction->>'predicted_sales')::NUMERIC,
      (v_prediction->>'predicted_revenue')::NUMERIC,
      v_prediction->'inputs'
    )
    ON CONFLICT (prediction_date, method_name)
    DO UPDATE SET
      predicted_sales_per_month = EXCLUDED.predicted_sales_per_month,
      predicted_revenue_per_month = EXCLUDED.predicted_revenue_per_month,
      prediction_inputs = EXCLUDED.prediction_inputs,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 3. FUNCIÓN: Verificar predicciones pasadas con datos reales
-- Se ejecuta para predicciones de hace 30 días
CREATE OR REPLACE FUNCTION verify_past_predictions()
RETURNS TABLE (
  prediction_id UUID,
  method_name TEXT,
  predicted NUMERIC,
  actual INTEGER,
  error_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_date DATE := CURRENT_DATE - INTERVAL '30 days';
  v_actual_sales INTEGER;
  v_actual_revenue NUMERIC;
BEGIN
  -- Calcular ventas reales del último mes (desde la fecha objetivo hasta hoy)
  SELECT
    COUNT(DISTINCT user_id),
    COALESCE(SUM((event_data->>'amount')::NUMERIC), 0)
  INTO v_actual_sales, v_actual_revenue
  FROM conversion_events
  WHERE event_type = 'payment_completed'
    AND created_at >= v_target_date
    AND created_at < CURRENT_DATE;

  -- Actualizar predicciones de hace 30 días con valores reales
  UPDATE prediction_tracking pt
  SET
    actual_sales = v_actual_sales,
    actual_revenue = v_actual_revenue,
    error_percent = CASE
      WHEN predicted_sales_per_month > 0
      THEN ROUND(((v_actual_sales - predicted_sales_per_month) / predicted_sales_per_month) * 100, 2)
      ELSE NULL
    END,
    absolute_error = CASE
      WHEN predicted_sales_per_month > 0
      THEN ROUND(ABS((v_actual_sales - predicted_sales_per_month) / predicted_sales_per_month) * 100, 2)
      ELSE NULL
    END,
    verified_at = now(),
    updated_at = now()
  WHERE prediction_date = v_target_date
    AND verified_at IS NULL;

  -- Retornar predicciones verificadas
  RETURN QUERY
  SELECT
    pt.id,
    pt.method_name,
    pt.predicted_sales_per_month,
    pt.actual_sales,
    pt.error_percent
  FROM prediction_tracking pt
  WHERE pt.prediction_date = v_target_date;
END;
$$;

-- 4. VISTA: Precisión histórica por método
CREATE OR REPLACE VIEW prediction_accuracy_by_method AS
SELECT
  method_name,
  COUNT(*) AS total_predictions,
  COUNT(*) FILTER (WHERE verified_at IS NOT NULL) AS verified_predictions,

  -- Error promedio (puede ser negativo = subestimó, positivo = sobreestimó)
  ROUND(AVG(error_percent) FILTER (WHERE verified_at IS NOT NULL), 2) AS avg_error_percent,

  -- Error absoluto promedio (precisión real)
  ROUND(AVG(absolute_error) FILTER (WHERE verified_at IS NOT NULL), 2) AS avg_absolute_error,

  -- Desviación estándar del error (consistencia)
  ROUND(STDDEV(error_percent) FILTER (WHERE verified_at IS NOT NULL), 2) AS error_stddev,

  -- Mejor y peor predicción
  MIN(absolute_error) FILTER (WHERE verified_at IS NOT NULL) AS best_prediction_error,
  MAX(absolute_error) FILTER (WHERE verified_at IS NOT NULL) AS worst_prediction_error,

  -- Predicciones dentro del ±20% de error
  COUNT(*) FILTER (WHERE verified_at IS NOT NULL AND absolute_error <= 20) AS predictions_within_20pct,

  -- Última predicción verificada
  MAX(prediction_date) FILTER (WHERE verified_at IS NOT NULL) AS last_verified_date

FROM prediction_tracking
GROUP BY method_name
ORDER BY avg_absolute_error ASC NULLS LAST;

-- 5. VISTA: Historial de predicciones vs realidad
CREATE OR REPLACE VIEW prediction_history AS
SELECT
  prediction_date,
  method_name,
  predicted_sales_per_month,
  predicted_revenue_per_month,
  actual_sales,
  actual_revenue,
  error_percent,
  absolute_error,
  CASE
    WHEN absolute_error <= 10 THEN 'excelente'
    WHEN absolute_error <= 20 THEN 'buena'
    WHEN absolute_error <= 50 THEN 'regular'
    ELSE 'mala'
  END AS prediction_quality,
  verified_at,
  prediction_inputs
FROM prediction_tracking
WHERE verified_at IS NOT NULL
ORDER BY prediction_date DESC, method_name;

-- 6. PERMISOS
GRANT SELECT ON prediction_tracking TO authenticated;
GRANT SELECT ON prediction_accuracy_by_method TO authenticated;
GRANT SELECT ON prediction_history TO authenticated;
GRANT EXECUTE ON FUNCTION save_daily_predictions(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_past_predictions() TO authenticated;

-- Comentarios
COMMENT ON TABLE prediction_tracking IS 'Tracking de predicciones de ventas para medir precisión de cada método';
COMMENT ON VIEW prediction_accuracy_by_method IS 'Precisión histórica agregada por método de predicción';
COMMENT ON VIEW prediction_history IS 'Historial detallado de predicciones vs resultados reales';
