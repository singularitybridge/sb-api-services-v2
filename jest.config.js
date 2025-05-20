module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: [
    "<rootDir>/tests/**/*.test.ts", 
    "<rootDir>/src/**/*.test.ts",
    "<rootDir>/e2e-tests/tests/**/*.test.js"
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest', // For .ts and .tsx files
    '^.+\\.jsx?$': 'babel-jest', // For .js and .jsx files
  },
  coverageDirectory: "<rootDir>/coverage",
  collectCoverageFrom: [
    "<rootDir>/src/**/*.ts",
    "!<rootDir>/src/types/**/*.ts",
    "!<rootDir>/src/index.ts",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
