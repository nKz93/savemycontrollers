export const SEED_REPAIR_STATUSES: Array<{
  key: string; label: string; color: string; displayOrder: number; isSystem: boolean; isTerminal: boolean;
}> = [
  { key: "ORDER_CREATED", label: "Commande creee", color: "#64748b", displayOrder: 0, isSystem: true, isTerminal: false },
  { key: "AWAITING_SHIPMENT", label: "En attente d'envoi", color: "#f59e0b", displayOrder: 1, isSystem: true, isTerminal: false },
  { key: "RECEIVED", label: "Colis recu", color: "#3b82f6", displayOrder: 2, isSystem: true, isTerminal: false },
  { key: "DIAGNOSING", label: "Diagnostic en cours", color: "#3b82f6", displayOrder: 3, isSystem: false, isTerminal: false },
  { key: "AWAITING_CLIENT_VALIDATION", label: "Attente de validation du client", color: "#f59e0b", displayOrder: 4, isSystem: true, isTerminal: false },
  { key: "AWAITING_PART", label: "Attente de piece", color: "#f59e0b", displayOrder: 5, isSystem: false, isTerminal: false },
  { key: "IN_REPAIR", label: "Reparation en cours", color: "#3b82f6", displayOrder: 6, isSystem: false, isTerminal: false },
  { key: "QUALITY_CHECK", label: "Tests qualite", color: "#3b82f6", displayOrder: 7, isSystem: false, isTerminal: false },
  { key: "REPAIR_DONE", label: "Reparation terminee", color: "#22c55e", displayOrder: 8, isSystem: false, isTerminal: false },
  { key: "PREPARING_RETURN", label: "Preparation du retour", color: "#22c55e", displayOrder: 9, isSystem: false, isTerminal: false },
  { key: "SHIPPED", label: "Expediee", color: "#22c55e", displayOrder: 10, isSystem: true, isTerminal: false },
  { key: "DELIVERED", label: "Livree", color: "#22c55e", displayOrder: 11, isSystem: true, isTerminal: false },
  { key: "CLOSED", label: "Cloturee", color: "#16a34a", displayOrder: 12, isSystem: true, isTerminal: true },
  { key: "UNREPAIRABLE", label: "Irreparable", color: "#ef4444", displayOrder: 13, isSystem: true, isTerminal: true },
  { key: "QUOTE_REFUSED", label: "Devis refuse", color: "#ef4444", displayOrder: 14, isSystem: true, isTerminal: true },
  { key: "CLIENT_UNREACHABLE", label: "Client injoignable", color: "#ef4444", displayOrder: 15, isSystem: false, isTerminal: false },
  { key: "CANCELLED", label: "Annulee", color: "#ef4444", displayOrder: 16, isSystem: true, isTerminal: true },
  { key: "WARRANTY_RETURN", label: "Retour sous garantie", color: "#a855f7", displayOrder: 17, isSystem: false, isTerminal: false },
];

// Matrice des transitions autorisees. Volontairement conservatrice pour
// cette phase : couvre le chemin nominal + les sorties (annulation,
// irreparabilite, refus de devis, client injoignable) a chaque etape
// pertinente. Affinable depuis l'administration en phase suivante.
export const SEED_REPAIR_TRANSITIONS: Array<{ from: string; to: string; isSystemProtected: boolean }> = [
  { from: "ORDER_CREATED", to: "AWAITING_SHIPMENT", isSystemProtected: true },
  { from: "ORDER_CREATED", to: "CANCELLED", isSystemProtected: true },
  { from: "AWAITING_SHIPMENT", to: "RECEIVED", isSystemProtected: true },
  { from: "AWAITING_SHIPMENT", to: "CLIENT_UNREACHABLE", isSystemProtected: false },
  { from: "AWAITING_SHIPMENT", to: "CANCELLED", isSystemProtected: true },
  { from: "RECEIVED", to: "DIAGNOSING", isSystemProtected: false },
  { from: "DIAGNOSING", to: "AWAITING_CLIENT_VALIDATION", isSystemProtected: false },
  { from: "DIAGNOSING", to: "IN_REPAIR", isSystemProtected: false },
  { from: "DIAGNOSING", to: "UNREPAIRABLE", isSystemProtected: true },
  { from: "AWAITING_CLIENT_VALIDATION", to: "IN_REPAIR", isSystemProtected: false },
  { from: "AWAITING_CLIENT_VALIDATION", to: "QUOTE_REFUSED", isSystemProtected: true },
  { from: "AWAITING_CLIENT_VALIDATION", to: "CLIENT_UNREACHABLE", isSystemProtected: false },
  { from: "IN_REPAIR", to: "AWAITING_PART", isSystemProtected: false },
  { from: "AWAITING_PART", to: "IN_REPAIR", isSystemProtected: false },
  { from: "IN_REPAIR", to: "QUALITY_CHECK", isSystemProtected: false },
  { from: "QUALITY_CHECK", to: "IN_REPAIR", isSystemProtected: false },
  { from: "QUALITY_CHECK", to: "REPAIR_DONE", isSystemProtected: false },
  { from: "REPAIR_DONE", to: "PREPARING_RETURN", isSystemProtected: false },
  { from: "PREPARING_RETURN", to: "SHIPPED", isSystemProtected: true },
  { from: "SHIPPED", to: "DELIVERED", isSystemProtected: true },
  { from: "DELIVERED", to: "CLOSED", isSystemProtected: true },
  { from: "CLOSED", to: "WARRANTY_RETURN", isSystemProtected: false },
  { from: "WARRANTY_RETURN", to: "DIAGNOSING", isSystemProtected: false },
];
