-- Migración 04
-- Contabilidad de tokens para medir el costo real por cliente.
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS tok_entrada        BIGINT DEFAULT 0;
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS tok_salida         BIGINT DEFAULT 0;
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS tok_cache_escritura BIGINT DEFAULT 0;
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS tok_cache_lectura   BIGINT DEFAULT 0;
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS llamadas            INTEGER DEFAULT 0;

-- Presupuesto opcional de tokens por día. NULL = sin tope de tokens.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tokens_dia_max BIGINT;
