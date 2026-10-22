-- Optional upper stock limit used by catalog alerts and sufficiency reports.
ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS maximum_stock_threshold integer;

ALTER TABLE public.catalog_items
  DROP CONSTRAINT IF EXISTS catalog_items_stock_thresholds_check;
ALTER TABLE public.catalog_items
  ADD CONSTRAINT catalog_items_stock_thresholds_check
  CHECK (
    (minimum_stock_threshold IS NULL OR minimum_stock_threshold >= 0)
    AND (maximum_stock_threshold IS NULL OR maximum_stock_threshold >= 0)
    AND (maximum_stock_threshold IS NULL OR minimum_stock_threshold IS NULL
         OR maximum_stock_threshold >= minimum_stock_threshold)
  );
