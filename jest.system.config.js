// Frontend system tests: run against the production build (`next build` + `next start`).
/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests/system"],
  testTimeout: 60000,
};
