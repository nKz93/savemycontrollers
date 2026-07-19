import Link from "next/link";

export default function AccountHomePage() {
  return (
    <div className="smc-stack">
      <h1>Mon compte</h1>
      <ul className="smc-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        <li className="smc-card">
          <Link href="/compte/commandes">Mes commandes</Link>
        </li>
        <li className="smc-card">
          <Link href="/compte/adresses">Mes adresses</Link>
        </li>
      </ul>
    </div>
  );
}
