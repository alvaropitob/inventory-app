-- Associate legacy locations with an area only when all catalog items stored
-- there point to the same area. Ambiguous locations remain unassigned for
-- manual review in Configuración.
WITH location_areas AS (
  SELECT
    batches.location_id,
    (array_agg(DISTINCT items.section_id))[1] AS section_id
  FROM public.inventory_batches AS batches
  JOIN public.catalog_items AS items ON items.id = batches.item_id
  WHERE items.section_id IS NOT NULL
  GROUP BY batches.location_id
  HAVING count(DISTINCT items.section_id) = 1
)
UPDATE public.locations AS locations
SET section_id = location_areas.section_id
FROM location_areas
WHERE locations.id = location_areas.location_id
  AND locations.section_id IS NULL;
