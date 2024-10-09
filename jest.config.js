module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  coverageDirectory: "<rootDir>/coverage",
  collectCoverageFrom: [
    "<rootDir>/src/**/*.ts",
    "!<rootDir>/src/types/**/*.ts",
    "!<rootDir>/src/index.ts",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
