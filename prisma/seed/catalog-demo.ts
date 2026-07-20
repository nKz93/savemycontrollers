/**
 * Jeu de donnees de demonstration pour le catalogue (marques, modeles,
 * variantes, revisions, prestations, options, regles de compatibilite,
 * de dependance, d'exclusion, de recommandation, de prix et de delai).
 *
 * Deterministe et rejouable : chaque entite est creee via upsert (ou un
 * equivalent find-then-create pour les modeles sans cle unique naturelle,
 * comme DeviceVariant/CompatibilityRule/PricingRule/LeadTimeRule) afin que
 * relancer le seed plusieurs fois ne produise jamais de doublons.
 *
 * Clairement distinct du seed systeme (permissions/roles/statuts) : ce
 * fichier est explicitement un jeu de DEMONSTRATION, jamais execute en
 * production (voir garde dans index.ts).
 */
import type { PrismaClient } from "@prisma/client";

export async function seedCatalogDemo(prisma: PrismaClient): Promise<void> {
  // --- Marques et familles -----------------------------------------------
  const sony = await prisma.brand.upsert({
    where: { slug: "sony" },
    create: { slug: "sony", name: "Sony", status: "ACTIVE", displayOrder: 1, shortDescription: "Manettes PlayStation." },
    update: {},
  });
  const microsoft = await prisma.brand.upsert({
    where: { slug: "microsoft" },
    create: { slug: "microsoft", name: "Microsoft", status: "ACTIVE", displayOrder: 2, shortDescription: "Manettes Xbox." },
    update: {},
  });
  const nintendo = await prisma.brand.upsert({
    where: { slug: "nintendo" },
    create: { slug: "nintendo", name: "Nintendo", status: "ACTIVE", displayOrder: 3, shortDescription: "Manettes Switch." },
    update: {},
  });

  const playstationFamily = await upsertFamily(prisma, sony.id, "playstation", "PlayStation");
  const xboxFamily = await upsertFamily(prisma, microsoft.id, "xbox", "Xbox");
  const switchFamily = await upsertFamily(prisma, nintendo.id, "switch", "Switch");

  // --- Modeles (plusieurs marques et modeles) -----------------------------
  const dualSense = await upsertModel(prisma, playstationFamily.id, "dualsense", "DualSense", "Manette standard de la PS5.");
  const dualSenseEdge = await upsertModel(prisma, playstationFamily.id, "dualsense-edge", "DualSense Edge", "Manette PS5 haut de gamme, personnalisable.");
  const xboxController = await upsertModel(prisma, xboxFamily.id, "xbox-series-controller", "Manette Xbox Series", "Manette standard Xbox Series X|S.");
  const proController = await upsertModel(prisma, switchFamily.id, "switch-pro-controller", "Manette Pro Switch", "Manette Pro pour Nintendo Switch.");
  const joyCon = await upsertModel(prisma, switchFamily.id, "joy-con", "Joy-Con (paire)", "Paire de Joy-Con pour Nintendo Switch.");

  // --- Variantes (au moins deux marques ont plusieurs variantes) ---------
  const dualSenseBlanc = await upsertVariant(prisma, dualSense.id, "Blanc");
  const dualSenseMidnight = await upsertVariant(prisma, dualSense.id, "Midnight Black");
  const dualSenseEdgeStandard = await upsertVariant(prisma, dualSenseEdge.id, "Standard");
  const xboxStandard = await upsertVariant(prisma, xboxController.id, "Standard");
  const xboxElite = await upsertVariant(prisma, xboxController.id, "Elite Series 2");
  const proControllerStandard = await upsertVariant(prisma, proController.id, "Standard");
  const joyConPaire = await upsertVariant(prisma, joyCon.id, "Standard");

  // --- Revisions materielles (au moins une variante en a) ------------------
  const dualSenseBlancV1 = await upsertRevision(prisma, dualSenseBlanc.id, "CFI-ZCT1", "Premiere generation (CFI-ZCT1)");
  await upsertRevision(prisma, dualSenseBlanc.id, "CFI-ZCT1W", "Deuxieme generation (CFI-ZCT1W)");

  // --- Categorie et prestations --------------------------------------------
  const category = await prisma.serviceCategory.upsert({
    where: { slug: "reparation" },
    create: { slug: "reparation", name: "Reparation", kind: "REPAIR", status: "ACTIVE", displayOrder: 1 },
    update: {},
  });

  const stickDrift = await upsertService(prisma, category.id, "correction-stick-drift", "Correction de stick drift", 3500, "Recalibrage ou remplacement du module de stick analogique.");
  const batterie = await upsertService(prisma, category.id, "remplacement-batterie", "Remplacement de batterie", 2500, "Remplacement de la batterie interne.");
  const nettoyage = await upsertService(prisma, category.id, "nettoyage-complet", "Nettoyage complet", 1500, "Demontage et nettoyage complet de la manette.");
  const boutonsArriere = await upsertService(prisma, category.id, "boutons-arriere-edge", "Remplacement des boutons arriere (Edge)", 4500, "Remplacement des modules de boutons arriere amovibles, specifique a la DualSense Edge.");
  const personnalisation = await upsertService(prisma, category.id, "personnalisation-coque", "Personnalisation de la coque", 3000, "Remplacement de la coque exterieure avec finition au choix.");
  const reparationExpress = await upsertService(prisma, category.id, "reparation-express", "Reparation express (24h)", 5500, "Traitement prioritaire sous 24h, hors prestations esthetiques.");

  // --- Options (sur la personnalisation de coque) --------------------------
  await upsertOption(prisma, personnalisation.id, "coque-noir-mat", "Coque noir mat", 500, false);
  await upsertOption(prisma, personnalisation.id, "coque-transparente", "Coque transparente", 800, false);
  await upsertOption(prisma, personnalisation.id, "gravure-personnalisee", "Gravure personnalisee", 300, false);

  // --- Compatibilite (liste blanche) : les boutons arriere ne concernent
  // QUE la DualSense Edge — toute autre manette declenche une incompatibilite.
  await upsertCompatibilityRule(prisma, boutonsArriere.id, { deviceModelId: dualSenseEdge.id });

  // --- Dependance obligatoire : les boutons arriere necessitent un
  // nettoyage complet prealable (demontage complet requis).
  await prisma.requirementRule.upsert({
    where: { serviceId_requiredServiceId: { serviceId: boutonsArriere.id, requiredServiceId: nettoyage.id } },
    create: { serviceId: boutonsArriere.id, requiredServiceId: nettoyage.id },
    update: {},
  });

  // --- Exclusion : la reparation express ne peut pas etre combinee avec
  // une prestation esthetique (delai incompatible avec le traitement prioritaire).
  await prisma.exclusionRule.upsert({
    where: { serviceAId_serviceBId: { serviceAId: reparationExpress.id, serviceBId: personnalisation.id } },
    create: {
      serviceAId: reparationExpress.id,
      serviceBId: personnalisation.id,
      reason: "Le service express ne peut pas etre combine avec une personnalisation esthetique.",
    },
    update: {},
  });

  // --- Recommandation (non bloquante) : conseiller un nettoyage complet
  // en meme temps qu'une correction de stick drift.
  await prisma.recommendationRule.upsert({
    where: { serviceId_recommendedServiceId: { serviceId: stickDrift.id, recommendedServiceId: nettoyage.id } },
    create: {
      serviceId: stickDrift.id,
      recommendedServiceId: nettoyage.id,
      message: "Nous recommandons un nettoyage complet en meme temps qu'une correction de stick drift.",
    },
    update: {},
  });

  // --- Plusieurs prix : la correction de stick drift coute plus cher sur
  // la DualSense Edge (mecanisme plus complexe que le prix de base).
  await upsertPricingRule(prisma, stickDrift.id, { deviceModelId: dualSenseEdge.id }, 4500);

  // --- Plusieurs delais : delai plus long pour la DualSense Edge que le
  // delai general de la prestation.
  await upsertLeadTimeRule(prisma, stickDrift.id, undefined, 3, 5);
  await upsertLeadTimeRule(prisma, stickDrift.id, dualSenseEdge.id, 5, 8);
  await upsertLeadTimeRule(prisma, nettoyage.id, undefined, 1, 2);
  await upsertLeadTimeRule(prisma, boutonsArriere.id, undefined, 5, 7);
  await upsertLeadTimeRule(prisma, personnalisation.id, undefined, 7, 10);
  await upsertLeadTimeRule(prisma, batterie.id, undefined, 2, 4);
  await upsertLeadTimeRule(prisma, reparationExpress.id, undefined, 1, 1);

  console.log(
    `Catalogue de demonstration initialise : 3 marques, 5 modeles, 7 variantes, 2 revisions, 6 prestations, 3 options, ` +
      `1 compatibilite restreinte, 1 dependance, 1 exclusion, 1 recommandation, prix et delais multiples.`,
  );
  void dualSenseMidnight;
  void dualSenseEdgeStandard;
  void xboxStandard;
  void xboxElite;
  void proControllerStandard;
  void joyConPaire;
  void dualSenseBlancV1;
}

