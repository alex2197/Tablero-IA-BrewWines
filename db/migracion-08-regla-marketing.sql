-- Migración 08
-- Interruptor opcional: si se define un umbral, las líneas con precio unitario
-- por debajo dejan de contar como ingreso y su monto se clasifica como
-- marketing. Por defecto está apagado (NULL): todas las ventas cuentan.
-- Se enciende con: npm run regla 190
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS umbral_marketing NUMERIC(14,2);
