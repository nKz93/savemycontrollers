import type { ReactNode } from "react";

export const metadata = {
  title: "SaveMyControllers",
  description: "Reparation, amelioration et personnalisation de manettes de jeu.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
