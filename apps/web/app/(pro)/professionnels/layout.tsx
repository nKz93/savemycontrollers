import type { ReactNode } from "react";

// Portail professionnel : comptes entreprise, grilles tarifaires,
// commandes groupees. Voir section 11 de l'architecture.
export default function ProLayout({ children }: { children: ReactNode }) {
  return <div data-scope="professional-portal">{children}</div>;
}
