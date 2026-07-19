import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerApiClient } from "../../../../../lib/api/server-client.js";

const FINANCIAL_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: "En attente de paiement",
  PAID: "Payee",
  PARTIALLY_REFUNDED: "Partiellement remboursee",
  REFUNDED: "Remboursee",
  CANCELLED: "Annulee",
};

const OPERATIONAL_STATUS_LABELS: Record<string, string> = {
  CREATED: "Commande creee",
  AWAITING_SHIPMENT_FROM_CLIENT: "En attente de votre envoi",
  IN_PROGRESS: "En cours de traitement",
  PARTIALLY_SHIPPED: "Partiellement expediee",
  SHIPPED: "Expediee",
  DELIVERED: "Livree",
  CLOSED: "Cloturee",
  CANCELLED: "Annulee",
};

function formatPrice(amountMinor: number): string {
  return (amountMinor / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const api = createServerApiClient();
  const { data: order, response } = await api.GET("/orders/{id}", { params: { path: { id: params.id } } });

  if (response.status === 401) return <p>Vous devez etre connecte pour consulter cette commande.</p>;
  if (response.status === 404 || !order) notFound();

  return (
    <div className="smc-stack">
      <p className="smc-muted">
        <Link href="/compte/commandes">← Mes commandes</Link>
      </p>
      <h1>Commande {order.reference}</h1>
      <div className="smc-row">
        <span className="smc-badge">{FINANCIAL_STATUS_LABELS[order.financialStatus] ?? order.financialStatus}</span>
        <span className="smc-badge">{OPERATIONAL_STATUS_LABELS[order.operationalStatus] ?? order.operationalStatus}</span>
      </div>
      <p className="smc-muted">Passee le {new Date(order.createdAt).toLocaleString("fr-FR")}</p>

      <section className="smc-stack">
        <h2>Articles</h2>
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
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.deviceModelName} — {item.deviceVariantName}
                  {item.hardwareRevisionLabel && <div className="smc-muted">{item.hardwareRevisionLabel}</div>}
                  {item.reportedIssue && <div className="smc-muted">{item.reportedIssue}</div>}
                </td>
                <td>{item.services.map((s) => s.name).join(", ")}</td>
                <td>{item.options.length > 0 ? item.options.map((o) => o.name).join(", ") : "—"}</td>
                <td className="smc-price">{formatPrice(item.totalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl style={{ maxWidth: "20rem", marginLeft: "auto" }}>
          <div className="smc-row" style={{ justifyContent: "space-between" }}>
            <dt>Sous-total</dt>
            <dd className="smc-price">{formatPrice(order.subtotalMinor)}</dd>
          </div>
          {order.discountMinor > 0 && (
            <div className="smc-row" style={{ justifyContent: "space-between" }}>
              <dt>Remise</dt>
              <dd>-{formatPrice(order.discountMinor)}</dd>
            </div>
          )}
          <div className="smc-row" style={{ justifyContent: "space-between" }}>
            <dt>TVA</dt>
            <dd>{formatPrice(order.taxMinor)}</dd>
          </div>
          {order.shippingFeeMinor > 0 && (
            <div className="smc-row" style={{ justifyContent: "space-between" }}>
              <dt>Livraison</dt>
              <dd>{formatPrice(order.shippingFeeMinor)}</dd>
            </div>
          )}
          <div className="smc-row" style={{ justifyContent: "space-between", fontWeight: 700 }}>
            <dt>Total</dt>
            <dd className="smc-price">{formatPrice(order.totalMinor)}</dd>
          </div>
        </dl>
      </section>

      <section className="smc-row">
        <div className="smc-card" style={{ flex: 1 }}>
          <h2>Facturation</h2>
          <address style={{ fontStyle: "normal" }}>
            {order.billingAddress.recipientName}
            <br />
            {order.billingAddress.line1}
            {order.billingAddress.line2 && (
              <>
                <br />
                {order.billingAddress.line2}
              </>
            )}
            <br />
            {order.billingAddress.postalCode} {order.billingAddress.city}, {order.billingAddress.country}
          </address>
        </div>
        <div className="smc-card" style={{ flex: 1 }}>
          <h2>Livraison</h2>
          <address style={{ fontStyle: "normal" }}>
            {order.shippingAddress.recipientName}
            <br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 && (
              <>
                <br />
                {order.shippingAddress.line2}
              </>
            )}
            <br />
            {order.shippingAddress.postalCode} {order.shippingAddress.city}, {order.shippingAddress.country}
          </address>
        </div>
      </section>
    </div>
  );
}
