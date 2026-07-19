import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "../lib/auth/auth-context";
import { SiteHeader } from "../components/site-header";

export const metadata = {
  title: "SaveMyControllers",
  description: "Reparation, amelioration et personnalisation de manettes de jeu.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          <SiteHeader />
          <main className="smc-main">
            <div className="smc-container">{children}</div>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
