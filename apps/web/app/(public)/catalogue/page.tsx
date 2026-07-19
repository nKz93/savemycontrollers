import Link from "next/link";
import { createServerApiClient } from "../../../lib/api/server-client.js";

export const metadata = { title: "Catalogue — SaveMyControllers" };

export default async function CataloguePage() {
  const api = createServerApiClient();
  const [{ data: brands }, { data: models }] = await Promise.all([
    api.GET("/catalog/brands"),
    api.GET("/catalog/device-models"),
  ]);

  return (
    <div className="smc-stack">
      <h1>Catalogue</h1>
      <p className="smc-muted">Choisissez votre marque puis votre modele pour configurer une reparation.</p>

      {brands && brands.length > 0 && (
        <section aria-labelledby="brands-heading" className="smc-stack">
          <h2 id="brands-heading">Marques</h2>
          <ul className="smc-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {brands.map((brand) => (
              <li key={brand.id} className="smc-card">
                <span>{brand.name}</span>
                {brand.shortDescription && <p className="smc-muted">{brand.shortDescription}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="models-heading" className="smc-stack">
        <h2 id="models-heading">Modeles</h2>
        {models && models.length > 0 ? (
          <ul className="smc-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {models.map((model) => (
              <li key={model.id} className="smc-card">
                <Link href={`/catalogue/${model.familySlug}/${model.slug}`}>{model.name}</Link>
                {model.shortDescription && <p className="smc-muted">{model.shortDescription}</p>}
                <span className="smc-badge">{model.variants.length} variante{model.variants.length > 1 ? "s" : ""}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="smc-muted">Aucun modele publie pour le moment.</p>
        )}
      </section>
    </div>
  );
}
