module.exports = {
  testMatch: ["<rootDir>/src/**/*.spec.ts"],
  transform: { "^.+\\.ts$": "ts-jest" },
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
};
