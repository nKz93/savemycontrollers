"use client";

import Link from "next/link";
import { useAuth } from "../lib/auth/auth-context.js";

export function SiteHeader() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="smc-header">
      <div className="smc-container smc-header__inner">
        <Link href="/" className="smc-header__brand">
          SaveMyControllers
        </Link>
        <nav className="smc-nav" aria-label="Navigation principale">
          <Link href="/catalogue">Catalogue</Link>
          <Link href="/panier">Panier</Link>
          {loading ? null : user ? (
            <>
              <Link href="/compte/commandes">Mes commandes</Link>
              <Link href="/compte/adresses">Mes adresses</Link>
              <span className="smc-muted">{user.firstName}</span>
              <button
                type="button"
                className="smc-btn smc-btn--secondary"
                onClick={() => {
                  void logout();
                }}
              >
                Se deconnecter
              </button>
            </>
          ) : (
            <>
              <Link href="/connexion">Connexion</Link>
              <Link href="/inscription">Creer un compte</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
