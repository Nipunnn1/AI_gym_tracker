/**
 * Starts a disposable PostgreSQL 17 (same major version as production on
 * Supabase) on a random localhost port, with empty databases for the
 * integration and system suites. Data lives in a temp dir that is deleted on
 * teardown.
 */
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const USER = 'postgres';
const PASSWORD = 'test';

function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
    });
}

module.exports = async function globalSetup(_globalConfig, projectConfig) {
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const port = await freePort();
    const databaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-pg-'));

    const pg = new EmbeddedPostgres({
        databaseDir,
        port,
        user: USER,
        password: PASSWORD,
        persistent: false,
        onLog: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('gym_integration');
    await pg.createDatabase('gym_system');

    globalThis.__embeddedPostgres = globalThis.__embeddedPostgres || {};
    globalThis.__embeddedPostgres[projectConfig.displayName.name] = pg;

    process.env.TEST_PG_BASE_URL = `postgres://${USER}:${PASSWORD}@127.0.0.1:${port}`;
};
