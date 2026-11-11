/**
 * Backend test configuration — three layers, each its own Jest project:
 *
 *   unit         tests/unit         one module at a time, collaborators mocked, no DB/network
 *   integration  tests/integration  Express routes + Sequelize models against a real, throwaway Postgres 17
 *   system       tests/system       the real `node server.js` process over HTTP, real DB, real ONNX model
 *
 * Run one layer with `npm run test:unit|test:integration|test:system`, or all with `npm test`.
 * Integration and system tests never touch the production database: they start
 * an embedded Postgres on a random localhost port and tests/helpers/safeEnv.js
 * refuses to run if DATABASE_URL points anywhere else.
 */
const base = {
    rootDir: __dirname,
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/tests/helpers/safeEnv.js'],
};

const withPostgres = {
    globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
    globalTeardown: '<rootDir>/tests/helpers/globalTeardown.js',
};

module.exports = {
    testTimeout: 60000,
    projects: [
        {
            ...base,
            displayName: 'unit',
            testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
        },
        {
            ...base,
            ...withPostgres,
            displayName: 'integration',
            testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
            setupFiles: [...base.setupFiles, '<rootDir>/tests/helpers/integrationEnv.js'],
        },
        {
            ...base,
            ...withPostgres,
            displayName: 'system',
            testMatch: ['<rootDir>/tests/system/**/*.test.js'],
        },
    ],
};
