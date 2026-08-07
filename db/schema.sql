-- =====================================================================
-- Esquema base. Multi-tenant desde el día uno: cada fila lleva tenant_id.
-- =====================================================================
DROP TABLE IF EXISTS ventas, cuentas_por_cobrar, inventario,
                     productos, clientes, vendedores, tenants CASCADE;

CREATE TABLE tenants (
  id     TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  giro   TEXT,
  creado TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE vendedores (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  clave     INTEGER NOT NULL,
  nombre    TEXT NOT NULL,
  canal     TEXT,
  estatus   TEXT,
  PRIMARY KEY (tenant_id, clave)
);

CREATE TABLE clientes (
  tenant_id        TEXT NOT NULL REFERENCES tenants(id),
  clave            INTEGER NOT NULL,
  razon_social     TEXT NOT NULL,
  nombre_comercial TEXT,
  canal            TEXT,
  vendedor_clave   INTEGER,
  primera_compra   DATE,
  estatus          TEXT,
  PRIMARY KEY (tenant_id, clave)
);

CREATE TABLE productos (
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  clave          TEXT NOT NULL,
  descripcion    TEXT NOT NULL,
  categoria      TEXT,
  linea          TEXT,
  costo_estandar NUMERIC(14,4),
  precio_lista   NUMERIC(14,2),
  PRIMARY KEY (tenant_id, clave)
);

CREATE TABLE inventario (
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  producto_clave TEXT NOT NULL,
  existencias    INTEGER DEFAULT 0,
  costo          NUMERIC(14,4),
  linea          TEXT,
  lugar          TEXT,
  PRIMARY KEY (tenant_id, producto_clave)
);

CREATE TABLE ventas (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  fecha           DATE NOT NULL,
  factura         TEXT NOT NULL,
  cliente_clave   INTEGER,
  vendedor_clave  INTEGER,
  canal           TEXT,
  producto_clave  TEXT,
  unidades        INTEGER,
  precio_unitario NUMERIC(14,4),
  monto_total     NUMERIC(14,2),
  costo_unitario  NUMERIC(14,4),
  bodega          INTEGER,
  impuestos       NUMERIC(14,2)
);

CREATE TABLE cuentas_por_cobrar (
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  factura         TEXT NOT NULL,
  fecha_factura   DATE,
  fecha_vence     DATE,
  monto_facturado NUMERIC(14,2),
  monto_cobrado   NUMERIC(14,2),
  saldo_pendiente NUMERIC(14,2),
  fecha_pago      DATE,
  cliente_clave   INTEGER,
  PRIMARY KEY (tenant_id, factura)
);

CREATE INDEX idx_ventas_tenant_fecha ON ventas(tenant_id, fecha);
CREATE INDEX idx_ventas_canal        ON ventas(tenant_id, canal);
CREATE INDEX idx_ventas_cliente      ON ventas(tenant_id, cliente_clave);
CREATE INDEX idx_ventas_vendedor     ON ventas(tenant_id, vendedor_clave);
CREATE INDEX idx_ventas_producto     ON ventas(tenant_id, producto_clave);
CREATE INDEX idx_ventas_factura      ON ventas(tenant_id, factura);
CREATE INDEX idx_cxc_vence           ON cuentas_por_cobrar(tenant_id, fecha_vence);
CREATE INDEX idx_cxc_saldo           ON cuentas_por_cobrar(tenant_id, saldo_pendiente);

-- Marketing: capturado dentro de Power BI, no viene de los Excel.
-- Se siembra con scripts/marketing.ts y el cliente lo actualiza por CSV.
CREATE TABLE marketing (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  periodo   TEXT NOT NULL,          -- 'YYYY-MM'
  monto     NUMERIC(14,2) NOT NULL,
  campana   TEXT,
  PRIMARY KEY (tenant_id, periodo)
);
