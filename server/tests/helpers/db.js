// Shared lifecycle for integration tests: fresh schema per file, empty tables per test.
const sequelize = require('../../db');
const Session = require('../../models/Session');
const PersonalRecord = require('../../models/PersonalRecord');
const WorkoutLog = require('../../models/WorkoutLog');

function useCleanDatabase() {
    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });
    beforeEach(async () => {
        await sequelize.truncate({ cascade: true, restartIdentity: true });
    });
    afterAll(async () => {
        await sequelize.close();
    });
}

const daysAgo = (n, hour = 12) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
};

module.exports = { sequelize, Session, PersonalRecord, WorkoutLog, useCleanDatabase, daysAgo };
