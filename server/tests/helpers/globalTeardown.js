module.exports = async function globalTeardown(_globalConfig, projectConfig) {
    const name = projectConfig.displayName.name;
    const pg = globalThis.__embeddedPostgres && globalThis.__embeddedPostgres[name];
    if (pg) {
        await pg.stop();
        delete globalThis.__embeddedPostgres[name];
    }
};
