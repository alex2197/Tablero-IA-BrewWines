-- Migración 03
-- Control de acceso por cliente: prueba con vencimiento, activo o suspendido.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS vence DATE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS contacto TEXT;

UPDATE tenants SET estado = 'activo' WHERE estado IS NULL;
