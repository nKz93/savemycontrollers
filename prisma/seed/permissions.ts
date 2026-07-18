export const SEED_PERMISSIONS: Array<{ key: string; description: string }> = [
  { key: "catalog.read", description: "Consulter le catalogue (y compris brouillons)" },
  { key: "catalog.create", description: "Creer des elements de catalogue" },
  { key: "catalog.update", description: "Modifier des elements de catalogue" },
  { key: "catalog.delete", description: "Supprimer des elements de catalogue" },
  { key: "order.read", description: "Consulter les commandes" },
  { key: "order.update", description: "Modifier une commande" },
  { key: "repair.assign", description: "Attribuer un dossier a un technicien" },
  { key: "repair.diagnose", description: "Saisir un diagnostic" },
  { key: "repair.change_status", description: "Changer le statut d'un dossier" },
  { key: "repair.view_internal_notes", description: "Consulter les notes internes" },
  { key: "repair.write_internal_notes", description: "Ajouter une note interne" },
  { key: "refund.create", description: "Emettre un remboursement" },
  { key: "margin.read", description: "Consulter les marges" },
  { key: "audit.read", description: "Consulter le journal d'audit" },
  { key: "role.manage", description: "Gerer les roles et permissions" },
  { key: "extension.manage", description: "Installer/desinstaller une extension" },
  { key: "settings.manage", description: "Modifier les parametres systeme" },
];

export const SEED_ROLES: Array<{ key: string; label: string; permissionKeys: string[] }> = [
  {
    key: "SUPER_ADMIN",
    label: "Super-administrateur",
    permissionKeys: SEED_PERMISSIONS.map((p) => p.key),
  },
  {
    key: "ADMIN",
    label: "Administrateur",
    permissionKeys: [
      "catalog.read", "catalog.create", "catalog.update", "catalog.delete",
      "order.read", "order.update", "repair.assign", "repair.diagnose",
      "repair.change_status", "repair.view_internal_notes", "repair.write_internal_notes", "refund.create",
      "margin.read", "audit.read", "settings.manage",
    ],
  },
  {
    key: "WORKSHOP_MANAGER",
    label: "Responsable atelier",
    permissionKeys: [
      "catalog.read", "order.read", "repair.assign", "repair.diagnose",
      "repair.change_status", "repair.view_internal_notes", "repair.write_internal_notes", "margin.read",
    ],
  },
  {
    key: "TECHNICIAN",
    label: "Technicien",
    permissionKeys: ["catalog.read", "order.read", "repair.diagnose", "repair.change_status", "repair.view_internal_notes", "repair.write_internal_notes"],
  },
  {
    key: "CUSTOMER_SUPPORT",
    label: "Support client",
    permissionKeys: ["order.read", "repair.view_internal_notes"],
  },
  {
    key: "SALES",
    label: "Commercial",
    permissionKeys: ["catalog.read", "order.read", "margin.read"],
  },
  {
    key: "ACCOUNTANT",
    label: "Comptable",
    permissionKeys: ["order.read", "refund.create", "margin.read"],
  },
  {
    key: "ORDER_PREPARER",
    label: "Preparateur de commandes",
    permissionKeys: ["order.read", "repair.change_status"],
  },
];
