import { describe, expect, it } from "vitest";
import { filterLocationsForSection, getLocationsForSection } from "@/lib/utils/locations";

describe("filterLocationsForSection", () => {
  const locations = [
    { id: "hematology-1", name: "Estante A", section_id: "hematology" },
    { id: "chemistry-1", name: "Nevera 1", section_id: "chemistry" },
    { id: "unassigned", name: "Ubicación antigua", section_id: null },
  ];

  it("returns only locations in the selected area, including dynamically added areas", () => {
    expect(filterLocationsForSection(locations, "chemistry")).toEqual([locations[1]]);
  });

  it("does not mix locations from other areas or unassigned locations", () => {
    expect(filterLocationsForSection(locations, "hematology")).toEqual([locations[0]]);
  });

  it("keeps unassigned locations available only to legacy items without an area", () => {
    expect(filterLocationsForSection(locations, null)).toEqual([locations[2]]);
  });

  it("uses legacy unassigned locations only when the requested area has no mapped location", () => {
    expect(getLocationsForSection(locations, "specials")).toEqual({
      locations: [locations[2]],
      usingUnassignedFallback: true,
    });
  });

  it("prefers area-mapped locations when they exist", () => {
    expect(getLocationsForSection(locations, "hematology")).toEqual({
      locations: [locations[0]],
      usingUnassignedFallback: false,
    });
  });
});
