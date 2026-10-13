const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const WorkoutLog = sequelize.define('WorkoutLog', {
    userId: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    programId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    programName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    totalReps: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    qualityScore: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 100,
    },
    durationSeconds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    exerciseBreakdown: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
    },
    formErrors: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
    },
    completed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    indexes: [
        { fields: ['completedAt'] },
        { fields: ['userId', 'completedAt'] },
        { fields: ['programId'] },
    ],
});

module.exports = WorkoutLog;
