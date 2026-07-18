import type { ReactNode } from "react";

// Layout du site public (accueil, prestations, modeles, blog...).
// L'interface graphique complete est hors perimetre de cette phase
// (voir section 1 du prompt) ; ce layout etablit uniquement le point
// d'integration entre le groupe de routes et le design system @smc/ui.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div data-scope="public">{children}</div>;
}
