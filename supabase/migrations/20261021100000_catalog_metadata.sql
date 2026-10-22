-- Product classification and technical fields requested for the laboratory catalog.
ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'reactivo',
  ADD COLUMN IF NOT EXISTS series text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS product_description text,
  ADD COLUMN IF NOT EXISTS active_ingredient text,
  ADD COLUMN IF NOT EXISTS dosage_form text,
  ADD COLUMN IF NOT EXISTS concentration text,
  ADD COLUMN IF NOT EXISTS commercial_presentation text,
  ADD COLUMN IF NOT EXISTS shelf_life text;

ALTER TYPE public.risk_classification ADD VALUE IF NOT EXISTS 'not_applicable';

ALTER TABLE public.catalog_items
  DROP CONSTRAINT IF EXISTS catalog_items_product_type_check;
ALTER TABLE public.catalog_items
  ADD CONSTRAINT catalog_items_product_type_check
  CHECK (product_type IN ('medicamento', 'dispositivo_medico', 'reactivo', 'insumo'));

ALTER TABLE IF EXISTS public.technical_receptions
  ADD COLUMN IF NOT EXISTS invoice_number text;

INSERT INTO public.sections (name, description) VALUES
  ('Hematología', 'Área de laboratorio'),
  ('Microbiología', 'Área de laboratorio'),
  ('Química', 'Área de laboratorio'),
  ('Especiales', 'Área de laboratorio'),
  ('Sede Norte', 'Sede de almacenamiento y operación'),
  ('Inmunología Manual', 'Área de laboratorio'),
  ('Insumos', 'Área de inventario'),
  ('Medicamentos', 'Área de inventario'),
  ('Repuestos', 'Área de inventario'),
  ('RIQAS', 'Área de control externo de calidad'),
  ('Glicosiladas', 'Área de laboratorio'),
  ('Dispositivos Médicos', 'Área de inventario'),
  ('Colorantes', 'Área de inventario'),
  ('Aseo', 'Área de inventario'),
  ('Especiales 2', 'Área de laboratorio')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.locations (name, description, section_id, location_type)
SELECT 'Sede Norte', 'Ubicación de almacenamiento para la sede norte', id, 'shelf'
FROM public.sections
WHERE name = 'Sede Norte'
ON CONFLICT (name) DO NOTHING;
