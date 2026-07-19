"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { components } from "@smc/api-client";
import { api } from "../../../lib/api/browser-client.js";
import { useAuth } from "../../../lib/auth/auth-context.js";
import { ApiErrorAlert } from "../../../components/api-error-alert.js";

type Address = components["schemas"]["AddressResponseDto"];
type Cart = components["schemas"]["CartResponseDto"];

function formatPrice(amountMinor: number): string {
  return (amountMinor / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [billingAddressId, setBillingAddressId] = useState("");
  const [shippingAddressId, setShippingAddressId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [{ data: mine }, { data: addressList }] = await Promise.all([api.GET("/cart/mine"), api.GET("/addresses")]);
      if (cancelled) return;
      if (mine?.cartId) {
        const { data: cartData } = await api.GET("/cart/{cartId}/authenticated", { params: { path: { cartId: mine.cartId } } });
        if (!cancelled) setCart(cartData ?? null);
      }
      setAddresses(addressList ?? []);
      const defaultBilling = addressList?.find((a) => a.isDefaultBilling) ?? addressList?.[0];
      const defaultShipping = addressList?.find((a) => a.isDefaultShipping) ?? addressList?.[0];
      if (defaultBilling) setBillingAddressId(defaultBilling.id);
      if (defaultShipping) setShippingAddressId(defaultShipping.id);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  async function handleSubmit() {
    if (!cart) return;
    setSubmitting(true);
    setError(null);
    const { data, error: orderError } = await api.POST("/orders", {
      body: { cartId: cart.id, billingAddressId, shippingAddressId },
    });
    setSubmitting(false);
    if (orderError) {
      setError(orderError);
      return;
    }
    if (data) router.push(`/compte/commandes/${data.id}`);
  }

  if (authLoading || loading) return <p className="smc-muted">Chargement…</p>;
  if (!user) return <p>Vous devez etre connecte pour finaliser une commande.</p>;
  if (!cart || cart.items.length === 0) {
    return (
      <p>
        Votre panier est vide. <Link href="/catalogue">Parcourir le catalogue</Link>
      </p>
    );
  }
  if (addresses.length === 0) {
    return (
      <div className="smc-stack">
        <p>Ajoutez au moins une adresse avant de finaliser votre commande.</p>
        <Link href="/compte/adresses" className="smc-btn">
          Ajouter une adresse
        </Link>
      </div>
    );
  }

  return (
    <div className="smc-stack">
      <h1>Finaliser la commande</h1>
      <ApiErrorAlert error={error} />

      <section className="smc-stack">
        <h2>Recapitulatif</h2>
        <table className="smc-table">
          <thead>
            <tr>
              <th scope="col">Appareil</th>
              <th scope="col">Prestations</th>
              <th scope="col">Prix</th>
            </tr>
          </thead>
          <tbody>
            {cart.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.deviceModelName} — {item.deviceVariantName}
                </td>
                <td>{item.serviceNames.join(", ")}</td>
                <td className="smc-price">{formatPrice(item.totalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ textAlign: "right" }}>
          Total : <span className="smc-price">{formatPrice(cart.totalMinor)}</span>
        </p>
      </section>

      <section className="smc-row">
        <div className="smc-field">
          <label htmlFor="billing">Adresse de facturation</label>
          <select id="billing" value={billingAddressId} onChange={(e) => setBillingAddressId(e.target.value)}>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label || a.recipientName} — {a.line1}, {a.city}
              </option>
            ))}
          </select>
        </div>
        <div className="smc-field">
          <label htmlFor="shipping">Adresse de livraison</label>
          <select id="shipping" value={shippingAddressId} onChange={(e) => setShippingAddressId(e.target.value)}>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label || a.recipientName} — {a.line1}, {a.city}
              </option>
            ))}
          </select>
        </div>
      </section>

      <p className="smc-muted">
        Aucun paiement n&apos;est demande a cette etape. Votre commande restera en attente de paiement.
      </p>

      <button type="button" className="smc-btn" disabled={submitting} onClick={() => void handleSubmit()}>
        {submitting ? "Validation…" : "Valider la commande"}
      </button>
    </div>
  );
}
