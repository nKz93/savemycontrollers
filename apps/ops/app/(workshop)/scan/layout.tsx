import type { ReactNode } from "react";

// Interface atelier / scanner QR, pensee mobile-first (PWA), voir
// section 13 de l'architecture.
export default function WorkshopScanLayout({ children }: { children: ReactNode }) {
  return <div data-scope="workshop-scan">{children}</div>;
}
