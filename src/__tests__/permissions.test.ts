import { describe, expect, it } from "vitest";
import { APP_PERMISSIONS, hasPermission, isAppRole } from "@/lib/permissions";

describe("role permission matrix", () => {
  it("recognizes only the four supported roles", () => {
    expect(isAppRole("admin")).toBe(true);
    expect(isAppRole("supervisor")).toBe(true);
    expect(isAppRole("operator")).toBe(true);
    expect(isAppRole("auditor")).toBe(true);
    expect(isAppRole("unknown")).toBe(false);
    expect(isAppRole(null)).toBe(false);
  });

  it("grants administrators every defined permission", () => {
    for (const permission of APP_PERMISSIONS) {
      expect(hasPermission("admin", permission)).toBe(true);
    }
  });

  it("keeps supervisor permissions aligned with current management workflows", () => {
    expect(hasPermission("supervisor", "catalog.manage")).toBe(true);
    expect(hasPermission("supervisor", "inventory.dispose")).toBe(true);
    expect(hasPermission("supervisor", "inventory.transfer")).toBe(true);
    expect(hasPermission("supervisor", "orders.manage")).toBe(true);
    expect(hasPermission("supervisor", "audit.logs.view")).toBe(true);
    expect(hasPermission("supervisor", "users.manage")).toBe(false);
    expect(hasPermission("supervisor", "configuration.manage")).toBe(false);
  });

  it("limits operators to their current operational workflows", () => {
    expect(hasPermission("operator", "inventory.consume")).toBe(true);
    expect(hasPermission("operator", "inventory.transfer")).toBe(true);
    expect(hasPermission("operator", "reception.record")).toBe(true);
    expect(hasPermission("operator", "environmental.record")).toBe(true);
    expect(hasPermission("operator", "catalog.manage")).toBe(false);
    expect(hasPermission("operator", "inventory.dispose")).toBe(false);
  });

  it("keeps auditors read-oriented and permits audit review", () => {
    expect(hasPermission("auditor", "audit.logs.view")).toBe(true);
    expect(hasPermission("auditor", "reports.view")).toBe(true);
    expect(hasPermission("auditor", "inventory.view")).toBe(true);
    expect(hasPermission("auditor", "inventory.consume")).toBe(false);
    expect(hasPermission("auditor", "users.manage")).toBe(false);
  });

  it("fails closed for unknown roles", () => {
    expect(hasPermission("unknown", "dashboard.view")).toBe(false);
  });
});
