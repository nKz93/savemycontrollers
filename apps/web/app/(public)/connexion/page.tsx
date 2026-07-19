"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, resetCsrfToken } from "../../../lib/api/browser-client.js";
import { useAuth } from "../../../lib/auth/auth-context.js";
import { ApiErrorAlert } from "../../../components/api-error-alert.js";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: loginError } = await api.POST("/auth/login", { body: { email, password } });
    if (loginError) {
      setError(loginError);
      setSubmitting(false);
      return;
    }
    resetCsrfToken();
    // Fusionne le panier invite eventuel dans le compte qui vient de se
    // connecter (idempotent, sans effet si aucun panier invite n'existe).
    await api.POST("/cart/merge");
    await refresh();
    router.push("/compte/commandes");
  }

  return (
    <div className="smc-stack">
      <h1>Connexion</h1>
      <form className="smc-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <ApiErrorAlert error={error} />
        <div className="smc-field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="smc-field">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="smc-btn" disabled={submitting}>
          {submitting ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <p className="smc-muted">
        Pas encore de compte ? <Link href="/inscription">Creer un compte</Link>
      </p>
    </div>
  );
}
