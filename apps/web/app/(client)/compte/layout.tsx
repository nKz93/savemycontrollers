import type { ReactNode } from "react";

// Espace client : commandes, suivi de reparation, factures, garanties.
// Point d'integration pret ; les ecrans complets seront developpes en
// phase suivante en s'appuyant sur @smc/api-client (genere depuis l'OpenAPI
// de apps/api).
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <div data-scope="client-account">{children}</div>;
}
