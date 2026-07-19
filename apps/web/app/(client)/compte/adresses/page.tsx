"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { components } from "@smc/api-client";
import { api } from "../../../../lib/api/browser-client";
import { useAuth } from "../../../../lib/auth/auth-context";
import { ApiErrorAlert } from "../../../../components/api-error-alert";

type Address = components["schemas"]["AddressResponseDto"];

const EMPTY_FORM = {
  label: "",
  recipientName: "",
  line1: "",
  line2: "",
  postalCode: "",
  city: "",
  country: "FR",
  phone: "",
  isDefaultBilling: false,
  isDefaultShipping: false,
};

export default function AddressesPage() {
  const { user, loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function loadAddresses() {
    setLoading(true);
    const { data, error: listError } = await api.GET("/addresses");
    if (listError) setError(listError);
    else setAddresses(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && user) void loadAddresses();
  }, [authLoading, user]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: createError } = await api.POST("/addresses", {
      body: {
        ...form,
        label: form.label || undefined,
        line2: form.line2 || undefined,
        phone: form.phone || undefined,
      },
    });
    setSubmitting(false);
    if (createError) {
      setError(createError);
      return;
    }
    setForm(EMPTY_FORM);
    setShowForm(false);
    await loadAddresses();
  }

  async function handleDelete(id: string) {
    setError(null);
    const { error: deleteError } = await api.DELETE("/addresses/{id}", { params: { path: { id } } });
    if (deleteError) setError(deleteError);
    else await loadAddresses();
  }

  if (authLoading || (loading && user)) return <p className="smc-muted">Chargement…</p>;
  if (!user) return <p>Vous devez etre connecte pour gerer vos adresses.</p>;

  return (
    <div className="smc-stack">
      <h1>Mes adresses</h1>
      <ApiErrorAlert error={error} />

      {addresses.length === 0 && !showForm && <p className="smc-muted">Aucune adresse enregistree pour le moment.</p>}

      <ul className="smc-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {addresses.map((address) => (
          <li key={address.id} className="smc-card">
            <strong>{address.label || address.recipientName}</strong>
            {address.label && <span>{address.recipientName}</span>}
            <span>
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
            </span>
            <span>
              {address.postalCode} {address.city}, {address.country}
            </span>
            {address.phone && <span className="smc-muted">{address.phone}</span>}
            <div className="smc-row">
              {address.isDefaultBilling && <span className="smc-badge">Facturation par defaut</span>}
              {address.isDefaultShipping && <span className="smc-badge">Livraison par defaut</span>}
            </div>
            <button type="button" className="smc-btn smc-btn--danger" onClick={() => void handleDelete(address.id)}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      {!showForm && (
        <button type="button" className="smc-btn" onClick={() => setShowForm(true)}>
          Ajouter une adresse
        </button>
      )}

      {showForm && (
        <form className="smc-form" onSubmit={(e) => void handleCreate(e)} noValidate>
          <h2>Nouvelle adresse</h2>
          <div className="smc-field">
            <label htmlFor="label">Libelle (optionnel)</label>
            <input id="label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div className="smc-field">
            <label htmlFor="recipientName">Destinataire</label>
            <input
              id="recipientName"
              required
              value={form.recipientName}
              onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
            />
          </div>
          <div className="smc-field">
            <label htmlFor="line1">Adresse</label>
            <input id="line1" required value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
          </div>
          <div className="smc-field">
            <label htmlFor="line2">Complement (optionnel)</label>
            <input id="line2" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
          </div>
          <div className="smc-row">
            <div className="smc-field">
              <label htmlFor="postalCode">Code postal</label>
              <input
                id="postalCode"
                required
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              />
            </div>
            <div className="smc-field">
              <label htmlFor="city">Ville</label>
              <input id="city" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <div className="smc-field">
            <label htmlFor="phone">Telephone (optionnel)</label>
            <input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="smc-field">
            <label>
              <input
                type="checkbox"
                checked={form.isDefaultBilling}
                onChange={(e) => setForm({ ...form, isDefaultBilling: e.target.checked })}
              />{" "}
              Adresse de facturation par defaut
            </label>
          </div>
          <div className="smc-field">
            <label>
              <input
                type="checkbox"
                checked={form.isDefaultShipping}
                onChange={(e) => setForm({ ...form, isDefaultShipping: e.target.checked })}
              />{" "}
              Adresse de livraison par defaut
            </label>
          </div>
          <div className="smc-row">
            <button type="submit" className="smc-btn" disabled={submitting}>
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" className="smc-btn smc-btn--secondary" onClick={() => setShowForm(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
