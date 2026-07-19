import Link from "next/link";
import { createServerApiClient } from "../../../../lib/api/server-client";

const STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: "En attente de paiement",
  PAID: "Payee",
  PARTIALLY_REFUNDED: "Partiellement remboursee",
  REFUNDED: "Remboursee",
  CANCELLED: "Annulee",
};

function formatPrice(amountMinor: number): string {
  return (amountMinor / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default async function OrdersPage() {
  const api = createServerApiClient();
  const { data: orders, response } = await api.GET("/orders");

  if (response.status === 401) {
    return <p>Vous devez etre connecte pour consulter vos commandes.</p>;
  }

  return (
    <div className="smc-stack">
      <h1>Mes commandes</h1>
      {!orders || orders.length === 0 ? (
        <p className="smc-muted">Vous n&apos;avez pas encore passe de commande.</p>
      ) : (
        <table className="smc-table">
          <thead>
            <tr>
              <th scope="col">Reference</th>
              <th scope="col">Date</th>
              <th scope="col">Statut</th>
              <th scope="col">Articles</th>
              <th scope="col">Total</th>
              <th scope="col">
                <span className="smc-visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.reference}</td>
                <td>{new Date(order.createdAt).toLocaleDateString("fr-FR")}</td>
                <td>{STATUS_LABELS[order.financialStatus] ?? order.financialStatus}</td>
                <td>{order.itemCount}</td>
                <td className="smc-price">{formatPrice(order.totalMinor)}</td>
                <td>
                  <Link href={`/compte/commandes/${order.id}`}>Voir le detail</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
