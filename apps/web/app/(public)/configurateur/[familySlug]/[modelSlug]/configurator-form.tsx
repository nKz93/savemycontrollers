"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { components } from "@smc/api-client";
import { api } from "../../../../../lib/api/browser-client.js";
import { useAuth } from "../../../../../lib/auth/auth-context.js";
import { ApiErrorAlert } from "../../../../../components/api-error-alert.js";

type DeviceModelDetail = components["schemas"]["DeviceModelDetailResponseDto"];
type ServiceItem = components["schemas"]["ServiceResponseDto"];
type ConfigurationResult = components["schemas"]["ConfigurationResultResponseDto"];

function formatPrice(amountMinor: number): string {
  return (amountMinor / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function ConfiguratorForm({
  model,
  services,
  preselectedVariantId,
}: {
  model: DeviceModelDetail;
  services: ServiceItem[];
  preselectedVariantId?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const [variantId, setVariantId] = useState<string>(
    preselectedVariantId && model.variants.some((v) => v.id === preselectedVariantId)
      ? preselectedVariantId
      : (model.variants[0]?.id ?? ""),
  );
  const [revisionId, setRevisionId] = useState<string>("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [reportedIssue, setReportedIssue] = useState("");

  const [result, setResult] = useState<ConfigurationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<unknown>(null);

  const [addingToCart, setAddingToCart] = useState(false);
  const [addToCartError, setAddToCartError] = useState<unknown>(null);
  const [addedToCart, setAddedToCart] = useState(false);

  const selectedVariant = model.variants.find((v) => v.id === variantId);
  const availableServices = useMemo(() => services.filter((s) => s.status === "ACTIVE"), [services]);
  const optionsForSelectedServices = useMemo(
    () => availableServices.filter((s) => serviceIds.includes(s.id)).flatMap((s) => s.options),
    [availableServices, serviceIds],
  );

  // Les options ne restent selectionnables que pour des prestations
  // toujours cochees ; on nettoie les options orphelines localement (le
  // serveur revaliderait de toute facon, mais evite un etat incoherent a
  // l'affichage).
  useEffect(() => {
    const validOptionIds = new Set(optionsForSelectedServices.map((o) => o.id));
    setOptionIds((prev) => prev.filter((id) => validOptionIds.has(id)));
  }, [serviceIds]);

  useEffect(() => {
    if (!variantId || serviceIds.length === 0) {
      setResult(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setValidating(true);
      setValidationError(null);
      api
        .POST("/configurator/validate", {
          body: {
            deviceModelId: model.id,
            deviceVariantId: variantId,
            hardwareRevisionId: revisionId || undefined,
            serviceIds,
            optionIds,
          },
          signal: controller.signal,
        })
        .then(({ data, error }) => {
          if (error) {
            setValidationError(error);
            setResult(null);
          } else if (data) {
            setResult(data);
          }
        })
        .catch(() => {
          /* requete annulee par un changement plus recent : rien a faire */
        })
        .finally(() => setValidating(false));
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [model.id, variantId, revisionId, serviceIds, optionIds]);

  function toggleService(id: string) {
    setAddedToCart(false);
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }
  function toggleOption(id: string) {
    setAddedToCart(false);
    setOptionIds((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  }

  async function handleAddToCart() {
    setAddingToCart(true);
    setAddToCartError(null);
    try {
      const { data: resolved } = user ? await api.GET("/cart/mine") : await api.POST("/cart/guest");
      const cartId = resolved?.cartId;
      if (!cartId) throw new Error("Panier introuvable.");

      const itemBody = {
        deviceModelId: model.id,
        deviceVariantId: variantId,
        hardwareRevisionId: revisionId || undefined,
        serviceIds,
        optionIds,
        reportedIssue: reportedIssue || undefined,
      };

      const { error } = user
        ? await api.POST("/cart/{cartId}/items/authenticated", { params: { path: { cartId } }, body: itemBody })
        : await api.POST("/cart/{cartId}/items", { params: { path: { cartId } }, body: itemBody });

      if (error) {
        setAddToCartError(error);
        return;
      }
      setAddedToCart(true);
      router.refresh();
    } catch (err) {
      setAddToCartError(err);
    } finally {
      setAddingToCart(false);
    }
  }

  const blockingIssues = result?.issues.filter((i) => i.severity === "BLOCKING") ?? [];
  const infoIssues = result?.issues.filter((i) => i.severity === "INFO") ?? [];

  return (
    <div className="smc-row">
      <div className="smc-stack" style={{ flex: "2 1 420px" }}>
        <div className="smc-field">
          <label htmlFor="variant">Variante</label>
          <select
            id="variant"
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setRevisionId("");
              setAddedToCart(false);
            }}
          >
            {model.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {selectedVariant && selectedVariant.revisions.length > 0 && (
          <div className="smc-field">
            <label htmlFor="revision">Revision materielle (optionnel)</label>
            <select
              id="revision"
              value={revisionId}
              onChange={(e) => {
                setRevisionId(e.target.value);
                setAddedToCart(false);
              }}
            >
              <option value="">Je ne sais pas / non applicable</option>
              {selectedVariant.revisions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <fieldset className="smc-field">
          <legend>Prestations souhaitees</legend>
          {availableServices.map((service) => (
            <label key={service.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input type="checkbox" checked={serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} />
              {service.name} — <span className="smc-price">{formatPrice(service.basePrice.amountMinor)}</span>
            </label>
          ))}
        </fieldset>

        {optionsForSelectedServices.length > 0 && (
          <fieldset className="smc-field">
            <legend>Options</legend>
            {optionsForSelectedServices.map((option) => (
              <label key={option.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input type="checkbox" checked={optionIds.includes(option.id)} onChange={() => toggleOption(option.id)} />
                {option.name} {option.isRequired && <span className="smc-badge">obligatoire</span>} —{" "}
                <span className="smc-price">+{formatPrice(option.extraPrice.amountMinor)}</span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="smc-field">
          <label htmlFor="reportedIssue">Description du probleme (optionnel)</label>
          <textarea id="reportedIssue" rows={3} value={reportedIssue} onChange={(e) => setReportedIssue(e.target.value)} />
        </div>
      </div>

      <aside className="smc-card" style={{ flex: "1 1 280px", alignSelf: "flex-start" }} aria-live="polite">
        <h2>Recapitulatif</h2>
        {validating && <p className="smc-muted">Calcul du prix en cours…</p>}
        <ApiErrorAlert error={validationError} />

        {result && (
          <>
            {blockingIssues.length > 0 && (
              <div className="smc-alert smc-alert--error" role="alert">
                <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                  {blockingIssues.map((issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {infoIssues.length > 0 && (
              <div className="smc-alert" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                  {infoIssues.map((issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.recommendations.length > 0 && (
              <div className="smc-stack" style={{ gap: "0.25rem" }}>
                <strong>Recommandations</strong>
                <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="smc-muted">
                      {rec.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <dl style={{ margin: 0 }}>
              <div className="smc-row" style={{ justifyContent: "space-between" }}>
                <dt>Sous-total</dt>
                <dd className="smc-price">{formatPrice(result.price.subtotalMinor)}</dd>
              </div>
              {result.price.discountMinor > 0 && (
                <div className="smc-row" style={{ justifyContent: "space-between" }}>
                  <dt>Remise</dt>
                  <dd>-{formatPrice(result.price.discountMinor)}</dd>
                </div>
              )}
              <div className="smc-row" style={{ justifyContent: "space-between" }}>
                <dt>TVA</dt>
                <dd>{formatPrice(result.price.taxMinor)}</dd>
              </div>
              <div className="smc-row" style={{ justifyContent: "space-between", fontWeight: 700 }}>
                <dt>Total</dt>
                <dd className="smc-price">{formatPrice(result.price.totalMinor)}</dd>
              </div>
            </dl>
            <p className="smc-muted">
              Delai estime : {result.estimatedLeadTimeDays.min}–{result.estimatedLeadTimeDays.max} jours ouvres
            </p>

            <ApiErrorAlert error={addToCartError} />
            {addedToCart && (
              <p className="smc-alert smc-alert--success" role="status">
                Ajoute au panier.
              </p>
            )}
            <button type="button" className="smc-btn" disabled={!result.valid || addingToCart} onClick={() => void handleAddToCart()}>
              {addingToCart ? "Ajout en cours…" : "Ajouter au panier"}
            </button>
          </>
        )}

        {!result && !validating && serviceIds.length === 0 && (
          <p className="smc-muted">Selectionnez au moins une prestation pour voir le prix.</p>
        )}
      </aside>
    </div>
  );
}
