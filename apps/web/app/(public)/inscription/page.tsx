"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "../../../lib/api/browser-client";
import { ApiErrorAlert } from "../../../components/api-error-alert";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data, error: registerError } = await api.POST("/auth/register", {
      body: { firstName, lastName, email, password },
    });
    setSubmitting(false);
    if (registerError) {
      setError(registerError);
      return;
    }
    setSuccess(true);
    void data;
  }

  if (success) {
    return (
      <div className="smc-stack">
        <h1>Compte cree</h1>
        <p className="smc-alert smc-alert--success" role="status">
          Votre compte a ete cree. Verifiez votre boite mail pour l&apos;activer, puis{" "}
          <Link href="/connexion">connectez-vous</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="smc-stack">
      <h1>Creer un compte</h1>
      <form className="smc-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <ApiErrorAlert error={error} />
        <div className="smc-row">
          <div className="smc-field">
            <label htmlFor="firstName">Prenom</label>
            <input id="firstName" required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="smc-field">
            <label htmlFor="lastName">Nom</label>
            <input id="lastName" required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
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
            minLength={12}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-hint"
          />
          <span id="password-hint" className="smc-muted">
            12 caracteres minimum.
          </span>
        </div>
        <button type="submit" className="smc-btn" disabled={submitting}>
          {submitting ? "Creation…" : "Creer mon compte"}
        </button>
      </form>
      <p className="smc-muted">
        Deja un compte ? <Link href="/connexion">Se connecter</Link>
      </p>
    </div>
  );
}
