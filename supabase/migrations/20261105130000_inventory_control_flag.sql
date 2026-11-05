-- Distinguish catalog products from products managed as inventory.
ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS inventory_control_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.catalog_items.inventory_control_enabled IS
  'When true, low/high stock alerts apply. A stock entry automatically enables inventory control.';

-- Preserve control for products that already have inventory records.
UPDATE public.catalog_items AS item
SET inventory_control_enabled = true
WHERE EXISTS (
  SELECT 1
  FROM public.inventory_batches AS batch
  WHERE batch.item_id = item.id
);

CREATE OR REPLACE FUNCTION public.fn_enable_inventory_control_on_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item_id uuid;
BEGIN
  IF NEW.movement_type::text IS DISTINCT FROM 'entry' THEN
    RETURN NEW;
  END IF;

  SELECT item_id
  INTO v_item_id
  FROM public.inventory_batches
  WHERE id = NEW.batch_id;

  IF v_item_id IS NOT NULL THEN
    UPDATE public.catalog_items
    SET inventory_control_enabled = true
    WHERE id = v_item_id
      AND inventory_control_enabled IS DISTINCT FROM true;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_enable_inventory_control_on_entry() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enable_inventory_control_on_entry ON public.stock_movements;
CREATE TRIGGER trg_enable_inventory_control_on_entry
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enable_inventory_control_on_entry();

NOTIFY pgrst, 'reload schema';
