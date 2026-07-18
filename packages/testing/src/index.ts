import { faker } from "@faker-js/faker";

/**
 * Fabriques de donnees de test (fixtures), utilisees uniquement par les
 * suites de tests. A ne jamais confondre avec le seed de production
 * (voir prisma/seed) qui ne contient aucune donnee commerciale fictive.
 */
export function buildTestUser(overrides: Partial<{ email: string; firstName: string; lastName: string }> = {}) {
  return {
    email: overrides.email ?? faker.internet.email().toLowerCase(),
    firstName: overrides.firstName ?? faker.person.firstName(),
    lastName: overrides.lastName ?? faker.person.lastName(),
    password: "Test-Password-1234!",
  };
}

export function buildTestBrand(overrides: Partial<{ name: string; slug: string }> = {}) {
  const name = overrides.name ?? `Marque ${faker.string.alphanumeric(6)}`;
  return {
    name,
    slug: overrides.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  };
}
