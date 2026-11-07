/** Built-in system role names. Runtime authorization uses the permissions stored in the database, not role names. */
export const APP_ROLES = ["admin", "supervisor", "operator", "auditor"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const APP_PERMISSIONS = [
  "dashboard.view",
  "inventory.view",
  "orders.view",
  "reception.view",
  "suppliers.view",
  "safety.view",
  "monitoring.view",
  "equipment.view",
  "reports.view",
  "quality.view",
  "configuration.manage",
  "catalog.manage",
  "catalog.delete",
  "catalog.toggle",
  "inventory.consume",
  "inventory.dispose",
  "inventory.transfer",
  "orders.manage",
  "reception.record",
  "quality.verify",
  "suppliers.manage",
  "suppliers.evaluate",
  "equipment.manage",
  "equipment.maintain",
  "environmental.record",
  "environmental.range.manage",
  "safety.incident.submit",
  "safety.monthly.manage",
  "audit.logs.view",
  "users.manage",
  "roles.manage",
  "pqr.submit",
  "pqr.manage",
] as const;
export type AppPermission = (typeof APP_PERMISSIONS)[number];
export type AccessPermissionCode = string;

const PROTECTED_ADMIN_PERMISSIONS = new Set<string>(["roles.manage", "users.manage"]);
export const DEFAULT_ROLE_PERMISSIONS: readonly AppPermission[] = ["dashboard.view", "pqr.submit"];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

/**
 * Checks whether the permission list loaded from the database contains the requested permission.
 * Anything other than a string array fails closed.
 */
export function hasPermission(permissions: unknown, permission: AppPermission): boolean {
  return Array.isArray(permissions) && permissions.includes(permission);
}

export interface RolePermissionCellInput {
  permissionCode: string;
  actorPermissions: readonly string[];
  role?: { name: string; is_system: boolean };
  rolePermissions?: readonly string[];
}

export interface RolePermissionCellState {
  checked: boolean;
  disabled: boolean;
  /** True when a hidden input must also be rendered so a locked permission is preserved on save. */
  preserveWithHiddenInput: boolean;
  reason?: string;
}

/** Computes how a single permission checkbox behaves in the role matrix editor. */
export function getRolePermissionCellState({
  permissionCode, actorPermissions, role, rolePermissions = [],
}: RolePermissionCellInput): RolePermissionCellState {
  const actorLacks = !actorPermissions.includes(permissionCode);
  const checked = role
    ? rolePermissions.includes(permissionCode)
    : !actorLacks && (DEFAULT_ROLE_PERMISSIONS as readonly string[]).includes(permissionCode);
  const protectedOnAdmin = Boolean(
    role?.is_system && role.name === "admin" && PROTECTED_ADMIN_PERMISSIONS.has(permissionCode),
  );
  return {
    checked,
    disabled: protectedOnAdmin || actorLacks,
    preserveWithHiddenInput: protectedOnAdmin || Boolean(role && actorLacks && checked),
    reason: protectedOnAdmin
      ? "El perfil administrador debe conservar este permiso."
      : actorLacks ? "No puedes modificar un permiso que no tienes." : undefined,
  };
}