async function upsertFamily(prisma: PrismaClient, brandId: string, slug: string, name: string) {
  return prisma.productFamily.upsert({
    where: { brandId_slug: { brandId, slug } },
    create: { brandId, slug, name, status: "ACTIVE" },
    update: {},
  });
}

async function upsertModel(prisma: PrismaClient, familyId: string, slug: string, name: string, shortDescription: string) {
  const existing = await prisma.deviceModel.findFirst({ where: { familyId, slug } });
  if (existing) return existing;
  return prisma.deviceModel.create({ data: { familyId, slug, name, status: "ACTIVE", shortDescription } });
}

async function upsertVariant(prisma: PrismaClient, deviceModelId: string, name: string) {
  const existing = await prisma.deviceVariant.findFirst({ where: { deviceModelId, name } });
  if (existing) return existing;
  return prisma.deviceVariant.create({ data: { deviceModelId, name, status: "ACTIVE" } });
}

async function upsertRevision(prisma: PrismaClient, deviceVariantId: string, code: string, label: string) {
  return prisma.hardwareRevision.upsert({
    where: { deviceVariantId_code: { deviceVariantId, code } },
    create: { deviceVariantId, code, label },
    update: { label },
  });
}

async function upsertService(prisma: PrismaClient, categoryId: string, slug: string, name: string, basePriceMinor: number, shortDescription: string) {
  return prisma.service.upsert({
    where: { slug },
    create: { categoryId, slug, name, status: "ACTIVE", basePriceMinor, shortDescription },
    update: { basePriceMinor, shortDescription },
  });
}

