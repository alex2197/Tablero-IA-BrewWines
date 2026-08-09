-- Migración 05
-- Existencias por almacén. Antes se usaba la columna LUGAR del Excel, que en
-- realidad es la posición en el rack (A06-01), no el almacén.
CREATE TABLE IF NOT EXISTS inventario_almacen (
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  producto_clave TEXT NOT NULL,
  almacen        TEXT NOT NULL,
  existencias    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, producto_clave, almacen)
);

CREATE INDEX IF NOT EXISTS idx_inv_alm ON inventario_almacen(tenant_id, almacen);
