const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

// Frontend unit tests (src/**/*.test.ts). Backend tests live in server/ and
// have their own Jest config; the frontend system test has jest.system.config.js.
process.env.TZ = "UTC"; // date/streak logic is tested against a frozen UTC clock

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  transform: {
    ...tsJestTransformCfg,
  },
};
