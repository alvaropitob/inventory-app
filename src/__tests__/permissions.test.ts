import { describe, expect, it } from "vitest";
import {
  APP_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  getRolePermissionCellState,
  hasPermission,
  isAppRole,
} from "@/lib/permissions";

describe("permission helpers and role matrix protections", () => {
  it("recognizes only the four built-in system role names", () => {
    expect(isAppRole("admin")).toBe(true);
    expect(isAppRole("supervisor")).toBe(true);
    expect(isAppRole("operator")).toBe(true);
    expect(isAppRole("auditor")).toBe(true);
    expect(isAppRole("unknown")).toBe(false);
    expect(isAppRole(null)).toBe(false);
  });

  it("evaluates permissions exclusively from the database-resolved array and fails closed otherwise", () => {
    expect(hasPermission(["dashboard.view", "inventory.view"], "inventory.view")).toBe(true);
    expect(hasPermission(["dashboard.view"], "users.manage")).toBe(false);
    expect(hasPermission("admin", "dashboard.view")).toBe(false);
    expect(hasPermission(null, "dashboard.view")).toBe(false);
    expect(hasPermission(undefined, "dashboard.view")).toBe(false);
  });

  it("locks and preserves roles.manage and users.manage on the built-in admin role", () => {
    for (const code of ["roles.manage", "users.manage"] as const) {
      const state = getRolePermissionCellState({
        permissionCode: code,
        actorPermissions: APP_PERMISSIONS,
        role: { name: "admin", is_system: true },
        rolePermissions: APP_PERMISSIONS,
      });
      expect(state.checked).toBe(true);
      expect(state.disabled).toBe(true);
      expect(state.preserveWithHiddenInput).toBe(true);
    }
  });

  it("does not force or lock roles.manage or users.manage on supervisor, operator, or auditor", () => {
    for (const roleName of ["supervisor", "operator", "auditor"]) {
      for (const code of ["roles.manage", "users.manage"] as const) {
        const state = getRolePermissionCellState({
          permissionCode: code,
          actorPermissions: APP_PERMISSIONS,
          role: { name: roleName, is_system: true },
          rolePermissions: ["dashboard.view", "inventory.view"],
        });
        expect(state.checked).toBe(false);
        expect(state.disabled).toBe(false);
        expect(state.preserveWithHiddenInput).toBe(false);
      }
    }
  });

  it("pre-selects only default baseline permissions (never roles.manage) when creating a custom role", () => {
    const rolesManage = getRolePermissionCellState({
      permissionCode: "roles.manage",
      actorPermissions: APP_PERMISSIONS,
    });
    expect(rolesManage.checked).toBe(false);
    expect(rolesManage.preserveWithHiddenInput).toBe(false);

    for (const baseline of DEFAULT_ROLE_PERMISSIONS) {
      const cell = getRolePermissionCellState({
        permissionCode: baseline,
        actorPermissions: APP_PERMISSIONS,
      });
      expect(cell.checked).toBe(true);
      expect(cell.disabled).toBe(false);
    }
  });

  it("prevents a delegated role manager from granting or revoking permissions they do not hold", () => {
    const delegatedActor = ["dashboard.view", "roles.manage", "inventory.view"];

    const unheldNotGranted = getRolePermissionCellState({
      permissionCode: "users.manage",
      actorPermissions: delegatedActor,
      role: { name: "Coordinador", is_system: false },
      rolePermissions: ["dashboard.view"],
    });
    expect(unheldNotGranted.checked).toBe(false);
    expect(unheldNotGranted.disabled).toBe(true);
    expect(unheldNotGranted.preserveWithHiddenInput).toBe(false);

    const unheldAlreadyGranted = getRolePermissionCellState({
      permissionCode: "users.manage",
      actorPermissions: delegatedActor,
      role: { name: "admin", is_system: true },
      rolePermissions: ["dashboard.view", "users.manage"],
    });
    expect(unheldAlreadyGranted.checked).toBe(true);
    expect(unheldAlreadyGranted.disabled).toBe(true);
    expect(unheldAlreadyGranted.preserveWithHiddenInput).toBe(true);
  });
});
