import type { ReactNode } from "react";

// Tableau de bord administratif (section 12 de l'architecture).
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div data-scope="admin-dashboard">{children}</div>;
}
