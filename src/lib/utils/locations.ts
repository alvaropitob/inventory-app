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

export function getLocationsForSection<T extends AreaLocation>(
  locations: T[],
  sectionId?: string | null,
): { locations: T[]; usingUnassignedFallback: boolean } {
  const related = filterLocationsForSection(locations, sectionId);
  if (related.length || !sectionId) {
    return { locations: related, usingUnassignedFallback: false };
  }

  const unassigned = locations.filter(location => !location.section_id);
  return { locations: unassigned, usingUnassignedFallback: unassigned.length > 0 };
}
