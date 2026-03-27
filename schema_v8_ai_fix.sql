-- =============================================================================
-- V8 FIX: Agrega columnas de IA faltantes + política UPDATE para service_role
-- Ejecutar completo en Supabase SQL Editor
-- =============================================================================

-- 1. Agregar columnas de análisis IA que faltaban en v7
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS price_segment     TEXT,
  ADD COLUMN IF NOT EXISTS aesthetic_profile TEXT,
  ADD COLUMN IF NOT EXISTS ai_profile        JSONB,
  ADD COLUMN IF NOT EXISTS score_textil_fit  FLOAT,
  ADD COLUMN IF NOT EXISTS score_total       FLOAT;

-- 2. Política RLS: Permitir UPDATE a service_role (para que el analyzer pueda escribir)
--    El analyzer usa SUPABASE_SERVICE_ROLE_KEY, que tiene rol 'service_role'
DROP POLICY IF EXISTS "service_role puede actualizar negocios" ON businesses;
CREATE POLICY "service_role puede actualizar negocios"
  ON businesses FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- También necesita leer y actualizar design_signals
DROP POLICY IF EXISTS "service_role puede insertar design_signals" ON design_signals;
CREATE POLICY "service_role puede insertar design_signals"
  ON design_signals FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3. (Opcional) Verificar que las columnas quedaron bien
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'businesses'
ORDER BY ordinal_position;
