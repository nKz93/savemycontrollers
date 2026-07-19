"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { components } from "@smc/api-client";
import { api } from "../../../lib/api/browser-client";
import { useAuth } from "../../../lib/auth/auth-context";
import { ApiErrorAlert } from "../../../components/api-error-alert";

type Cart = components["schemas"]["CartResponseDto"];

function formatPrice(amountMinor: number): string {
  return (amountMinor / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: resolved } = user ? await api.GET("/cart/mine") : await api.POST("/cart/guest");
        const cartId = resolved?.cartId;
        if (!cartId) throw new Error("Panier introuvable.");
        const { data, error: getError } = user
          ? await api.GET("/cart/{cartId}/authenticated", { params: { path: { cartId } } })
          : await api.GET("/cart/{cartId}", { params: { path: { cartId } } });
        if (cancelled) return;
        if (getError) setError(getError);
        else setCart(data ?? null);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (loading || authLoading) return <p className="smc-muted">Chargement du panier…</p>;

  return (
    <div className="smc-stack">
      <h1>Mon panier</h1>
      <ApiErrorAlert error={error} />

      {cart && cart.items.length === 0 && (
        <p>
          Votre panier est vide. <Link href="/catalogue">Parcourir le catalogue</Link>
        </p>
      )}

      {cart && cart.items.length > 0 && (
        <>
          <table className="smc-table">
            <thead>
              <tr>
                <th scope="col">Appareil</th>
                <th scope="col">Prestations</th>
                <th scope="col">Options</th>
                <th scope="col">Prix</th>
              </tr>
            </thead>
            <tbody>
              {cart.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.deviceModelName} — {item.deviceVariantName}
                    {item.reportedIssue && <div className="smc-muted">{item.reportedIssue}</div>}
                  </td>
                  <td>{item.serviceNames.join(", ")}</td>
                  <td>{item.optionNames.length > 0 ? item.optionNames.join(", ") : "—"}</td>
                  <td className="smc-price">{formatPrice(item.totalMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl style={{ maxWidth: "20rem", marginLeft: "auto" }}>
            <div className="smc-row" style={{ justifyContent: "space-between" }}>
              <dt>Sous-total</dt>
              <dd className="smc-price">{formatPrice(cart.subtotalMinor)}</dd>
            </div>
            {cart.discountMinor > 0 && (
              <div className="smc-row" style={{ justifyContent: "space-between" }}>
                <dt>Remise</dt>
                <dd>-{formatPrice(cart.discountMinor)}</dd>
              </div>
            )}
            <div className="smc-row" style={{ justifyContent: "space-between" }}>
              <dt>TVA</dt>
              <dd>{formatPrice(cart.taxMinor)}</dd>
            </div>
            <div className="smc-row" style={{ justifyContent: "space-between", fontWeight: 700 }}>
              <dt>Total</dt>
              <dd className="smc-price">{formatPrice(cart.totalMinor)}</dd>
            </div>
          </dl>

          {user ? (
            <button type="button" className="smc-btn" onClick={() => router.push("/checkout")}>
              Passer commande
            </button>
          ) : (
            <div className="smc-alert" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <p>Connectez-vous ou creez un compte pour finaliser votre commande.</p>
              <div className="smc-row">
                <Link href="/connexion" className="smc-btn">
                  Connexion
                </Link>
                <Link href="/inscription" className="smc-btn smc-btn--secondary">
                  Creer un compte
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
