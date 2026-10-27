export interface AreaLocation {
  section_id?: string | null;
}

/** Returns only locations assigned to the item's area. Legacy unassigned items
 * can use only legacy unassigned locations until their area is configured. */
export function filterLocationsForSection<T extends AreaLocation>(
  locations: T[],
  sectionId?: string | null,
): T[] {
  return locations.filter(location => sectionId
    ? location.section_id === sectionId
    : !location.section_id
  );
}
