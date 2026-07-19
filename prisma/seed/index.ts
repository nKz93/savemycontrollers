/**
 * Seed minimal, deterministe et rejouable (upsert partout).
 * Contient uniquement : permissions, roles, statuts systeme, transitions,
 * parametres indispensables, et un compte super-administrateur reserve a
 * l'environnement local (jamais en preproduction/production — voir garde
 * ci-dessous). Aucun catalogue commercial fictif n'est cree ici : un jeu
 * de demonstration distinct, clairement identifie comme fixture de test,
 * est prevu dans tests/fixtures (phase suivante).
 */
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { SEED_PERMISSIONS, SEED_ROLES } from "./permissions.js";
import { SEED_REPAIR_STATUSES, SEED_REPAIR_TRANSITIONS } from "./repair-statuses.js";
import { seedCatalogDemo } from "./catalog-demo.js";

const prisma = new PrismaClient();

async function seedPermissionsAndRoles(): Promise<void> {
  for (const permission of SEED_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { description: permission.description },
    });
  }

  for (const role of SEED_ROLES) {
    const createdRole = await prisma.role.upsert({
      where: { key: role.key },
      create: { key: role.key, label: role.label, isSystem: true },
      update: { label: role.label },
    });
    for (const permissionKey of role.permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permissionKey } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: createdRole.id, permissionId: permission.id } },
        create: { roleId: createdRole.id, permissionId: permission.id },
        update: {},
      });
    }
  }
  console.log(`Permissions (${SEED_PERMISSIONS.length}) et roles (${SEED_ROLES.length}) initialises.`);
}

async function seedRepairStatuses(): Promise<void> {
  for (const status of SEED_REPAIR_STATUSES) {
    await prisma.repairStatusDefinition.upsert({
      where: { key: status.key },
      create: status,
      update: { label: status.label, color: status.color, displayOrder: status.displayOrder },
    });
  }
  for (const transition of SEED_REPAIR_TRANSITIONS) {
    await prisma.repairStatusTransition.upsert({
      where: { fromStatusKey_toStatusKey: { fromStatusKey: transition.from, toStatusKey: transition.to } },
      create: { fromStatusKey: transition.from, toStatusKey: transition.to, isSystemProtected: transition.isSystemProtected },
      update: { isSystemProtected: transition.isSystemProtected },
    });
  }
  console.log(`Statuts de reparation (${SEED_REPAIR_STATUSES.length}) et transitions (${SEED_REPAIR_TRANSITIONS.length}) initialises.`);
}

async function seedEssentialSettings(): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "tax.default_rate_basis_points" },
    create: { key: "tax.default_rate_basis_points", valueType: "NUMBER", valueNumber: 2000, isPublic: true, description: "Taux de TVA par defaut, en points de base (2000 = 20,00 %)." },
    update: {},
  });
  await prisma.setting.upsert({
    where: { key: "repair.default_lead_time_days_min" },
    create: { key: "repair.default_lead_time_days_min", valueType: "NUMBER", valueNumber: 5, isPublic: true, description: "Delai de traitement minimum par defaut (jours ouvres)." },
    update: {},
  });
  await prisma.setting.upsert({
    where: { key: "repair.default_lead_time_days_max" },
    create: { key: "repair.default_lead_time_days_max", valueType: "NUMBER", valueNumber: 10, isPublic: true, description: "Delai de traitement maximum par defaut (jours ouvres)." },
    update: {},
  });
  await prisma.setting.upsert({
    where: { key: "warranty.default_duration_days" },
    create: { key: "warranty.default_duration_days", valueType: "NUMBER", valueNumber: 90, isPublic: true, description: "Duree de garantie par defaut, en jours." },
    update: {},
  });
  console.log("Parametres essentiels initialises.");
}

async function seedLocalSuperAdmin(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.log("NODE_ENV=production : creation du compte super-administrateur de demonstration ignoree.");
    return;
  }
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.log("SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD non definis : compte super-administrateur non cree.");
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      accountType: "STAFF",
      emailVerifiedAt: new Date(),
    },
    update: {},
  });
  const role = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });
  console.log(`Compte super-administrateur local pret : ${email}`);
}

async function main(): Promise<void> {
  await seedPermissionsAndRoles();
  await seedRepairStatuses();
  await seedEssentialSettings();
  await seedLocalSuperAdmin();

  // Catalogue de demonstration : jamais en production, uniquement local
  // et environnements de validation fonctionnelle (staging/CI E2E).
  if (process.env.NODE_ENV !== "production") {
    await seedCatalogDemo(prisma);
  } else {
    console.log("NODE_ENV=production : catalogue de demonstration ignore.");
  }
}

main()
  .catch((error) => {
    console.error("Echec du seed :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
