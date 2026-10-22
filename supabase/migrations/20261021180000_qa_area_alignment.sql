ALTER TYPE public.risk_classification ADD VALUE IF NOT EXISTS 'IIA';
ALTER TYPE public.risk_classification ADD VALUE IF NOT EXISTS 'IIB';

INSERT INTO public.sections (name, description) VALUES
  ('Hematología', 'Área de laboratorio'),
  ('Microbiología', 'Área de laboratorio'),
  ('Química', 'Área de laboratorio'),
  ('Especiales', 'Área de laboratorio'),
  ('Sede Norte', 'Sede de almacenamiento y operación'),
  ('Inmunología', 'Área de laboratorio'),
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
ON CONFLICT (name) DO UPDATE SET is_active = true;

INSERT INTO public.locations (name, description, section_id, location_type)
SELECT 'Sede Norte', 'Ubicación de almacenamiento para la sede norte', id, 'shelf'
FROM public.sections
WHERE name = 'Sede Norte'
ON CONFLICT (name) DO NOTHING;
