// Points the app at the throwaway integration database created by globalSetup.
const { assertLocalDatabase } = require('./safeEnv');

process.env.DATABASE_URL = `${process.env.TEST_PG_BASE_URL}/gym_integration`;
assertLocalDatabase();
