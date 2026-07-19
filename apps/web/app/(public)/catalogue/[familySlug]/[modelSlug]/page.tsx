import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerApiClient } from "../../../../../lib/api/server-client";

export default async function DeviceModelDetailPage({
  params,
}: {
  params: { familySlug: string; modelSlug: string };
}) {
  const api = createServerApiClient();
  const { data: model, response } = await api.GET("/catalog/device-models/{familySlug}/{modelSlug}", {
    params: { path: { familySlug: params.familySlug, modelSlug: params.modelSlug } },
  });

  if (response.status === 404 || !model) notFound();

  return (
    <div className="smc-stack">
      <p className="smc-muted">
        <Link href="/catalogue">← Retour au catalogue</Link>
      </p>
      <h1>
        {model.brand.name} {model.name}
      </h1>
      {model.longDescription && <p>{model.longDescription}</p>}

      <section aria-labelledby="variants-heading" className="smc-stack">
        <h2 id="variants-heading">Variantes disponibles</h2>
        <ul className="smc-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {model.variants.map((variant) => (
            <li key={variant.id} className="smc-card">
              <span>{variant.name}</span>
              {variant.revisions.length > 0 && (
                <span className="smc-muted">{variant.revisions.length} revision(s) materielle(s) disponible(s)</span>
              )}
              <Link
                href={`/configurateur/${params.familySlug}/${params.modelSlug}?variant=${variant.id}`}
                className="smc-btn"
              >
                Configurer une reparation
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
