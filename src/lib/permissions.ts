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

const STAFF_READ_PERMISSIONS: readonly AppPermission[] = [
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
];

export const ROLE_PERMISSIONS: Record<AppRole, readonly AppPermission[]> = {
  admin: APP_PERMISSIONS,
  supervisor: [
    ...STAFF_READ_PERMISSIONS,
    "catalog.manage",
    "catalog.toggle",
    "inventory.dispose",
    "inventory.transfer",
    "orders.manage",
    "quality.verify",
    "suppliers.evaluate",
    "equipment.manage",
    "equipment.maintain",
    "safety.incident.submit",
    "safety.monthly.manage",
    "audit.logs.view",
    "pqr.submit",
    "pqr.manage",
  ],
  operator: [
    ...STAFF_READ_PERMISSIONS,
    "inventory.consume",
    "inventory.transfer",
    "reception.record",
    "equipment.maintain",
    "environmental.record",
    "safety.incident.submit",
    "pqr.submit",
  ],
  auditor: [...STAFF_READ_PERMISSIONS, "audit.logs.view", "pqr.submit"],
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

export function hasPermission(roleOrPermissions: unknown, permission: AppPermission): boolean {
  if (Array.isArray(roleOrPermissions)) {
    return roleOrPermissions.includes(permission);
  }
  return isAppRole(roleOrPermissions) && ROLE_PERMISSIONS[roleOrPermissions].includes(permission);
}
