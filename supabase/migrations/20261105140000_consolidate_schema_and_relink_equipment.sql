-- ==============================================================================
-- Migration: Consolidate ER Model and Relink Equipment FK
-- Description:
-- 1. Relinks stock_movements.equipment_id to the canonical public.equipments table.
-- 2. Safely removes empty, redundant and legacy tables:
--    - public.equipment (empty singular duplicate superseded by public.equipments)
--    - public.usage_logs (empty auxiliary table referencing legacy equipment)
--    - public.product (empty orphan table superseded by public.catalog_items)
--    - public.adverse_incidents and public.incidents (empty duplicates superseded by public.safety_incidents)
--    - Legacy manufacturing module (order_activities, alerts, order_tasks,
--      activity_templates, task_templates, subprocess_templates,
--      production_orders, process_templates).
-- ==============================================================================

-- 1. Relink stock_movements FK to public.equipments
ALTER TABLE IF EXISTS public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_equipment_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'equipments'
  ) THEN
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT stock_movements_equipment_id_fkey
      FOREIGN KEY (equipment_id)
      REFERENCES public.equipments(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Drop empty legacy equipment tables
DROP TABLE IF EXISTS public.usage_logs CASCADE;
DROP TABLE IF EXISTS public.equipment CASCADE;

-- 3. Drop empty orphan product table
DROP TABLE IF EXISTS public.product CASCADE;

-- 4. Drop empty duplicate incident tables
DROP TABLE IF EXISTS public.adverse_incidents CASCADE;
DROP TABLE IF EXISTS public.incidents CASCADE;

-- 5. Drop empty legacy manufacturing/production module
DROP TABLE IF EXISTS public.order_activities CASCADE;
DROP TABLE IF EXISTS public.alerts CASCADE;
DROP TABLE IF EXISTS public.order_tasks CASCADE;
DROP TABLE IF EXISTS public.activity_templates CASCADE;
DROP TABLE IF EXISTS public.task_templates CASCADE;
DROP TABLE IF EXISTS public.subprocess_templates CASCADE;
DROP TABLE IF EXISTS public.production_orders CASCADE;
DROP TABLE IF EXISTS public.process_templates CASCADE;

