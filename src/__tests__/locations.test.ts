import { describe, expect, it } from "vitest";
import { filterLocationsForSection } from "@/lib/utils/locations";

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

  it("returns no locations when the product has no active area", () => {
    expect(filterLocationsForSection(locations, null)).toEqual([]);
  });

  it("never returns locations that are unassigned or belong to an older area", () => {
    expect(filterLocationsForSection(locations, "specials")).toEqual([]);
  });
});
