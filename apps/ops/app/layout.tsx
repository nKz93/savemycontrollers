import type { ReactNode } from "react";

export const metadata = { title: "SaveMyControllers — Back-office" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
