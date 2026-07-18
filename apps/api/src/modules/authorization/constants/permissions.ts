/**
 * Cles de permission stables. Ces cles ne doivent JAMAIS etre renommees
 * une fois publiees (elles sont referencees par le seed, par les tests et
 * potentiellement par des extensions). Le libelle affiche a l'ecran, lui,
 * reste modifiable depuis l'administration (table Role.label).
 */
export const PERMISSIONS = {
  CATALOG_READ: "catalog.read",
  CATALOG_CREATE: "catalog.create",
  CATALOG_UPDATE: "catalog.update",
  CATALOG_DELETE: "catalog.delete",
  ORDER_READ: "order.read",
  ORDER_UPDATE: "order.update",
  REPAIR_ASSIGN: "repair.assign",
  REPAIR_DIAGNOSE: "repair.diagnose",
  REPAIR_CHANGE_STATUS: "repair.change_status",
  REPAIR_VIEW_INTERNAL_NOTES: "repair.view_internal_notes",
  REPAIR_WRITE_INTERNAL_NOTES: "repair.write_internal_notes",
  REFUND_CREATE: "refund.create",
  MARGIN_READ: "margin.read",
  AUDIT_READ: "audit.read",
  ROLE_MANAGE: "role.manage",
  EXTENSION_MANAGE: "extension.manage",
  SETTINGS_MANAGE: "settings.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const SYSTEM_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  WORKSHOP_MANAGER: "WORKSHOP_MANAGER",
  TECHNICIAN: "TECHNICIAN",
  CUSTOMER_SUPPORT: "CUSTOMER_SUPPORT",
  SALES: "SALES",
  ACCOUNTANT: "ACCOUNTANT",
  ORDER_PREPARER: "ORDER_PREPARER",
} as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];
