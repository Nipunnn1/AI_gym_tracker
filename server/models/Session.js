const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Session = sequelize.define('Session', {
    userId: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    exerciseId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    programId: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    qualityScore: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 100,
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    setBreakdown: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
    },
    formErrorCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    formErrorDetails: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    indexes: [
        { fields: ['timestamp'] },
        { fields: ['exerciseId', 'timestamp'] },
        { fields: ['userId', 'timestamp'] },
        { fields: ['programId', 'timestamp'] },
    ],
});

module.exports = Session;
