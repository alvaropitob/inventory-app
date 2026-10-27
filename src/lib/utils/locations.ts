export interface AreaLocation {
  section_id?: string | null;
}

/** Returns only locations assigned to an active item's area. */
export function filterLocationsForSection<T extends AreaLocation>(
  locations: T[],
  sectionId?: string | null,
): T[] {
  if (!sectionId) return [];
  return locations.filter(location => location.section_id === sectionId);
}