async function upsertOption(prisma: PrismaClient, serviceId: string, slug: string, name: string, extraPriceMinor: number, isRequired: boolean) {
  return prisma.serviceOption.upsert({
    where: { serviceId_slug: { serviceId, slug } },
    create: { serviceId, slug, name, status: "ACTIVE", extraPriceMinor, isRequired },
    update: { extraPriceMinor, isRequired },
  });
}

async function upsertCompatibilityRule(
  prisma: PrismaClient,
  serviceId: string,
  scope: { productFamilyId?: string; deviceModelId?: string; deviceVariantId?: string; hardwareRevisionId?: string; partId?: string },
) {
  const existing = await prisma.compatibilityRule.findFirst({ where: { serviceId, ...scope } });
  if (existing) return existing;
  return prisma.compatibilityRule.create({ data: { serviceId, ...scope } });
}

async function upsertPricingRule(
  prisma: PrismaClient,
  serviceId: string,
  scope: { productFamilyId?: string; deviceModelId?: string; deviceVariantId?: string },
  amountMinor: number,
) {
  const existing = await prisma.pricingRule.findFirst({ where: { serviceId, clientType: "STANDARD", ...scope } });
  if (existing) return existing;
  return prisma.pricingRule.create({ data: { serviceId, clientType: "STANDARD", amountMinor, ...scope } });
}

async function upsertLeadTimeRule(prisma: PrismaClient, serviceId: string, deviceModelId: string | undefined, minDays: number, maxDays: number) {
  const existing = await prisma.leadTimeRule.findFirst({ where: { serviceId, deviceModelId: deviceModelId ?? null } });
  if (existing) return existing;
  return prisma.leadTimeRule.create({ data: { serviceId, deviceModelId, minDays, maxDays } });
}
