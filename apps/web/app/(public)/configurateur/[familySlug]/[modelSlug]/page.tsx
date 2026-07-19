import { notFound } from "next/navigation";
import { createServerApiClient } from "../../../../../lib/api/server-client";
import { ConfiguratorForm } from "./configurator-form";

export default async function ConfiguratorPage({
  params,
  searchParams,
}: {
  params: { familySlug: string; modelSlug: string };
  searchParams: { variant?: string };
}) {
  const api = createServerApiClient();
  const [{ data: model, response }, { data: services }] = await Promise.all([
    api.GET("/catalog/device-models/{familySlug}/{modelSlug}", {
      params: { path: { familySlug: params.familySlug, modelSlug: params.modelSlug } },
    }),
    api.GET("/catalog/services"),
  ]);

  if (response.status === 404 || !model) notFound();

  return (
    <div className="smc-stack">
      <h1>
        Configurer une reparation — {model.brand.name} {model.name}
      </h1>
      <ConfiguratorForm model={model} services={services ?? []} preselectedVariantId={searchParams.variant} />
    </div>
  );
}
