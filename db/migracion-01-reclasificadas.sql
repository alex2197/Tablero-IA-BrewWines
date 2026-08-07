-- Migración 01
-- La tabla "marketing" del Power BI no contenía gasto publicitario: agrupaba
-- ventas menores a $190 que el cliente pidió clasificar aparte. Se renombra
-- para que el nombre diga lo que el dato realmente es.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'marketing') THEN
    ALTER TABLE marketing RENAME TO ventas_reclasificadas;
    ALTER TABLE ventas_reclasificadas RENAME COLUMN campana TO concepto;
  END IF;
END $$;
