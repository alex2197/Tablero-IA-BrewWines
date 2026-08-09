-- Migración 06
-- Catálogo de almacenes. El código (ALM-01) vive en los datos; el nombre
-- legible viene de la segunda fila de encabezados del Excel de inventario.
CREATE TABLE IF NOT EXISTS almacenes (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  codigo    TEXT NOT NULL,
  nombre    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, codigo)
);
