-- Migración 02
-- Límite diario de operaciones con IA, configurable por cliente.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS limite_ia_diario INTEGER DEFAULT 50;

CREATE TABLE IF NOT EXISTS uso_ia (
  tenant_id  TEXT NOT NULL REFERENCES tenants(id),
  fecha      DATE NOT NULL,
  consultas  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_uso_ia_fecha ON uso_ia(tenant_id, fecha);
