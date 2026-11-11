/**
 * Loaded before every backend test file.
 *
 * server.js and services/aiCoach.js call dotenv, which would load server/.env
 * (the production Supabase DATABASE_URL and Gemini key). dotenv never overrides
 * a variable that is already set, so we set every relevant variable here first.
 */
const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

// Default to an unreachable local database; integration/system setup overrides it.
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || 'postgres://nobody:nobody@127.0.0.1:1/none';
process.env.PGSSLMODE = 'disable';
process.env.GEMINI_API_KEY = '';
process.env.NODE_ENV = 'test';
process.env.DOTENV_CONFIG_QUIET = 'true';

function assertLocalDatabase(url = process.env.DATABASE_URL) {
    const host = new URL(url).hostname;
    if (!LOCAL_HOSTS.includes(host)) {
        throw new Error(`Refusing to run tests against non-local database host "${host}"`);
    }
}

assertLocalDatabase();

module.exports = { assertLocalDatabase };
