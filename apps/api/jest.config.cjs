/** Configuration Jest — deux projets : tests unitaires (sans base) et tests
 * d'integration (necessitent DATABASE_URL_TEST vers une vraie instance
 * PostgreSQL, voir docs/development/getting-started.md). */
module.exports = {
  projects: [
    {
      displayName: "unit",
      testMatch: ["<rootDir>/src/**/*.spec.ts"],
      transform: { "^.+\\.ts$": "ts-jest" },
      moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
      testPathIgnorePatterns: ["\\.integration\\.spec\\.ts$"],
    },
    {
      displayName: "integration",
      testMatch: ["<rootDir>/src/**/*.integration.spec.ts"],
      transform: { "^.+\\.ts$": "ts-jest" },
      moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
    },
  ],
};
