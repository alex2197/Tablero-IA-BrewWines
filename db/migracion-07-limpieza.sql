-- Migración 07
-- La tabla de ventas reclasificadas se elimina: el costo de muestreo ahora se
-- calcula directamente de las ventas, así se actualiza con cada carga.
DROP TABLE IF EXISTS ventas_reclasificadas;
